import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { processMissionAssignmentTimeouts } from '@/lib/mission-timeout';

/**
 * POST /api/missions/check-timeouts
 * Check for expired mission assignments and auto-reassign
 * (Can be triggered by cron job or manual)
 *
 * Timeout default: 30 minutes from assignment
 * If transporteur hasn't confirmed receipt (relaisConfirmed=false),
 * auto-reassign to next best ranked transporteur
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const result = await processMissionAssignmentTimeouts({ actorId: auth.payload.id });

    if (result.expiredCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired missions',
        reassigned: 0,
        extended: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${result.reassigned.length} mission(s) reassigned`,
      expired: result.expiredCount,
      extended: result.extendedCount,
      reassigned: result.reassigned.length,
      details: result.reassigned,
    });
  } catch (error) {
    console.error('[check-timeouts] Error:', error);
    return NextResponse.json({ error: 'Failed to check timeouts' }, { status: 500 });
  }
}
