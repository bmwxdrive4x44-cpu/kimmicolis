import { db } from '@/lib/db';
import { createNotificationDedup } from '@/lib/notifications';
import { getImplicitLoyaltyConfig } from '@/lib/loyalty-config';

export const PRO_IMPLICIT_MIN_PARCELS = 5;
export const PRO_IMPLICIT_WINDOW_DAYS = 7;
export const PRO_IMPLICIT_STICKY_DAYS = 30;
export const PRO_IMPLICIT_ANTI_YOYO_ENABLED = true;
export const PRO_IMPLICIT_MIN_WEIGHT_KG = 0.2;
export const PRO_IMPLICIT_MIN_PRICE_DZD = 100;

const ELIGIBLE_STATUSES = [
  'PAID',
  'PAID_RELAY',
  'EN_TRANSPORT',
  'LIVRE',
] as const;

export interface ProImplicitEligibility {
  eligible: boolean;
  validParcelsCount: number;
  threshold: number;
  remaining: number;
  windowDays: number;
  windowStart: Date;
  stickyDays: number;
  antiYoyoEnabled: boolean;
}

function isEligibilityColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return [
    'eligibleProImplicit',
    'eligibleProSince',
    'proLastEvaluatedAt',
    'weeklyValidShipments',
  ].some((field) => message.includes(field));
}

export async function evaluateImplicitProEligibility(clientId: string): Promise<ProImplicitEligibility> {
  const config = await getImplicitLoyaltyConfig();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - config.windowDays);

  const validParcelsCount = await db.colis.count({
    where: {
      clientId,
      createdAt: { gte: windowStart },
      status: { in: [...ELIGIBLE_STATUSES] },
      weight: { gte: PRO_IMPLICIT_MIN_WEIGHT_KG },
      prixClient: { gte: PRO_IMPLICIT_MIN_PRICE_DZD },
    },
  });

  let previousState = {
    eligibleProImplicit: false,
    eligibleProSince: null as Date | null,
  };

  try {
    const user = await db.user.findUnique({
      where: { id: clientId },
      select: { eligibleProImplicit: true, eligibleProSince: true },
    });

    if (user) {
      previousState = {
        eligibleProImplicit: Boolean(user.eligibleProImplicit),
        eligibleProSince: user.eligibleProSince,
      };
    }
  } catch (error) {
    if (!isEligibilityColumnError(error)) {
      throw error;
    }
  }

  const reachedThreshold = validParcelsCount >= config.minParcels;
  let eligible = reachedThreshold;

  if (!reachedThreshold && PRO_IMPLICIT_ANTI_YOYO_ENABLED && previousState.eligibleProImplicit && previousState.eligibleProSince) {
    const stickyLimit = new Date(previousState.eligibleProSince);
    stickyLimit.setDate(stickyLimit.getDate() + config.stickyDays);
    if (new Date() <= stickyLimit) {
      eligible = true;
    }
  }

  const eligibleSince = eligible
    ? (previousState.eligibleProSince ?? new Date())
    : null;

  try {
    await db.user.update({
      where: { id: clientId },
      data: {
        eligibleProImplicit: eligible,
        eligibleProSince: eligibleSince,
        proLastEvaluatedAt: new Date(),
        weeklyValidShipments: validParcelsCount,
      },
    });
  } catch (error) {
    if (!isEligibilityColumnError(error)) {
      throw error;
    }
  }

  try {
    await db.actionLog.create({
      data: {
        userId: clientId,
        entityType: 'USER',
        entityId: clientId,
        action: 'IMPLICIT_PRO_EVALUATED',
        details: JSON.stringify({
          eligible,
          previousEligible: previousState.eligibleProImplicit,
          validParcelsCount,
          threshold: config.minParcels,
          windowDays: config.windowDays,
          antiYoyoEnabled: PRO_IMPLICIT_ANTI_YOYO_ENABLED,
          stickyDays: config.stickyDays,
          minWeightKg: PRO_IMPLICIT_MIN_WEIGHT_KG,
          minPriceDzd: PRO_IMPLICIT_MIN_PRICE_DZD,
        }),
      },
    });
  } catch (auditError) {
    console.error('[implicit-pro] action log evaluate failed:', auditError);
  }

  if (eligible !== previousState.eligibleProImplicit) {
    const isActivation = eligible;

    await createNotificationDedup({
      userId: clientId,
      title: isActivation ? 'Tarif reduit active' : 'Tarif reduit expire',
      message: isActivation
        ? 'Felicitations, vous avez envoye 5 colis valides cette semaine et beneficiez maintenant du tarif reduit.'
        : 'Votre eligibilite au tarif reduit a expire. Envoyez 5 colis valides cette semaine pour la reactiver.',
      type: 'IN_APP',
      dedupWindowMs: 60 * 1000,
    });

    try {
      await db.actionLog.create({
        data: {
          userId: clientId,
          entityType: 'USER',
          entityId: clientId,
          action: isActivation ? 'IMPLICIT_PRO_ENABLED' : 'IMPLICIT_PRO_DISABLED',
          details: JSON.stringify({
            threshold: config.minParcels,
            windowDays: config.windowDays,
            validParcelsCount,
            antiYoyoEnabled: PRO_IMPLICIT_ANTI_YOYO_ENABLED,
            stickyDays: config.stickyDays,
            minWeightKg: PRO_IMPLICIT_MIN_WEIGHT_KG,
            minPriceDzd: PRO_IMPLICIT_MIN_PRICE_DZD,
          }),
        },
      });
    } catch (auditError) {
      console.error('[implicit-pro] action log transition failed:', auditError);
    }
  }

  return {
    eligible,
    validParcelsCount,
    threshold: config.minParcels,
    remaining: Math.max(0, config.minParcels - validParcelsCount),
    windowDays: config.windowDays,
    windowStart,
    stickyDays: config.stickyDays,
    antiYoyoEnabled: PRO_IMPLICIT_ANTI_YOYO_ENABLED,
  };
}

export async function getProImplicitEligibility(clientId: string): Promise<ProImplicitEligibility> {
  return evaluateImplicitProEligibility(clientId);
}

export async function isProImplicitEligible(clientId: string): Promise<boolean> {
  const stats = await getProImplicitEligibility(clientId);
  return stats.eligible;
}
