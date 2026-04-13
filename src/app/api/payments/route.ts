import { NextRequest, NextResponse } from 'next/server';
import {
  createPayment,
  getPaymentStatus,
  processPayment,
  refundPayment,
  getClientPayments,
  getPaymentStats,
} from '@/lib/payment';
import { requireRole, hasAccess } from '@/lib/rbac';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { createHostedCheckout, isOnlineMethod, isRealPspConfigured } from '@/lib/psp';
import { db } from '@/lib/db';

/**
 * GET /api/payments
 * List payments for authenticated user or admin
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'ADMIN', 'ENSEIGNE']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const clientId = searchParams.get('clientId');
    const config = searchParams.get('config');

    if (config === '1') {
      const provider = process.env.PAYMENT_PROVIDER || 'SIM';
      const onlinePaymentAvailable = isRealPspConfigured() || provider === 'SIM';
      const availableMethods = isRealPspConfigured()
        ? provider === 'SATIM'
          ? ['CIB', 'EDAHABIA', 'BARIDI_MOB']
          : ['STRIPE_TEST']
        : ['CIB', 'EDAHABIA', 'BARIDI_MOB', 'STRIPE_TEST'];

      return NextResponse.json({
        onlinePaymentAvailable,
        availableMethods,
        simulationMode: !isRealPspConfigured(),
        provider,
        environment: process.env.NODE_ENV || 'development',
      });
    }

    if (paymentId) {
      // Get specific payment
      const payment = await getPaymentStatus(paymentId);
      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }

      // Verify access (client sees own, admin sees all)
      if (
        auth.payload.role !== 'ADMIN' &&
        !hasAccess(auth.payload, payment.clientId, [])
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json(payment);
    }

    if (clientId) {
      // List client's payments (admin can see all, user sees own)
      if (
        auth.payload.role !== 'ADMIN' &&
        !hasAccess(auth.payload, clientId, [])
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const payments = await getClientPayments(clientId);
      return NextResponse.json(payments);
    }

    // Admin stats
    if (auth.payload.role === 'ADMIN') {
      const stats = await getPaymentStats();
      return NextResponse.json(stats);
    }

    // Default: return user's own payments
    const payments = await getClientPayments(auth.payload.id);
    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments
 * Create a new payment session
 */
export async function POST(request: NextRequest) {
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.strict);
  if (rateCheck.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  const auth = await requireRole(request, ['CLIENT', 'ENSEIGNE']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisId, amount, paymentMethod = 'SIM_STANDARD' } = body;

    if (!colisId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: colisId, amount' },
        { status: 400 }
      );
    }

    const result = await createPayment(
      colisId,
      auth.payload.id,
      amount,
      paymentMethod
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        paymentId: result.payment?.id,
        amount: result.payment?.amount,
        currency: result.payment?.currency,
        paymentUrl: result.paymentUrl,
        status: result.payment?.status,
        expiresAt: result.payment?.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/payments
 * Process or refund a payment
 */
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'ADMIN', 'ENSEIGNE']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { paymentId, action, reason, method } = body;

    if (!paymentId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentId, action' },
        { status: 400 }
      );
    }

    // Verify payment exists and user has access
    let payment = await getPaymentStatus(paymentId);
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    if (
      auth.payload.role !== 'ADMIN' &&
      !hasAccess(auth.payload, payment.clientId, [])
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Handle actions
    if (action === 'process') {
      const VALID_METHODS = ['CIB', 'EDAHABIA', 'BARIDI_MOB', 'STRIPE_TEST', 'SIM_STANDARD'];
      const paymentMethod = method && VALID_METHODS.includes(method) ? method : undefined;

      // If the session expired, transparently create a fresh payment session.
      if (payment.status === 'FAILED' && payment.errorMessage === 'Payment session expired') {
        const recreated = await createPayment(
          payment.colisId,
          payment.clientId,
          payment.amount,
          paymentMethod || payment.method || 'SIM_STANDARD'
        );

        if (!recreated.success || !recreated.payment) {
          return NextResponse.json(
            { error: recreated.error || 'Impossible de recréer une session de paiement' },
            { status: 400 }
          );
        }

        payment = recreated.payment;
      }

      const isSimulatedOnline = Boolean(paymentMethod && isOnlineMethod(paymentMethod) && !isRealPspConfigured());

      if (paymentMethod && isOnlineMethod(paymentMethod)) {
        if (isRealPspConfigured()) {
          const hosted = await createHostedCheckout({
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            method: paymentMethod,
            clientId: payment.clientId,
          });

          await db.payment.update({
            where: { id: payment.id },
            data: {
              status: payment.status === 'PENDING' ? 'PROCESSING' : payment.status,
              method: paymentMethod,
              errorMessage: hosted.providerSessionId
                ? `PSP_SESSION:${hosted.providerSessionId}`
                : payment.errorMessage,
            },
          });

          return NextResponse.json({
            message: 'Redirection vers PSP',
            redirectUrl: hosted.checkoutUrl,
            paymentId: payment.id,
            provider: process.env.PAYMENT_PROVIDER || 'SATIM',
            mode: 'HOSTED_CHECKOUT',
          });
        }

        if (!isSimulatedOnline && process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            {
              error: 'Le paiement en ligne est actuellement indisponible. Vous pouvez regler ce colis au relais de depart.',
              code: 'PSP_NOT_CONFIGURED',
            },
            { status: 400 }
          );
        }
      }

      const result = await processPayment(payment.id, isSimulatedOnline ? 0.98 : 0.95, paymentMethod);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error, payment: result.payment },
          { status: 400 }
        );
      }
      return NextResponse.json({
        message: isSimulatedOnline ? 'Paiement simulé traité avec succès' : 'Payment processed successfully',
        mode: isSimulatedOnline ? 'SIMULATED_PSP' : 'DIRECT_PROCESSING',
        payment: result.payment,
      });
    }

    if (action === 'refund') {
      const result = await refundPayment(paymentId, reason || 'No reason provided');
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
      return NextResponse.json({
        message: 'Payment refunded successfully',
        payment: result.payment,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}
