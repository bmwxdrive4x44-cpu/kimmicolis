import { db } from '@/lib/db';

const REVERSAL_DEADLINE_HOURS = 72;
const WARNING_OUTSTANDING_AMOUNT = 20000;
const SUSPEND_OUTSTANDING_AMOUNT = 50000;
const ARRIVAL_HANDOVER_WARNING_COUNT = 3;
const ARRIVAL_HANDOVER_SUSPEND_COUNT = 6;
const ARRIVAL_HANDOVER_STALE_HOURS = 48;
const ARRIVAL_ISSUE_WARNING_RATE = 0.25;
const ARRIVAL_ISSUE_SUSPEND_RATE = 0.4;

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

function getCautionReleaseMilestone(activationDate: Date, now: Date = new Date()) {
  const elapsedMs = now.getTime() - activationDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  if (elapsedDays >= 180) return { status: 'FULLY_RELEASED', percent: 100 as const };
  if (elapsedDays >= 90) return { status: 'PARTIAL_RELEASED', percent: 66 as const };
  if (elapsedDays >= 30) return { status: 'PARTIAL_RELEASED', percent: 33 as const };

  return { status: 'BLOCKED', percent: 0 as const };
}

async function createSanctionIfNotExists({
  relaisId,
  reason,
  type,
  reduction,
  appliedBy,
  notes,
}: {
  relaisId: string;
  reason: string;
  type: string;
  reduction?: number;
  appliedBy: string;
  notes: string;
}) {
  const existing = await db.relaisSanction.findFirst({
    where: {
      relaisId,
      reason,
      type,
      endDate: null,
    },
  });

  if (existing) return existing;

  return db.relaisSanction.create({
    data: {
      relaisId,
      reason,
      type,
      reduction,
      appliedBy,
      notes,
    },
  });
}

