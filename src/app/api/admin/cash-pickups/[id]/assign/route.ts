import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

/**
 * POST /api/admin/cash-pickups/:id/assign
 * Body: { collectorId, scheduledAt?, notes? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { collectorId, scheduledAt, notes } = body;

    if (!collectorId) {
      return NextResponse.json({ error: 'collectorId requis' }, { status: 400 });
    }

    const pickup = await db.cashPickup.findUnique({ where: { id } });
    if (!pickup) {
      return NextResponse.json({ error: 'Collecte introuvable' }, { status: 404 });
    }

    if (!['REQUESTED', 'ASSIGNED'].includes(pickup.status)) {
      return NextResponse.json({ error: `Statut invalide: ${pickup.status}` }, { status: 400 });
    }

    const updated = await db.cashPickup.update({
      where: { id },
      data: {
        collectorId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : pickup.scheduledAt,
        status: 'ASSIGNED',
        notes: notes || pickup.notes,
      },
    });

    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'RELAIS',
        entityId: updated.relaisId,
        action: 'CASH_PICKUP_ASSIGNED',
        details: JSON.stringify({ pickupId: id, collectorId, scheduledAt: updated.scheduledAt }),
      },
    });

    return NextResponse.json({ success: true, pickup: updated });
  } catch (error) {
    console.error('Error assigning cash pickup:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
