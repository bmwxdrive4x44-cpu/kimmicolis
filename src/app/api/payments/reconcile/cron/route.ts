import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/payments/reconcile/cron
 * Reconcile stale payment sessions asynchronously:
 * - PENDING / PROCESSING payments past expiresAt -> FAILED
 * - Move colis back to CREATED when still in PENDING_PAYMENT
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

    const now = new Date();

    const stalePayments = await db.payment.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        colisId: true,
        status: true,
        expiresAt: true,
      },
      take: 500,
      orderBy: { expiresAt: 'asc' },
    });

    if (stalePayments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stale payments to reconcile',
        reconciled: 0,
        timestamp: now.toISOString(),
      });
    }

    let reconciled = 0;
    let colisReset = 0;

    for (const payment of stalePayments) {
      await db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Payment session expired (cron reconcile)',
          },
        });

        const colis = await tx.colis.findUnique({
          where: { id: payment.colisId },
          select: { status: true },
        });

        if (colis?.status === 'PENDING_PAYMENT') {
          await tx.colis.update({
            where: { id: payment.colisId },
            data: { status: 'CREATED', updatedAt: new Date() },
            select: { id: true, status: true },
          });
          colisReset += 1;
        }

        await tx.actionLog.create({
          data: {
            userId: null,
            entityType: 'COLIS',
            entityId: payment.colisId,
            action: 'PAYMENT_RECONCILE_EXPIRED',
            details: JSON.stringify({
              paymentId: payment.id,
              previousStatus: payment.status,
              expiresAt: payment.expiresAt,
            }),
          },
        });
      });

      reconciled += 1;
    }

    return NextResponse.json({
      success: true,
      message: 'Payment reconcile cron completed',
      reconciled,
      colisReset,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[payment-reconcile-cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
