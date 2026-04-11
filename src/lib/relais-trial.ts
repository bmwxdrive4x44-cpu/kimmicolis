import { db } from '@/lib/db';

const DEFAULT_TRIAL_DAYS = 30;
const DEFAULT_DAILY_MAX_PARCELS = 10;

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const RELAY_TRIAL_DAYS = readPositiveInt(process.env.RELAY_TRIAL_DAYS, DEFAULT_TRIAL_DAYS);
export const RELAY_TRIAL_DAILY_MAX_PARCELS = readPositiveInt(
  process.env.RELAY_TRIAL_DAILY_MAX_PARCELS,
  DEFAULT_DAILY_MAX_PARCELS
);

export function getTrialEndDate(activationDate: Date) {
  const end = new Date(activationDate);
  end.setDate(end.getDate() + RELAY_TRIAL_DAYS);
  return end;
}

export function getRelayTrialState(activationDate: Date | null | undefined, now: Date = new Date()) {
  if (!activationDate) {
    return { isActive: false, daysRemaining: 0 };
  }

  const trialEndDate = getTrialEndDate(activationDate);
  const isActive = now < trialEndDate;
  const msRemaining = Math.max(0, trialEndDate.getTime() - now.getTime());
  const daysRemaining = isActive ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : 0;

  return {
    isActive,
    daysRemaining,
    trialEndDate,
  };
}

export async function checkRelayTrialQuota({
  relaisId,
  additionalParcels,
}: {
  relaisId: string;
  additionalParcels: number;
}) {
  const relay = await db.relais.findUnique({
    where: { id: relaisId },
    select: {
      status: true,
      operationalStatus: true,
      activationDate: true,
    },
  });

  if (!relay || relay.status !== 'APPROVED' || relay.operationalStatus === 'SUSPENDU') {
    return { limited: false as const };
  }

  const trial = getRelayTrialState(relay.activationDate);
  if (!trial.isActive) {
    return { limited: false as const };
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const todayCount = await db.colis.count({
    where: {
      relaisDepartId: relaisId,
      createdAt: {
        gte: dayStart,
        lt: dayEnd,
      },
      status: {
        not: 'ANNULE',
      },
    },
  });

  const projected = todayCount + additionalParcels;
  if (projected > RELAY_TRIAL_DAILY_MAX_PARCELS) {
    return {
      limited: true as const,
      todayCount,
      requested: additionalParcels,
      maxPerDay: RELAY_TRIAL_DAILY_MAX_PARCELS,
      daysRemaining: trial.daysRemaining,
    };
  }

  return {
    limited: false as const,
    todayCount,
    maxPerDay: RELAY_TRIAL_DAILY_MAX_PARCELS,
    daysRemaining: trial.daysRemaining,
  };
}