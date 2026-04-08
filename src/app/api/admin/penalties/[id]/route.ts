import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { waivePenalty } from '@/lib/wallet-escrow';
import { createNotificationDedup } from '@/lib/notifications';

/**
 * GET /api/admin/penalties
 * List all penalties (with filtering)
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const transporteurId = searchParams.get('transporteurId');

    const where: any = {};
    if (status) where.status = status;
    if (transporteurId) where.transporteurId = transporteurId;

    const penalties = await (db as any).transporterPenalty.findMany({
      where,
      include: {
        colis: { select: { trackingNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const summary = {
      total: penalties.length,
      pending: penalties.filter((p: any) => p.status === 'PENDING').length,
      applied: penalties.filter((p: any) => p.status === 'APPLIED').length,
      waived: penalties.filter((p: any) => p.status === 'WAIVED').length,
      totalAmount: penalties.reduce((sum: number, p: any) => sum + p.amount, 0),
    };

    return NextResponse.json({ success: true, summary, penalties });
  } catch (error) {
    console.error('[get-penalties] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch penalties' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/penalties/{id}/waive
 * Waive a penalty (refund and mark as waived)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  const { id: penaltyId } = await params;

  try {
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Waive reason required' }, { status: 400 });
    }

    const waivePenaltyRecord = await waivePenalty(penaltyId, auth.payload.id, reason);

    // Get transporteur to notify
    const transporteur = await db.user.findUnique({
      where: { id: waivePenaltyRecord.transporteurId },
    });

    if (transporteur) {
      await createNotificationDedup({
        userId: waivePenaltyRecord.transporteurId,
        title: 'Pénalité annulée',
        message: `Votre pénalité de ${waivePenaltyRecord.amount.toFixed(0)} DA a été annulée par l'admin: ${reason}`,
        type: 'IN_APP',
      });
    }

    // Log action
    await (db as any).actionLog.create({
      data: {
        eventId: `PENALTY_WAIVE:${penaltyId}`,
        scope: 'PAYMENT',
        userId: auth.payload.id,
        entityType: 'PENALTY',
        entityId: penaltyId,
        action: 'PENALTY_WAIVED',
        details: JSON.stringify({ reason, waivedBy: auth.payload.id }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Penalty waived and refunded',
      penalty: waivePenaltyRecord,
    });
  } catch (error) {
    console.error('[waive-penalty] Error:', error);
    return NextResponse.json({ error: 'Failed to waive penalty' }, { status: 500 });
  }
}
