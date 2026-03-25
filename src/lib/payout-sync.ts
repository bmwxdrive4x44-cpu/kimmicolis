import { db } from '@/lib/db';

type SyncOptions = {
  actorId: string;
  transporteurId?: string;
};

type MissionWithColis = {
  id: string;
  transporteurId: string;
  completedAt: Date | null;
  colis: {
    id: string;
    status: string;
    deliveredAt: Date | null;
    prixClient: number;
    commissionRelais: number;
    netTransporteur: number;
    relaisDepartId: string;
    trackingNumber: string;
  };
};

function isMissionDelivered(mission: MissionWithColis): boolean {
  return mission.colis.status === 'LIVRE' || mission.completedAt !== null || mission.colis.deliveredAt !== null;
}

function expectedPlatformReverse(prixClient: number, commissionRelais: number): number {
  return Math.max(prixClient - commissionRelais, 0);
}

export async function syncTransporterWallets(options: SyncOptions) {
  const { actorId, transporteurId } = options;

  const missionsRaw = await db.mission.findMany({
    where: transporteurId ? { transporteurId } : undefined,
    include: {
      colis: {
        select: {
          id: true,
          status: true,
          deliveredAt: true,
          prixClient: true,
          commissionRelais: true,
          netTransporteur: true,
          relaisDepartId: true,
          trackingNumber: true,
        },
      },
    },
    orderBy: { assignedAt: 'asc' },
  });

  const missions: MissionWithColis[] = missionsRaw
    .filter((m) => Boolean(m.colis))
    .map((m) => ({
      id: m.id,
      transporteurId: m.transporteurId,
      completedAt: m.completedAt,
      colis: {
        id: m.colis!.id,
        status: m.colis!.status,
        deliveredAt: m.colis!.deliveredAt,
        prixClient: m.colis!.prixClient,
        commissionRelais: m.colis!.commissionRelais,
        netTransporteur: m.colis!.netTransporteur,
        relaisDepartId: m.colis!.relaisDepartId,
        trackingNumber: m.colis!.trackingNumber,
      },
    }));

  const relayCashReversed = await db.relaisCash.findMany({
    where: { type: 'REVERSED' },
    select: { relaisId: true, amount: true },
  });

  const relayPool = new Map<string, number>();
  for (const tx of relayCashReversed) {
    relayPool.set(tx.relaisId, (relayPool.get(tx.relaisId) || 0) + tx.amount);
  }

  const existingWallets = await db.transporterWallet.findMany({
    where: transporteurId ? { transporteurId } : undefined,
    select: {
      transporteurId: true,
      totalWithdrawn: true,
    },
  });

  const withdrawnByTransporter = new Map<string, number>();
  for (const wallet of existingWallets) {
    withdrawnByTransporter.set(wallet.transporteurId, wallet.totalWithdrawn || 0);
  }

  const deliveredMissions = missions
    .filter(isMissionDelivered)
    .sort((a, b) => {
      const aDate = a.colis.deliveredAt?.getTime() || a.completedAt?.getTime() || 0;
      const bDate = b.colis.deliveredAt?.getTime() || b.completedAt?.getTime() || 0;
      return aDate - bDate;
    });

  const fundedMissionIds = new Set<string>();

  for (const mission of deliveredMissions) {
    const relayId = mission.colis.relaisDepartId;
    const needed = expectedPlatformReverse(mission.colis.prixClient, mission.colis.commissionRelais);
    const available = relayPool.get(relayId) || 0;

    if (available >= needed) {
      fundedMissionIds.add(mission.id);
      relayPool.set(relayId, available - needed);
    }
  }

  const byTransporter = new Map<
    string,
    {
      deliveredNet: number;
      fundedDeliveredNet: number;
      inTransitNet: number;
      deliveredCount: number;
      fundedCount: number;
    }
  >();

  for (const mission of missions) {
    const tId = mission.transporteurId;
    const stat = byTransporter.get(tId) || {
      deliveredNet: 0,
      fundedDeliveredNet: 0,
      inTransitNet: 0,
      deliveredCount: 0,
      fundedCount: 0,
    };

    const net = mission.colis.netTransporteur || 0;
    const delivered = isMissionDelivered(mission);

    if (delivered) {
      stat.deliveredNet += net;
      stat.deliveredCount += 1;

      if (fundedMissionIds.has(mission.id)) {
        stat.fundedDeliveredNet += net;
        stat.fundedCount += 1;
      }
    } else {
      stat.inTransitNet += net;
    }

    byTransporter.set(tId, stat);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const [tId, stat] of byTransporter.entries()) {
    const totalWithdrawn = withdrawnByTransporter.get(tId) || 0;

    const blockedDeliveredNet = Math.max(stat.deliveredNet - stat.fundedDeliveredNet, 0);
    const pendingEarnings = Math.max(stat.inTransitNet + blockedDeliveredNet, 0);
    const availableEarnings = Math.max(stat.fundedDeliveredNet - totalWithdrawn, 0);
    const totalEarned = Math.max(stat.deliveredNet, 0);

    const wallet = await db.transporterWallet.upsert({
      where: { transporteurId: tId },
      update: {
        pendingEarnings,
        availableEarnings,
        totalEarned,
      },
      create: {
        transporteurId: tId,
        pendingEarnings,
        availableEarnings,
        totalEarned,
        totalWithdrawn: 0,
      },
    });

    await db.actionLog.create({
      data: {
        userId: actorId,
        entityType: 'TRANSPORTER',
        entityId: tId,
        action: 'WALLET_SYNC_FROM_RELAY_CASH',
        details: JSON.stringify({
          deliveredCount: stat.deliveredCount,
          fundedCount: stat.fundedCount,
          deliveredNet: stat.deliveredNet,
          fundedDeliveredNet: stat.fundedDeliveredNet,
          blockedDeliveredNet,
          inTransitNet: stat.inTransitNet,
          pendingEarnings,
          availableEarnings,
          totalWithdrawn,
        }),
      },
    });

    results.push({
      transporteurId: tId,
      wallet: {
        pendingEarnings: wallet.pendingEarnings,
        availableEarnings: wallet.availableEarnings,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
      },
      stats: {
        deliveredCount: stat.deliveredCount,
        fundedCount: stat.fundedCount,
      },
    });
  }

  return {
    processedCount: results.length,
    results,
  };
}
