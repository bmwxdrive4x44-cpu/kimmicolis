import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { updateTransporterScore, getTransporterScore, rankTransportersForMatching } from '@/lib/transporter-scoring';

/**
 * POST /api/transporters/{id}/update-score
 * Manually update transporteur score
 * (Usually called after mission completion or penalty)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  const { id: transporteurId } = await params;

  try {
    const score = await updateTransporterScore(transporteurId, true, false);

    return NextResponse.json({
      success: true,
      score: {
        transporteurId,
        score: score.score,
        successRate: score.successRate,
        cancellationRate: score.cancellationRate,
        avgCompletionTime: score.avgCompletionTime,
        totalDeliveries: score.totalDeliveries,
      },
    });
  } catch (error) {
    console.error('[update-score] Error:', error);
    return NextResponse.json({ error: 'Failed to update score' }, { status: 500 });
  }
}

/**
 * GET /api/transporters/{id}/score
 * Get transporteur score
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN', 'TRANSPORTER']);
  if (!auth.success) return auth.response;

  const { id: transporteurId } = await params;

  try {
    // Verify authorization
    if (auth.payload.role === 'TRANSPORTER' && auth.payload.id !== transporteurId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const score = await getTransporterScore(transporteurId);

    return NextResponse.json({
      success: true,
      score: {
        transporteurId,
        overall: score.score,
        successRate: score.successRate,
        cancellationRate: score.cancellationRate,
        avgCompletionTime: score.avgCompletionTime,
        averageRating: score.averageRating,
        totalDeliveries: score.totalDeliveries,
        totalCancellations: score.totalCancellations,
        totalLate: score.totalLate,
      },
    });
  } catch (error) {
    console.error('[get-score] Error:', error);
    return NextResponse.json({ error: 'Failed to get score' }, { status: 500 });
  }
}
