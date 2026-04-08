import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { applyPenalty, calculateAutoPenalties } from '@/lib/wallet-escrow';
import { degradeScoreForPenalty } from '@/lib/transporter-scoring';

/**
 * POST /api/penalties/apply
 * Apply auto-penalties to transporteur wallet based on parcel status
 * 
 * Triggered by:
 * - Cron job checking overdue SLA
 * - Manual admin action
 * - Parcel status changes (LOST, DAMAGED, CANCELLED)
 *
 * Body: { colisId, penaltyType? }
 * penaltyType: auto-detect if not provided
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisId } = body;

    if (!colisId) {
      return NextResponse.json({ error: 'colisId required' }, { status: 400 });
    }

    const colis = await db.colis.findUnique({
      where: { id: colisId },
      include: {
        missions: { select: { transporteurId: true } },
      },
    });

    if (!colis) {
      return NextResponse.json({ error: 'Colis not found' }, { status: 404 });
    }

    if (!colis.missions || colis.missions.length === 0) {
      return NextResponse.json(
        { error: 'No mission assigned to this parcel' },
        { status: 400 }
      );
    }

    const mission = colis.missions[0];
    const transporteurId = mission.transporteurId;

    // Calculate auto-penalties
    const penalties = await calculateAutoPenalties(colis);

    if (penalties.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No penalties applicable',
        penalties: [],
      });
    }

    // Apply each penalty
    const appliedPenalties: Array<{ penaltyId: string; type: string; amount: number; reason: string }> = [];
    for (const penalty of penalties) {
      const result = await applyPenalty(
        transporteurId,
        penalty.amount,
        penalty.reason,
        colisId
      );

      // Degrade score
      await degradeScoreForPenalty(transporteurId, penalty.type as any);

      appliedPenalties.push({
        ...penalty,
        penaltyId: result.penaltyId,
      });
    }

    // Log action
    await (db as any).actionLog.create({
      data: {
        eventId: `PENALTIES:${colisId}:${new Date().toISOString()}`,
        scope: 'PAYMENT',
        userId: auth.payload.id,
        entityType: 'COLIS',
        entityId: colisId,
        action: 'PENALTIES_APPLIED',
        details: JSON.stringify({ penalties: appliedPenalties }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${appliedPenalties.length} penalty(ies) applied`,
      penalties: appliedPenalties,
    });
  } catch (error) {
    console.error('[apply-penalties] Error:', error);
    return NextResponse.json({ error: 'Failed to apply penalties' }, { status: 500 });
  }
}
