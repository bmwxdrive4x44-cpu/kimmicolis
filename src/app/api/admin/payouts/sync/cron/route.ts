import { NextRequest, NextResponse } from 'next/server';
import { syncTransporterWallets } from '@/lib/payout-sync';

/**
 * POST /api/admin/payouts/sync/cron
 * Secure cron endpoint for asynchronous payout wallet synchronization.
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

    const body = await request.json().catch(() => ({}));
    const transporteurId = typeof body?.transporteurId === 'string' ? body.transporteurId : undefined;

    const result = await syncTransporterWallets({
      actorId: 'SYSTEM_CRON',
      transporteurId,
    });

    return NextResponse.json({
      success: true,
      message: 'Payout wallet sync cron completed',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[payout-sync-cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
