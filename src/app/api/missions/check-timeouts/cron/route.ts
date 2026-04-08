import { NextRequest, NextResponse } from 'next/server';
import { processMissionAssignmentTimeouts } from '@/lib/mission-timeout';

/**
 * POST /api/missions/check-timeouts/cron
 * Secure cron endpoint for mission timeout checks.
 *
 * Security:
 * - Header required: x-cron-secret
 * - Must equal process.env.CRON_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const providedSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Server misconfiguration: CRON_SECRET is missing' },
        { status: 500 }
      );
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processMissionAssignmentTimeouts({ actorId: null });

    return NextResponse.json({
      success: true,
      message: 'Mission timeout cron completed',
      expired: result.expiredCount,
      extended: result.extendedCount,
      reassigned: result.reassigned.length,
      details: result.reassigned,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[mission-timeout-cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
