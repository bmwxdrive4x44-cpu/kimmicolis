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

/**
 * GET /api/payments
 * List payments for authenticated user or admin
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const clientId = searchParams.get('clientId');

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
  const auth = await requireRole(request, ['CLIENT']);
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
  const auth = await requireRole(request, ['CLIENT', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { paymentId, action, reason } = body;

    if (!paymentId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentId, action' },
        { status: 400 }
      );
    }

    // Verify payment exists and user has access
    const payment = await getPaymentStatus(paymentId);
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
      const result = await processPayment(paymentId);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error, payment: result.payment },
          { status: 400 }
        );
      }
      return NextResponse.json({
        message: 'Payment processed successfully',
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
