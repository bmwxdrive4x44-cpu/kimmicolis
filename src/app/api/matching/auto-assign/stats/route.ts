import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

function parseVillesEtapes(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      // CSV fallback
    }
    return raw.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function isRouteCompatible(
  trajet: { villeDepart: string; villeArrivee: string; villesEtapes: unknown },
  villeDepart?: string,
  villeArrivee?: string
): boolean {
  if (!villeDepart && !villeArrivee) return true;

  const itinerary = [trajet.villeDepart, ...parseVillesEtapes(trajet.villesEtapes), trajet.villeArrivee];

  if (villeDepart && !itinerary.includes(villeDepart)) return false;
  if (villeArrivee && !itinerary.includes(villeArrivee)) return false;

  if (villeDepart && villeArrivee) {
    const depIdx = itinerary.indexOf(villeDepart);
    const arrIdx = itinerary.indexOf(villeArrivee);
    return depIdx >= 0 && arrIdx > depIdx;
  }

  return true;
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const villeDepart = searchParams.get('villeDepart')?.trim() || undefined;
    const villeArrivee = searchParams.get('villeArrivee')?.trim() || undefined;
    const requestedHours = Number(searchParams.get('periodHours') ?? '24');
    const periodHours = Number.isFinite(requestedHours)
      ? Math.max(1, Math.min(requestedHours, 24 * 30))
      : 24;

    const eligibleStatuses: string[] = ['CREATED', 'PAID_RELAY', 'DEPOSITED_RELAY', 'RECU_RELAIS'];
    const now = new Date();
    const sincePeriod = new Date(now.getTime() - periodHours * 60 * 60 * 1000);

    const colisFilter = {
      ...(villeDepart ? { villeDepart } : {}),
      ...(villeArrivee ? { villeArrivee } : {}),
    };

    const activeMissionStatuses: string[] = ['ASSIGNE', 'EN_COURS'];
    const activeMissionWhere = {
      status: { in: activeMissionStatuses },
      ...(villeDepart || villeArrivee
        ? {
            colis: {
              ...colisFilter,
            },
          }
        : {}),
    };

    const [unmatchedEligible, missionsAssigned24h, scheduledTrajets, recentAssignmentsRaw, activeLoads] = await Promise.all([
      db.colis.count({
        where: {
          status: { in: eligibleStatuses },
          ...colisFilter,
          missions: {
            none: {
              status: { in: ['ASSIGNE', 'EN_COURS'] },
            },
          },
        },
      }),
      db.mission.count({
        where: {
          assignedAt: { gte: sincePeriod },
          ...(villeDepart || villeArrivee
            ? {
                colis: {
                  ...colisFilter,
                },
              }
            : {}),
        },
      }),
      db.trajet.findMany({
        where: {
          status: 'PROGRAMME',
          dateDepart: { gte: now },
        },
        select: {
          id: true,
          villeDepart: true,
          villeArrivee: true,
          villesEtapes: true,
          placesColis: true,
          placesUtilisees: true,
        },
      }),
      db.mission.findMany({
        where: {
          ...(villeDepart || villeArrivee
            ? {
                colis: {
                  ...colisFilter,
                },
              }
            : {}),
        },
        orderBy: { assignedAt: 'desc' },
        take: 20,
        include: {
          colis: {
            select: {
              id: true,
              trackingNumber: true,
              villeDepart: true,
              villeArrivee: true,
              status: true,
            },
          },
          trajet: {
            select: {
              id: true,
              villeDepart: true,
              villeArrivee: true,
              dateDepart: true,
            },
          },
          transporteur: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      db.mission.groupBy({
        by: ['transporteurId'],
        where: activeMissionWhere,
        _count: { transporteurId: true },
      }),
    ]);

    const filteredTrajets = scheduledTrajets.filter((t) =>
      isRouteCompatible(t, villeDepart, villeArrivee)
    );

    const activeTrajets = filteredTrajets.filter((t) => t.placesUtilisees < t.placesColis).length;

    const loadUserIds = activeLoads.map((l) => l.transporteurId);
    const loadUsers = loadUserIds.length
      ? await db.user.findMany({
          where: { id: { in: loadUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const userMap = new Map(loadUsers.map((u) => [u.id, u]));

    const transporterLoad = activeLoads
      .map((l) => ({
        transporteurId: l.transporteurId,
        activeMissions: l._count.transporteurId,
        name: userMap.get(l.transporteurId)?.name ?? 'Transporteur',
        email: userMap.get(l.transporteurId)?.email ?? '',
      }))
      .sort((a, b) => b.activeMissions - a.activeMissions)
      .slice(0, 10);

    const recentAssignments = recentAssignmentsRaw.map((m) => ({
      missionId: m.id,
      assignedAt: m.assignedAt,
      status: m.status,
      colis: m.colis,
      trajet: m.trajet,
      transporteur: m.transporteur,
    }));

    return NextResponse.json({
      success: true,
      stats: {
        unmatchedEligible,
        activeTrajets,
        missionsAssignedPeriod: missionsAssigned24h,
        periodHours,
        totalScheduledTrajets: filteredTrajets.length,
      },
      filters: {
        villeDepart: villeDepart ?? null,
        villeArrivee: villeArrivee ?? null,
      },
      transporterLoad,
      recentAssignments,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[matching-auto-assign-stats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
