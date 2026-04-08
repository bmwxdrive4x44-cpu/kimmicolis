import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { releaseMissionEarnings } from '@/lib/wallet-escrow';

/**
 * POST /api/missions/{id}/release-earnings
 * Release escrowed earnings when mission completed (LIVRE)
 * Called when colis status changes to LIVRE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  const { id: missionId } = await params;

  try {
    const mission = await (db as any).mission.findUnique({
      where: { id: missionId },
      include: { colis: true },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    if (mission.status !== 'LIVRE') {
      // Try to update status first
      await (db as any).mission.update({
        where: { id: missionId },
        data: { status: 'LIVRE', completedAt: new Date() },
      });
    }

    const colis = mission.colis;

    // Release escrowed earnings
    const wallet = await releaseMissionEarnings(
      mission.transporteurId,
      colis.netTransporteur,
      missionId
    );

    // Log action
    await (db as any).actionLog.create({
      data: {
        eventId: `EARNINGS_RELEASED:${missionId}`,
        scope: 'PAYMENT',
        userId: auth.payload.id,
        entityType: 'MISSION',
        entityId: missionId,
        action: 'MISSION_EARNINGS_RELEASED',
        details: JSON.stringify({
          missionId,
          colisId: colis.id,
          transporteurId: mission.transporteurId,
          amount: colis.netTransporteur,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Earnings released from escrow',
      wallet: {
        available: wallet.availableEarnings,
        escrowed: wallet.escrowedEarnings,
      },
    });
  } catch (error) {
    console.error('[release-earnings] Error:', error);
    return NextResponse.json({ error: 'Failed to release earnings' }, { status: 500 });
  }
}
