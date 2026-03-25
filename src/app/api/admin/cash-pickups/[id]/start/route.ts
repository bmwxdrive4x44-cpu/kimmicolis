import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

/**
 * POST /api/admin/cash-pickups/:id/start
 * Body optionnel: { notes }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const pickup = await db.cashPickup.findUnique({ where: { id } });
    if (!pickup) {
      return NextResponse.json({ error: 'Collecte introuvable' }, { status: 404 });
    }

    if (!['ASSIGNED', 'REQUESTED'].includes(pickup.status)) {
      return NextResponse.json({ error: `Statut invalide: ${pickup.status}` }, { status: 400 });
    }

    const updated = await db.cashPickup.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        notes: body?.notes || pickup.notes,
      },
    });

    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'RELAIS',
        entityId: updated.relaisId,
        action: 'CASH_PICKUP_STARTED',
        details: JSON.stringify({ pickupId: id, startedAt: updated.startedAt }),
      },
    });

    return NextResponse.json({ success: true, pickup: updated });
  } catch (error) {
    console.error('Error starting cash pickup:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
