/**
 * Advanced Payment Simulation Engine
 * Simulates real payment processing with:
 * - Payment ID generation
 * - Status tracking (PENDING, PROCESSING, COMPLETED, FAILED)
 * - Network delay simulation
 * - Success/failure randomization
 * - Transaction logging
 */

import { db } from './db';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface IPayment {
  id: string;
  colisId: string;
  clientId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: string; // 'CARD', 'EDAHABIA', 'BANK_TRANSFER', etc.
  transactionRef?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  expiresAt: Date;
}

type PaymentDelegate = {
  findFirst(args: Record<string, unknown>): Promise<IPayment | null>;
  findUnique(args: Record<string, unknown>): Promise<IPayment | null>;
  create(args: Record<string, unknown>): Promise<IPayment>;
  update(args: Record<string, unknown>): Promise<IPayment>;
  findMany(args: Record<string, unknown>): Promise<IPayment[]>;
  count(args?: Record<string, unknown>): Promise<number>;
  aggregate(args: Record<string, unknown>): Promise<{ _sum: { amount: number | null } }>;
};

// VS Code garde parfois un type PrismaClient périmé après ajout d'un nouveau modèle.
// Cette vue locale évite les faux diagnostics tant que le client généré runtime est à jour.
const paymentDb = db as typeof db & { payment: PaymentDelegate };

/**
 * Generate unique payment ID
 */
function generatePaymentId(): string {
  return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate transaction reference (unique per payment)
 */
function generateTransactionRef(): string {
  return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new payment (returns URL to payment form/gateway)
 */
export async function createPayment(
  colisId: string,
  clientId: string,
  amount: number,
  paymentMethod: string = 'SIM_STANDARD'
): Promise<{
  success: boolean;
  payment?: IPayment;
  paymentUrl?: string;
  error?: string;
}> {
  try {
    // Verify colis exists
    const colis = await db.colis.findUnique({ where: { id: colisId } });
    if (!colis) {
      return { success: false, error: 'Colis not found' };
    }

    // Verify client matches
    if (colis.clientId !== clientId) {
      return { success: false, error: 'Client mismatch' };
    }

    if (colis.status !== 'CREATED') {
      return { success: false, error: `Parcel cannot be paid with status ${colis.status}` };
    }

    if (amount !== colis.prixClient) {
      return { success: false, error: 'Amount mismatch' };
    }

    const existingActivePayment = await paymentDb.payment.findFirst({
      where: {
        colisId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingActivePayment) {
      return {
        success: true,
        payment: existingActivePayment,
        paymentUrl: `/payment/checkout?paymentId=${existingActivePayment.id}`,
      };
    }

    const completedPayment = await paymentDb.payment.findFirst({
      where: {
        colisId,
        status: 'COMPLETED',
      },
    });

    if (completedPayment) {
      return { success: false, error: 'Parcel already paid' };
    }

    // Create payment object
    const payment = await paymentDb.payment.create({
      data: {
        id: generatePaymentId(),
        colisId,
        clientId,
        amount,
        currency: 'DZD',
        status: 'PENDING',
        method: paymentMethod,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    return {
      success: true,
      payment,
      paymentUrl: `/payment/checkout?paymentId=${payment.id}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment',
    };
  }
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<IPayment | null> {
  const payment = await paymentDb.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) return null;

  if (
    new Date() > payment.expiresAt &&
    (payment.status === 'PENDING' || payment.status === 'PROCESSING')
  ) {
    return paymentDb.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        errorMessage: 'Payment session expired',
      },
    });
  }

  return payment;
}

/**
 * Simulate payment processing
 * In real scenario: webhook from payment provider would call this
 */
export async function processPayment(
  paymentId: string,
  successRate: number = 0.95 // 95% success by default
): Promise<{
  success: boolean;
  payment?: IPayment;
  error?: string;
}> {
  const payment = await paymentDb.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return { success: false, error: `Payment ${paymentId} not found` };
  }

  if (payment.status === 'COMPLETED') {
    return { success: true, payment };
  }

  if (payment.status === 'REFUNDED') {
    return { success: false, payment, error: 'Refunded payment cannot be processed again' };
  }

  if (payment.status === 'FAILED' && new Date() > payment.expiresAt) {
    return { success: false, payment, error: 'Payment session expired' };
  }

  // Simulate network delay (2-5 seconds)
  const delay = Math.random() * 3000 + 2000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  try {
    const isSuccess = Math.random() < successRate;

    if (isSuccess) {
      await paymentDb.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PROCESSING',
          transactionRef: generateTransactionRef(),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

      const completedPayment = await paymentDb.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          errorMessage: null,
        },
      });

      await db.colis.update({
        where: { id: payment.colisId },
        data: {
          status: 'PAID',
          updatedAt: new Date(),
        },
      });

      return { success: true, payment: completedPayment };
    }

    const failureReasons = [
      'Insufficient funds',
      'Card declined',
      'Invalid card details',
      'Transaction timeout',
      'Issuer rejected transaction',
    ];

    const failedPayment = await paymentDb.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        errorMessage: failureReasons[Math.floor(Math.random() * failureReasons.length)],
      },
    });

    return {
      success: false,
      payment: failedPayment,
      error: failedPayment.errorMessage || 'Payment failed',
    };
  } catch (error) {
    const failedPayment = await paymentDb.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      payment: failedPayment,
      error: 'Payment processing failed',
    };
  }
}

/**
 * Refund payment (mark as REFUNDED, reverse to colis)
 */
export async function refundPayment(
  paymentId: string,
  reason: string = 'Customer request'
): Promise<{
  success: boolean;
  payment?: IPayment;
  error?: string;
}> {
  const payment = await paymentDb.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return { success: false, error: 'Payment not found' };
  }

  if (payment.status !== 'COMPLETED') {
    return {
      success: false,
      error: `Cannot refund payment with status ${payment.status}`,
    };
  }

  try {
    const refundedPayment = await paymentDb.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        errorMessage: `Refunded: ${reason}`,
      },
    });

    await db.colis.update({
      where: { id: payment.colisId },
      data: { status: 'CREATED' },
    });

    return { success: true, payment: refundedPayment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Refund failed',
    };
  }
}

/**
 * Get all payments by client (for dashboard)
 */
export async function getClientPayments(clientId: string): Promise<IPayment[]> {
  return paymentDb.payment.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Export payment stats for admin
 */
export async function getPaymentStats(): Promise<{
  totalPayments: number;
  totalAmount: number;
  completed: number;
  failed: number;
  pending: number;
}> {
  const [totalPayments, aggregate, completed, failed, pending] = await Promise.all([
    paymentDb.payment.count(),
    paymentDb.payment.aggregate({ _sum: { amount: true } }),
    paymentDb.payment.count({ where: { status: 'COMPLETED' } }),
    paymentDb.payment.count({ where: { status: 'FAILED' } }),
    paymentDb.payment.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
  ]);

  return {
    totalPayments,
    totalAmount: aggregate._sum.amount || 0,
    completed,
    failed,
    pending,
  };
}
