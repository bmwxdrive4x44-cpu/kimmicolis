import { db } from '@/lib/db';

/**
 * Wallet Escrow Management
 * 
 * Flow:
 * 1. Mission assigned: 50% of transporteur earnings → escrowedEarnings
 * 2. Mission completed (LIVRE): Remaining 50% released → availableEarnings
 * 3. Penalties applied: Deducted from escrowed then available
 */

export interface WalletUpdateInput {
  transporteurId: string;
  missionEarnings: number;
  eventType: 'MISSION_ASSIGNED' | 'MISSION_COMPLETED' | 'PENALTY_APPLIED' | 'PENALTY_WAIVED';
  missionId?: string;
  colisId?: string;
  notes?: string;
}

/**
 * When mission is assigned: move 50% to escrow
 * Keeps 50% pending until delivery confirmed
 */
export async function escrowMissionEarnings(
  transporteurId: string,
  missionEarnings: number,
  missionId: string,
  colisId: string
) {
  const escrowAmount = missionEarnings * 0.5;

  const wallet = await db.transporterWallet.upsert({
    where: { transporteurId },
    update: {
      escrowedEarnings: { increment: escrowAmount },
      pendingEarnings: { increment: missionEarnings * 0.5 },
    },
    create: {
      transporteurId,
      escrowedEarnings: escrowAmount,
      pendingEarnings: missionEarnings * 0.5,
    },
  });

  return wallet;
}

/**
 * When mission completed (LIVRE): release escrowed earnings
 */
export async function releaseMissionEarnings(
  transporteurId: string,
  missionEarnings: number,
  missionId: string
) {
  const releaseAmount = missionEarnings * 0.5;

  const wallet = await db.transporterWallet.update({
    where: { transporteurId },
    data: {
      escrowedEarnings: { decrement: releaseAmount },
      availableEarnings: { increment: releaseAmount },
      totalEarned: { increment: missionEarnings }, // Add full amount to total
    },
  });

  return wallet;
}

/**
 * Apply penalty to wallet: deduct from escrow first, then available
 */
export async function applyPenalty(
  transporteurId: string,
  penaltyAmount: number,
  reason: string,
  colisId?: string
): Promise<{
  success: boolean;
  wallet: any;
  penaltyId: string;
}> {
  // Create penalty record
  const penalty = await (db as any).transporterPenalty.create({
    data: {
      transporteurId,
      colisId,
      type: reason.toUpperCase(),
      amount: penaltyAmount,
      reason,
      status: 'PENDING',
    },
  });

  // Get current wallet
  let wallet = await db.transporterWallet.findUnique({
    where: { transporteurId },
  });

  if (!wallet) {
    wallet = await db.transporterWallet.create({
      data: { transporteurId },
    });
  }

  // Deduct from escrow first
  let deductFromEscrow = Math.min(penaltyAmount, wallet.escrowedEarnings);
  let deductFromAvailable = penaltyAmount - deductFromEscrow;

  // Update wallet
  const updatedWallet = await db.transporterWallet.update({
    where: { transporteurId },
    data: {
      escrowedEarnings: { decrement: deductFromEscrow },
      availableEarnings: { decrement: Math.max(0, deductFromAvailable) },
      totalPenalties: { increment: penaltyAmount },
    },
  });

  // Mark penalty as applied
  await (db as any).transporterPenalty.update({
    where: { id: penalty.id },
    data: { 
      status: 'APPLIED',
      appliedAt: new Date(),
    },
  });

  return {
    success: true,
    wallet: updatedWallet,
    penaltyId: penalty.id,
  };
}

/**
 * Calculate penalties based on parcel status & timing
 */
export async function calculateAutoPenalties(colis: any): Promise<
  Array<{ type: string; amount: number; reason: string }>
> {
  const penalties: Array<{ type: string; amount: number; reason: string }> = [];

  // Get related mission
  const mission = await (db as any).mission.findFirst({
    where: { colisId: colis.id },
  });

  if (!mission) return penalties;

  // Late delivery penalty (if expectedDeliveryAt passed)
  if (colis.expectedDeliveryAt && new Date() > colis.expectedDeliveryAt) {
    const hoursLate = Math.floor(
      (new Date().getTime() - colis.expectedDeliveryAt.getTime()) / (1000 * 60 * 60)
    );
    if (hoursLate > 0) {
      // 5% per hour late, max 30% of earnings
      const penaltyPercent = Math.min(hoursLate * 5, 30);
      const penaltyAmount = (colis.netTransporteur * penaltyPercent) / 100;
      penalties.push({
        type: 'LATE_DELIVERY',
        amount: penaltyAmount,
        reason: `Late delivery: ${hoursLate}h late (${penaltyPercent}% of earnings)`,
      });
    }
  }

  // Lost parcel penalty
  if (colis.status === 'COLIS_PERDU') {
    penalties.push({
      type: 'LOST_PARCEL',
      amount: colis.netTransporteur * 1.0, // 100% deduction
      reason: 'Parcel declared lost',
    });
  }

  // Damaged parcel penalty
  if (colis.status === 'COLIS_ENDOMMAGE') {
    penalties.push({
      type: 'DAMAGED_PARCEL',
      amount: (colis.netTransporteur * 50) / 100, // 50% deduction
      reason: 'Parcel damaged during transport',
    });
  }

  // Cancellation penalty (if mission cancelled after relais handoff)
  if (colis.status === 'ANNULE' && mission && mission.relaisConfirmed) {
    penalties.push({
      type: 'CANCELLATION',
      amount: (colis.netTransporteur * 50) / 100, // 50% deduction
      reason: 'Mission cancelled after acceptance',
    });
  }

  return penalties;
}

/**
 * Waive penalty (admin action)
 */
export async function waivePenalty(
  penaltyId: string,
  adminUserId: string,
  reason: string
) {
  const penalty = await (db as any).transporterPenalty.findUnique({
    where: { id: penaltyId },
  });

  if (!penalty) throw new Error('Penalty not found');

  // Refund penalty amount
  if (penalty.status === 'APPLIED') {
    await db.transporterWallet.update({
      where: { transporteurId: penalty.transporteurId },
      data: {
        totalPenalties: { decrement: penalty.amount },
        availableEarnings: { increment: penalty.amount },
      },
    });
  }

  // Mark penalty as waived
  const waived = await (db as any).transporterPenalty.update({
    where: { id: penaltyId },
    data: {
      status: 'WAIVED',
      waivedAt: new Date(),
      waivedBy: adminUserId,
      waiveReason: reason,
    },
  });

  return waived;
}

/**
 * Get wallet summary
 */
export async function getWalletSummary(transporteurId: string) {
  let wallet = await db.transporterWallet.findUnique({
    where: { transporteurId },
  });

  if (!wallet) {
    wallet = await db.transporterWallet.create({
      data: { transporteurId },
    });
  }

  const totalLocked = wallet.escrowedEarnings + wallet.pendingEarnings;

  return {
    pending: wallet.pendingEarnings,
    escrowed: wallet.escrowedEarnings,
    available: wallet.availableEarnings,
    totalLocked,
    totalEarned: wallet.totalEarned,
    totalWithdrawn: wallet.totalWithdrawn,
    totalPenalties: wallet.totalPenalties,
    balance: wallet.availableEarnings - wallet.totalWithdrawn,
  };
}
