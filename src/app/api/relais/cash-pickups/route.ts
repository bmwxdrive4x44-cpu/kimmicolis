import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

async function resolveRelaisIdForActor(auth: { payload: { id: string; role: string } }, requestedRelaisId?: string | null) {
  if (auth.payload.role === 'RELAIS') {
    const relais = await db.relais.findUnique({
      where: { userId: auth.payload.id },
      select: { id: true },
    });
    return relais?.id || null;
  }

  return requestedRelaisId || null;
}

/**
 * GET /api/relais/cash-pickups?relaisId=...&status=...
 * RELAIS: ses collectes
 * ADMIN: toutes les collectes, filtrables
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const requestedRelaisId = searchParams.get('relaisId');
    const status = searchParams.get('status');

    const relaisId = await resolveRelaisIdForActor(auth, requestedRelaisId);

    if (!relaisId && auth.payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Relais introuvable pour cet utilisateur' }, { status: 404 });
    }

    const pickups = await db.cashPickup.findMany({
      where: {
        ...(relaisId ? { relaisId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        relais: {
          select: {
            commerceName: true,
            ville: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ pickups });
  } catch (error) {
    console.error('Error fetching cash pickups:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/relais/cash-pickups
 * Créer une demande de collecte cash physique
 * Body: { relaisId?, expectedAmount, scheduledAt?, notes? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { relaisId: bodyRelaisId, expectedAmount, scheduledAt, notes } = body;

    if (!expectedAmount || Number(expectedAmount) <= 0) {
      return NextResponse.json({ error: 'expectedAmount requis et > 0' }, { status: 400 });
    }

    const relaisId = await resolveRelaisIdForActor(auth, bodyRelaisId);
    if (!relaisId) {
      return NextResponse.json({ error: 'relaisId requis' }, { status: 400 });
    }

    const relais = await db.relais.findUnique({ where: { id: relaisId } });
    if (!relais) {
      return NextResponse.json({ error: 'Relais introuvable' }, { status: 404 });
    }

    const outstanding = Math.max((relais.cashCollected || 0) - (relais.cashReversed || 0), 0);
    if (Number(expectedAmount) > outstanding) {
      return NextResponse.json({
        error: `Montant demandé (${expectedAmount} DA) supérieur au cash en attente (${outstanding.toFixed(0)} DA)`,
      }, { status: 400 });
    }

    const pickup = await db.cashPickup.create({
      data: {
        relaisId,
        expectedAmount: Number(expectedAmount),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
      },
    });

    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'RELAIS',
        entityId: relaisId,
        action: 'CASH_PICKUP_REQUESTED',
        details: JSON.stringify({
          pickupId: pickup.id,
          expectedAmount: pickup.expectedAmount,
          scheduledAt: pickup.scheduledAt,
        }),
      },
    });

    return NextResponse.json({ success: true, pickup });
  } catch (error) {
    console.error('Error creating cash pickup:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
