import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';

/**
 * POST /api/loyalty/evaluate/cron
 * Recalcule l'eligibilite implicite pour les clients actifs.
 * Securite: header x-cron-secret = process.env.CRON_SECRET
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
    const limit = Math.max(1, Math.min(1000, Number(body?.limit ?? 300)));

    const clients = await db.user.findMany({
      where: { role: 'CLIENT', isActive: true },
      select: { id: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    let processed = 0;
    let failed = 0;

    for (const client of clients) {
      try {
        await evaluateImplicitProEligibility(client.id);
        processed += 1;
      } catch (error) {
        failed += 1;
        console.error('[loyalty-evaluate-cron] client failed', client.id, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Implicit loyalty evaluation completed',
      processed,
      failed,
      total: clients.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[loyalty-evaluate-cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
