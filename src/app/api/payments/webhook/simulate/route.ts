import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { matchColisToTrajets } from '@/services/matchingService';
import { applyTransition, canTransition } from '@/lib/parcelStateMachine';

export const runtime = 'nodejs';

function isDevAllowed() {
  return process.env.NODE_ENV !== 'production';
}

export async function POST(request: NextRequest) {
  if (!isDevAllowed()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const paymentIds = Array.isArray(body?.paymentIds) ? body.paymentIds : [];
    const status = body?.status === 'FAILED' ? 'FAILED' : 'COMPLETED';
    const method = typeof body?.method === 'string' ? body.method : 'SIM_STANDARD';

    if (!paymentIds.length) {
      return NextResponse.json({ error: 'paymentIds requis' }, { status: 400 });
    }

    const payments = await db.payment.findMany({
      where: { id: { in: paymentIds } },
      include: {
        colis: {
          select: {
            id: true,
            lineId: true,
            villeDepart: true,
            villeArrivee: true,
            clientId: true,
            status: true,
          },
        },
      },
    });

    if (!payments.length) {
      return NextResponse.json({ error: 'Aucun payment trouve' }, { status: 404 });
    }

    const results: Array<{ paymentId: string; status: string; matched?: boolean }> = [];

    for (const payment of payments) {
      if (status === 'FAILED') {
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            method,
            errorMessage: 'Simulated failure from dev endpoint',
          },
        });
        results.push({ paymentId: payment.id, status: 'FAILED' });
        continue;
      }

      await db.$transaction(async (tx) => {
        const lockedPayment = await tx.payment.findUnique({
          where: { id: payment.id },
          include: { colis: true },
        });

        if (!lockedPayment) return;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            method,
            transactionRef: payment.transactionRef || `SIM-${Date.now()}-${payment.id.slice(-8)}`,
            processedAt: new Date(),
            errorMessage: null,
          },
        });

        if (canTransition(lockedPayment.colis.status, 'READY_FOR_DEPOSIT')) {
          await tx.colis.update({
            where: { id: payment.colis.id },
            data: { status: applyTransition(lockedPayment.colis.status, 'READY_FOR_DEPOSIT') },
          });
        }
      });

      let matched = false;
      try {
        const matchResult = await matchColisToTrajets({
          id: payment.colis.id,
          lineId: payment.colis.lineId,
          villeDepart: payment.colis.villeDepart,
          villeArrivee: payment.colis.villeArrivee,
          clientId: payment.colis.clientId,
          status: 'READY_FOR_DEPOSIT',
        });
        matched = Boolean(matchResult.success);
      } catch {
        matched = false;
      }

      results.push({ paymentId: payment.id, status: 'COMPLETED', matched });
    }

    return NextResponse.json({
      success: true,
      simulated: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Simulation failed' },
      { status: 500 }
    );
  }
}