export async function processRelaisCompliance(relaisId: string, actorId: string) {
  const now = new Date();

  const relais = await db.relais.findUnique({
    where: { id: relaisId },
    include: {
      audits: {
        orderBy: { auditDate: 'desc' },
        take: 2,
      },
      sanctions: {
        where: {
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
      },
    },
  });

  if (!relais) {
    return { relaisId, status: 'NOT_FOUND' as const };
  }

  const updates: Record<string, any> = {};
  const actions: string[] = [];
  let nextScore = relais.complianceScore;

  const latestAudit = relais.audits[0];
  const previousAudit = relais.audits[1];

  if (latestAudit) {
    if (latestAudit.status === 'FLAGGED') {
      nextScore -= 8;
      actions.push('score:-8(flagged_audit)');
    } else if (Math.abs(latestAudit.variance) <= 2 && latestAudit.discrepancies === 0) {
      nextScore += 2;
      actions.push('score:+2(clean_audit)');
    }

    if (
      latestAudit.status === 'FLAGGED' &&
      previousAudit?.status === 'FLAGGED' &&
      relais.operationalStatus !== 'SUSPENDU'
    ) {
      await createSanctionIfNotExists({
        relaisId,
        reason: 'HIGH_VARIANCE',
        type: 'SUSPENSION',
        appliedBy: actorId,
        notes: 'Auto-suspension: two consecutive flagged monthly audits',
      });

      updates.operationalStatus = 'SUSPENDU';
      updates.suspensionReason = 'Two consecutive flagged audits';
      updates.suspendedAt = now;
      nextScore -= 20;
      actions.push('sanction:SUSPENSION(two_flagged_audits)');
    }
  }

  const lastReversed = await db.relaisCash.findFirst({
    where: {
      relaisId,
      type: 'REVERSED',
    },
    orderBy: { createdAt: 'desc' },
  });

  const outstandingAmount = Math.max(0, (relais.cashCollected ?? 0) - (relais.cashReversed ?? 0));
  const hasOverdueReversal =
    outstandingAmount > 0 &&
    (!lastReversed || now.getTime() - lastReversed.createdAt.getTime() > REVERSAL_DEADLINE_HOURS * 60 * 60 * 1000);

  if (hasOverdueReversal) {
    if (outstandingAmount >= SUSPEND_OUTSTANDING_AMOUNT) {
      await createSanctionIfNotExists({
        relaisId,
        reason: 'NON_REVERSAL',
        type: 'SUSPENSION',
        appliedBy: actorId,
        notes: `Auto-suspension: outstanding ${outstandingAmount} for > ${REVERSAL_DEADLINE_HOURS}h`,
      });

      updates.operationalStatus = 'SUSPENDU';
      updates.suspensionReason = `Cash non-reversal > ${REVERSAL_DEADLINE_HOURS}h`;
      updates.suspendedAt = now;
      nextScore -= 25;
      actions.push('sanction:SUSPENSION(non_reversal)');
    } else if (outstandingAmount >= WARNING_OUTSTANDING_AMOUNT) {
      await createSanctionIfNotExists({
        relaisId,
        reason: 'NON_REVERSAL',
        type: 'WARNING',
        appliedBy: actorId,
        notes: `Auto-warning: outstanding ${outstandingAmount} for > ${REVERSAL_DEADLINE_HOURS}h`,
      });

      nextScore -= 8;
      actions.push('sanction:WARNING(non_reversal)');
    }
  }

  // Arrival-relay reliability checks (no direct commission incentive on destination side)
  // 1) parcels stuck too long at destination relay after transporter handover
  // 2) high issue ratio at destination (RET0UR/EN_DISPUTE)
  const staleArrivalCutoff = new Date(now.getTime() - ARRIVAL_HANDOVER_STALE_HOURS * 60 * 60 * 1000);

  const [staleArrivalPending, arrivalSummary] = await Promise.all([
    db.colis.count({
      where: {
        relaisArriveeId: relaisId,
        status: 'ARRIVE_RELAIS_DESTINATION',
        updatedAt: { lte: staleArrivalCutoff },
      },
    }),
    db.colis.groupBy({
      by: ['status'],
      where: {
        relaisArriveeId: relaisId,
      },
      _count: { _all: true },
    }),
  ]);

  const arrivalCounts = arrivalSummary.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const deliveredArrival = arrivalCounts['LIVRE'] || 0;
  const issueArrival = (arrivalCounts['RETOUR'] || 0) + (arrivalCounts['EN_DISPUTE'] || 0);
  const totalResolvedArrival = deliveredArrival + issueArrival;
  const arrivalIssueRate = totalResolvedArrival > 0 ? issueArrival / totalResolvedArrival : 0;

  if (staleArrivalPending >= ARRIVAL_HANDOVER_SUSPEND_COUNT) {
    await createSanctionIfNotExists({
      relaisId,
      reason: 'OPERATOR_ERROR',
      type: 'SUSPENSION',
      appliedBy: actorId,
      notes: `Auto-suspension: ${staleArrivalPending} parcels pending destination handover for > ${ARRIVAL_HANDOVER_STALE_HOURS}h`,
    });

    updates.operationalStatus = 'SUSPENDU';
    updates.suspensionReason = `Négligence relais arrivée: ${staleArrivalPending} colis non remis > ${ARRIVAL_HANDOVER_STALE_HOURS}h`;
    updates.suspendedAt = now;
    nextScore -= 25;
    actions.push(`sanction:SUSPENSION(arrival_stale_${staleArrivalPending})`);
  } else if (staleArrivalPending >= ARRIVAL_HANDOVER_WARNING_COUNT) {
    await createSanctionIfNotExists({
      relaisId,
      reason: 'OPERATOR_ERROR',
      type: 'WARNING',
      appliedBy: actorId,
      notes: `Auto-warning: ${staleArrivalPending} parcels pending destination handover for > ${ARRIVAL_HANDOVER_STALE_HOURS}h`,
    });

    nextScore -= 10;
    actions.push(`sanction:WARNING(arrival_stale_${staleArrivalPending})`);
  }

  if (totalResolvedArrival >= 10) {
    if (arrivalIssueRate >= ARRIVAL_ISSUE_SUSPEND_RATE) {
      await createSanctionIfNotExists({
        relaisId,
        reason: 'OPERATOR_ERROR',
        type: 'SUSPENSION',
        appliedBy: actorId,
        notes: `Auto-suspension: destination issue rate ${(arrivalIssueRate * 100).toFixed(1)}%`,
      });

      updates.operationalStatus = 'SUSPENDU';
      updates.suspensionReason = `Fiabilité relais arrivée insuffisante (${(arrivalIssueRate * 100).toFixed(1)}%)`;
      updates.suspendedAt = now;
      nextScore -= 20;
      actions.push(`sanction:SUSPENSION(arrival_issue_rate_${(arrivalIssueRate * 100).toFixed(1)}%)`);
    } else if (arrivalIssueRate >= ARRIVAL_ISSUE_WARNING_RATE) {
      await createSanctionIfNotExists({
        relaisId,
        reason: 'OPERATOR_ERROR',
        type: 'WARNING',
        appliedBy: actorId,
        notes: `Auto-warning: destination issue rate ${(arrivalIssueRate * 100).toFixed(1)}%`,
      });

      nextScore -= 8;
      actions.push(`sanction:WARNING(arrival_issue_rate_${(arrivalIssueRate * 100).toFixed(1)}%)`);
    }
  }

  if (relais.sanctions.length > 0) {
    nextScore -= 5;
    actions.push('score:-5(active_sanctions)');
  }

  nextScore = clampScore(nextScore);

  if (nextScore !== relais.complianceScore) {
    updates.complianceScore = nextScore;
  }

  const severeActiveSanction = relais.sanctions.some(
    s => s.type === 'SUSPENSION' || s.type === 'CAUTION_FORFEIT'
  );

  if (
    relais.cautionAmount &&
    relais.cautionAmount > 0 &&
    relais.activationDate &&
    !severeActiveSanction &&
    nextScore >= 75 &&
    relais.cautionStatus !== 'FORFEITED'
  ) {
    const milestone = getCautionReleaseMilestone(relais.activationDate, now);

    if (milestone.status !== relais.cautionStatus) {
      updates.cautionStatus = milestone.status;
      actions.push(`caution:${milestone.status}(${milestone.percent}%)`);
    }
  }

  let finalComplianceScore = relais.complianceScore;
  let finalCautionStatus = relais.cautionStatus;
  let finalOperationalStatus = relais.operationalStatus;

  if (Object.keys(updates).length > 0) {
    const updatedRelais = await db.relais.update({
      where: { id: relaisId },
      data: updates,
    });

    finalComplianceScore = updatedRelais.complianceScore;
    finalCautionStatus = updatedRelais.cautionStatus;
    finalOperationalStatus = updatedRelais.operationalStatus;
  }

  await db.actionLog.create({
    data: {
      userId: actorId,
      entityType: 'RELAIS',
      entityId: relaisId,
      action: 'COMPLIANCE_RULES_PROCESSED',
      details: JSON.stringify({
        outstandingAmount,
        hasOverdueReversal,
        staleArrivalPending,
        arrivalIssueRate,
        totalResolvedArrival,
        updates,
        actions,
      }),
    },
  });

  return {
    relaisId,
    status: 'PROCESSED' as const,
    commerceName: relais.commerceName,
    complianceScore: finalComplianceScore,
    cautionStatus: finalCautionStatus,
    operationalStatus: finalOperationalStatus,
    actions,
  };
}

export async function processComplianceBatch({
  actorId,
  relaisId,
}: {
  actorId: string;
  relaisId?: string;
}) {
  const relaisList = relaisId
    ? await db.relais.findMany({ where: { id: relaisId } })
    : await db.relais.findMany({
        where: {
          status: 'APPROVED',
        },
        select: { id: true },
      });

  const results: Array<Record<string, any>> = [];

  for (const relais of relaisList) {
    const id = 'id' in relais ? relais.id : (relais as any).id;
    const result = await processRelaisCompliance(id, actorId);
    results.push(result);
  }

  return {
    processedCount: results.length,
    results,
  };
}
