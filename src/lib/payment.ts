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

// In-memory payment store (in production: use dedicated payment service)
const paymentStore = new Map<string, IPayment>();

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

    // Create payment object
    const payment: IPayment = {
      id: generatePaymentId(),
      colisId,
      clientId,
      amount,
      currency: 'DZD', // Algerian Dinar
      status: 'PENDING',
      method: paymentMethod,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min timeout
    };

    // Store payment
    paymentStore.set(payment.id, payment);

    // Return payment object + URL to payment gateway
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
  const payment = paymentStore.get(paymentId);
  if (!payment) return null;

  // Check if expired (15 min timeout)
  if (new Date() > payment.expiresAt) {
    payment.status = 'FAILED';
    payment.errorMessage = 'Payment session expired';
    payment.updatedAt = new Date();
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
  const payment = paymentStore.get(paymentId);
  if (!payment) {
    return { success: false, error: `Payment ${paymentId} not found` };
  }

  // Simulate network delay (2-5 seconds)
  const delay = Math.random() * 3000 + 2000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  try {
    // Simulate success/failure based on rate
    const isSuccess = Math.random() < successRate;

    if (isSuccess) {
      payment.status = 'PROCESSING';
      payment.transactionRef = generateTransactionRef();
      payment.updatedAt = new Date();
      paymentStore.set(paymentId, payment);

      // Simulate another delay before final confirmation
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Update to COMPLETED
      payment.status = 'COMPLETED';
      payment.processedAt = new Date();
      payment.updatedAt = new Date();
      paymentStore.set(paymentId, payment);

      // Update colis status to PAID
      await db.colis.update({
        where: { id: payment.colisId },
        data: { 
          status: 'PAID',
          updatedAt: new Date(),
        },
      });

      return { success: true, payment };
    } else {
      // Simulate payment failure
      const failureReasons = [
        'Insufficient funds',
        'Card declined',
        'Invalid card details',
        'Transaction timeout',
        'Issuer rejected transaction',
      ];

      payment.status = 'FAILED';
      payment.errorMessage = failureReasons[Math.floor(Math.random() * failureReasons.length)];
      payment.updatedAt = new Date();
      paymentStore.set(paymentId, payment);

      return {
        success: false,
        payment,
        error: payment.errorMessage,
      };
    }
  } catch (error) {
    payment.status = 'FAILED';
    payment.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    payment.updatedAt = new Date();
    paymentStore.set(paymentId, payment);

    return {
      success: false,
      payment,
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
  const payment = paymentStore.get(paymentId);
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
    payment.status = 'REFUNDED';
    payment.errorMessage = `Refunded: ${reason}`;
    payment.updatedAt = new Date();
    paymentStore.set(paymentId, payment);

    // Revert colis to CREATED (unpaid)
    await db.colis.update({
      where: { id: payment.colisId },
      data: { status: 'CREATED' },
    });

    return { success: true, payment };
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
  const payments: IPayment[] = [];
  paymentStore.forEach((payment) => {
    if (payment.clientId === clientId) {
      payments.push(payment);
    }
  });
  return payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
  let total = 0;
  let amount = 0;
  let completed = 0;
  let failed = 0;
  let pending = 0;

  paymentStore.forEach((payment) => {
    total++;
    amount += payment.amount;
    if (payment.status === 'COMPLETED') completed++;
    else if (payment.status === 'FAILED') failed++;
    else if (payment.status === 'PENDING' || payment.status === 'PROCESSING') pending++;
  });

  return {
    totalPayments: total,
    totalAmount: amount,
    completed,
    failed,
    pending,
  };
}
