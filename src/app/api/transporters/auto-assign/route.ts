import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * GET /api/transporters/auto-assign
 * Récupère l'état de l'auto-assign pour le transporteur actuel
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER']);
  if (!auth.success) return auth.response;

  try {
    const prefs = await db.transporterPreferences.findUnique({
      where: { userId: auth.payload.id },
    });

    if (!prefs) {
      return NextResponse.json(
        { enabled: false, schedule: null },
        { status: 200 }
      );
    }

    // Compter missions actives
    const activeMissions = await db.mission.count({
      where: {
        transporteurId: auth.payload.id,
        status: { in: ['ASSIGNE', 'EN_COURS'] },
      },
    });

    // Compter missions d'aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await db.mission.count({
      where: {
        transporteurId: auth.payload.id,
        assignedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return NextResponse.json({
      enabled: prefs.autoAssignEnabled,
      schedule: prefs.autoAssignSchedule,
      maxDailyMissions: prefs.maxDailyMissions,
      maxActiveParallel: prefs.maxActiveParallel,
      todayCount,
      activeCount: activeMissions,
      canAssignMore: activeMissions < prefs.maxActiveParallel && todayCount < prefs.maxDailyMissions,
      lastCheck: prefs.lastAssignmentCheck,
    });
  } catch (error) {
    console.error('Error fetching auto-assign status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auto-assign status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transporters/auto-assign
 * Active/désactive et configure l'auto-assign
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { enabled, schedule } = body;

    // Valider schedule
    const validSchedules = ['MANUAL', 'DAILY_8AM', 'DAILY_6PM', 'WEEKLY'];
    if (schedule && !validSchedules.includes(schedule)) {
      return NextResponse.json(
        { error: `Schedule invalide. Doit être: ${validSchedules.join(', ')}` },
        { status: 400 }
      );
    }

    // Chercher ou créer les préférences
    let prefs = await db.transporterPreferences.findUnique({
      where: { userId: auth.payload.id },
    });

    if (!prefs) {
      prefs = await db.transporterPreferences.create({
        data: {
          userId: auth.payload.id,
          autoAssignEnabled: enabled ?? false,
          autoAssignSchedule: schedule || 'DAILY_8AM',
          maxDailyMissions: 10,
          maxActiveParallel: 5,
          scoreWeightDistance: 30,
          scoreWeightCapacity: 25,
          scoreWeightTiming: 20,
          scoreWeightEarnings: 25,
          successRate: 100,
        },
      });
    } else {
      prefs = await db.transporterPreferences.update({
        where: { userId: auth.payload.id },
        data: {
          autoAssignEnabled: enabled ?? prefs.autoAssignEnabled,
          autoAssignSchedule: schedule || prefs.autoAssignSchedule,
          lastAssignmentCheck: enabled ? new Date() : prefs.lastAssignmentCheck,
        },
      });
    }

    return NextResponse.json(prefs, { status: 200 });
  } catch (error) {
    console.error('Error updating auto-assign:', error);
    return NextResponse.json(
      { error: 'Failed to update auto-assign' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/transporters/auto-assign
 * Déclenche manuellement un auto-assign
 */
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { automateUnmatched = true, limit = 10 } = body;
    const transporterId = auth.payload.role === 'ADMIN'
      ? body.transporterId || auth.payload.id
      : auth.payload.id;

    // Vérifier les préférences
    const prefs = await db.transporterPreferences.findUnique({
      where: { userId: transporterId },
    });

    if (!prefs || !prefs.autoAssignEnabled) {
      return NextResponse.json(
        { error: 'Auto-assign non activé pour ce transporteur' },
        { status: 403 }
      );
    }

    // Vérifier capacité
    const activeMissions = await db.mission.count({
      where: {
        transporteurId: transporterId,
        status: { in: ['ASSIGNE', 'EN_COURS'] },
      },
    });

    if (activeMissions >= prefs.maxActiveParallel) {
      return NextResponse.json(
        {
          error: `Limite de ${prefs.maxActiveParallel} missions parallèles atteinte`,
          activeMissions,
        },
        { status: 409 }
      );
    }

    // Compter missions du jour
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await db.mission.count({
      where: {
        transporteurId: transporterId,
        assignedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (todayCount >= prefs.maxDailyMissions) {
      return NextResponse.json(
        {
          error: `Limite quotidienne de ${prefs.maxDailyMissions} missions atteinte`,
          todayCount,
        },
        { status: 409 }
      );
    }

    // Récupérer les colis éligibles non assignés
    const availableSlots = Math.min(
      Math.max(prefs.maxActiveParallel - activeMissions, 0),
      Math.max(prefs.maxDailyMissions - todayCount, 0),
      Number(limit) || 10
    );

    if (availableSlots <= 0) {
      return NextResponse.json(
        { message: 'Aucune place disponible', assigned: 0 },
        { status: 200 }
      );
    }

    // Trouver colis éligibles (status correct, poids acceptable, etc.)
    const unassignedColis = await db.colis.findMany({
      where: {
        status: { in: ['PAID_RELAY', 'DEPOSITED_RELAY', 'READY_FOR_DEPOSIT', 'WAITING_PICKUP'] },
        missions: {
          none: {
            status: { in: ['ASSIGNE', 'EN_COURS', 'LIVRE'] },
          },
        },
        ...(prefs.maxWeightKg ? { weight: { lte: prefs.maxWeightKg } } : {}),
      },
      select: {
        id: true,
        villeDepart: true,
        villeArrivee: true,
        weight: true,
        isPriority: true,
      },
      take: availableSlots,
    });

    if (unassignedColis.length === 0) {
      return NextResponse.json(
        { message: 'Aucun colis disponible matching les préférences', assigned: 0 },
        { status: 200 }
      );
    }

    // Assigner les colis
    const assigned: Array<{ colisId: string; missionId: string; route: string }> = [];
    const errors: Array<{ colisId: string; reason: string }> = [];

    for (const colis of unassignedColis) {
      try {
        // Vérifier si accepte la priorité
        if (colis.isPriority && !prefs.acceptsPriority) {
          errors.push({ colisId: colis.id, reason: 'Colis prioritaire non accepté' });
          continue;
        }

        // Créer la mission
        const mission = await db.mission.create({
          data: {
            colisId: colis.id,
            transporteurId: transporterId,
            status: 'ASSIGNE',
          },
        });

        assigned.push({
          colisId: colis.id,
          missionId: mission.id,
          route: `${colis.villeDepart} → ${colis.villeArrivee}`,
        });

        // Notifier transporteur
        await db.notification.create({
          data: {
            userId: transporterId,
            title: 'Colis auto-assigné',
            message: `${colis.villeDepart} → ${colis.villeArrivee}`,
            type: 'IN_APP',
          },
        }).catch(() => {});
      } catch (error) {
        errors.push({ colisId: colis.id, reason: (error as Error).message });
      }
    }

    // Mettre à jour lastAssignmentCheck
    await db.transporterPreferences.update({
      where: { userId: transporterId },
      data: { lastAssignmentCheck: new Date() },
    });

    return NextResponse.json(
      {
        message: `${assigned.length} colis assignés`,
        assigned,
        errors,
        summary: {
          total: unassignedColis.length,
          success: assigned.length,
          failed: errors.length,
          activeMissions: activeMissions + assigned.length,
          todayCount: todayCount + assigned.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error triggering auto-assign:', error);
    return NextResponse.json(
      { error: 'Failed to trigger auto-assign' },
      { status: 500 }
    );
  }
}
