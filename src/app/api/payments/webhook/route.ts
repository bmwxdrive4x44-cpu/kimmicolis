import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { matchColisToTrajets } from '@/services/matchingService';
import { applyTransition, canTransition } from '@/lib/parcelStateMachine';

export const runtime = 'nodejs';

type WebhookPayload = {
  eventId?: string;
  paymentId?: string;
  status?: 'COMPLETED' | 'FAILED';
  transactionRef?: string;
  method?: string;
  provider?: string;
  amount?: number;
  currency?: string;
  errorMessage?: string;
};

function amountMatches(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: NextRequest) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const signature = request.headers.get('x-payment-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
  }

  let rawBody = '';
  let payload: WebhookPayload;

  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const paymentId = payload.paymentId;
  const status = payload.status;
  const eventId =
    payload.eventId ||
    request.headers.get('x-payment-event-id') ||
    `${paymentId || 'unknown'}:${status || 'unknown'}:${payload.transactionRef || 'none'}`;

  if (!paymentId || !status) {
    return NextResponse.json({ error: 'Missing paymentId or status' }, { status: 400 });
  }

  const existingEvent = await db.actionLog.findFirst({
    where: {
      scope: 'PAYMENT',
      eventId,
    },
    select: { id: true },
  });

  if (existingEvent) {
    return NextResponse.json({ ok: true, idempotent: true, eventId });
  }

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { colis: true },
  });

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  if (status === 'COMPLETED') {
    if (!payload.transactionRef || payload.transactionRef.trim().length < 6) {
      return NextResponse.json({ error: 'transactionRef is required for COMPLETED status' }, { status: 400 });
    }

    if (typeof payload.amount !== 'number' || !Number.isFinite(payload.amount)) {
      return NextResponse.json({ error: 'amount is required for COMPLETED status' }, { status: 400 });
    }

    if (!payload.currency || payload.currency.trim().length === 0) {
      return NextResponse.json({ error: 'currency is required for COMPLETED status' }, { status: 400 });
    }

    if (!amountMatches(payload.amount, payment.amount)) {
      return NextResponse.json({ error: 'amount mismatch' }, { status: 400 });
    }

    if (payload.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      return NextResponse.json({ error: 'currency mismatch' }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const lockedPayment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { colis: true },
      });

      if (!lockedPayment) {
        throw new Error('Payment not found during transaction');
      }

      if (lockedPayment.status === 'COMPLETED') {
        await tx.actionLog.create({
          data: {
            eventId,
            scope: 'PAYMENT',
            entityType: 'PAYMENT',
            entityId: paymentId,
            action: `PAYMENT_WEBHOOK:${eventId}`,
            details: JSON.stringify({ status, idempotent: true }),
          },
        });
        return;
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          method: payload.method ?? lockedPayment.method,
          transactionRef: payload.transactionRef,
          processedAt: new Date(),
          errorMessage: null,
        },
      });

      if (canTransition(lockedPayment.colis.status, 'READY_FOR_DEPOSIT')) {
        const nextStatus = applyTransition(lockedPayment.colis.status, 'READY_FOR_DEPOSIT');
        await tx.colis.update({
          where: { id: lockedPayment.colisId },
          data: { status: nextStatus },
          select: { id: true, status: true },
        });
        await tx.trackingHistory.create({
          data: {
            colisId: lockedPayment.colisId,
            status: nextStatus,
            notes: `Paiement confirmé via webhook (${payload.provider || 'PSP'})`,
          },
        });
      }

      await tx.actionLog.create({
        data: {
          eventId,
          scope: 'PAYMENT',
          entityType: 'PAYMENT',
          entityId: paymentId,
          action: `PAYMENT_WEBHOOK:${eventId}`,
          details: JSON.stringify({
            status,
            amount: payload.amount,
            currency: payload.currency,
            transactionRef: payload.transactionRef,
          }),
        },
      });
    });

    const refreshedColis = await db.colis.findUnique({
      where: { id: payment.colisId },
      select: {
        id: true,
        villeDepart: true,
        villeArrivee: true,
        clientId: true,
        status: true,
      },
    });

    if (refreshedColis) {
      await matchColisToTrajets(refreshedColis);
    }

    return NextResponse.json({ ok: true, status: 'COMPLETED', eventId });
  }

  await db.$transaction(async (tx) => {
    const lockedPayment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { colis: true },
    });

    if (!lockedPayment) {
      throw new Error('Payment not found during failure transaction');
    }

    if (lockedPayment.status !== 'FAILED') {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          method: payload.method ?? lockedPayment.method,
          errorMessage: payload.errorMessage || `Provider ${payload.provider || 'unknown'} reported failure`,
        },
      });
    }

    if (canTransition(lockedPayment.colis.status, 'CREATED')) {
      const nextStatus = applyTransition(lockedPayment.colis.status, 'CREATED');
      await tx.colis.update({
        where: { id: lockedPayment.colisId },
        data: { status: nextStatus },
        select: { id: true, status: true },
      });
      await tx.trackingHistory.create({
        data: {
          colisId: lockedPayment.colisId,
          status: nextStatus,
          notes: `Paiement échoué via webhook (${payload.provider || 'PSP'})`,
        },
      });
    }

    await tx.actionLog.create({
      data: {
        eventId,
        scope: 'PAYMENT',
        entityType: 'PAYMENT',
        entityId: paymentId,
        action: `PAYMENT_WEBHOOK:${eventId}`,
        details: JSON.stringify({
          status,
          errorMessage: payload.errorMessage || null,
        }),
      },
    });
  });

  return NextResponse.json({ ok: true, status: 'FAILED', eventId });
}
