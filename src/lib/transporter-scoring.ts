import { db } from '@/lib/db';

/**
 * Transporter Scoring System
 * 
 * Intelligent matching based on:
 * - Success rate (completed missions)
 * - Average completion time
 * - Cancellation rate
 * - Customer rating
 * 
 * Final score: 0-100 (used for matching ranking)
 */

export interface ScoringWeights {
  successRate: number; // 0-100 weight for completion rate
  avgCompletionTime: number; // 0-100 weight for speed (inverse)
  cancellationRate: number; // 0-100 weight for reliability (inverse)
  customerRating: number; // 0-100 weight for satisfaction
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  successRate: 40,
  avgCompletionTime: 20,
  cancellationRate: 20,
  customerRating: 20,
};

/**
 * Calculate composite score (0-100)
 */
export function calculateScore(
  successRate: number,
  avgCompletionTime: number,
  cancellationRate: number,
  averageRating: number,
  weights = DEFAULT_WEIGHTS
): number {
  // Normalize inputs to 0-100 scale
  const successScore = successRate; // Already 0-100
  const completionScore = Math.max(0, 100 - (avgCompletionTime / 5) * 100); // Lower time = higher score
  const reliabilityScore = 100 - cancellationRate; // Lower cancellations = higher score
  const ratingScore = (averageRating / 5) * 100; // Convert 0-5 to 0-100

  // weighted average
  const score =
    (successScore * weights.successRate +
      completionScore * weights.avgCompletionTime +
      reliabilityScore * weights.cancellationRate +
      ratingScore * weights.customerRating) /
    (weights.successRate +
      weights.avgCompletionTime +
      weights.cancellationRate +
      weights.customerRating);

  return Math.max(0, Math.min(100, Math.round(score))); // Clamp 0-100
}

/**
 * Update transporter score based on mission completion
 */
export async function updateTransporterScore(
  transporteurId: string,
  missionCompleted: boolean,
  delayedDelivery: boolean
) {
  // Get all missions for this transporteur
  const missions = await (db as any).mission.findMany({
    where: { transporteurId },
    include: {
      colis: { select: { status: true, deliveredAt: true, expectedDeliveryAt: true } },
    },
  });

  if (missions.length === 0) {
    // Initialize score for new transporteur
    return await (db as any).transporterScore.upsert({
      where: { transporteurId },
      update: {},
      create: {
        transporteurId,
        successRate: 100,
        cancellationRate: 0,
        averageRating: 5,
        score: 50, // Start at 50 for new transporters
      },
    });
  }

  // Calculate stats
  const completed = missions.filter((m) => m.status === 'LIVRE').length;
  const cancelled = missions.filter((m) => m.status === 'ANNULE').length;
  const total = missions.length;

  const successRate = (completed / total) * 100;
  const cancellationRate = (cancelled / total) * 100;

  // Calculate average completion time (hours)
  let totalCompletionHours = 0;
  let completedCount = 0;
  missions.forEach((m) => {
    if (m.colis.deliveredAt && m.colis.deliveredAt) {
      const hours = Math.abs(
        (m.colis.deliveredAt.getTime() - m.assignedAt.getTime()) / (1000 * 60 * 60)
      );
      totalCompletionHours += hours;
      completedCount++;
    }
  });
  const avgCompletionTime = completedCount > 0 ? totalCompletionHours / completedCount : 0;

  // Count late deliveries
  const lateCount = missions.filter((m) => {
    return m.colis.expectedDeliveryAt && m.colis.deliveredAt && m.colis.deliveredAt > m.colis.expectedDeliveryAt;
  }).length;

  // Get rating from disputes or reviews (TODO: implement review system)
  const averageRating = 5; // Default 5 stars

  // Calculate final score
  const score = calculateScore(successRate, avgCompletionTime, cancellationRate, averageRating);

  // Update or create score record
  const scoringRecord = await (db as any).transporterScore.upsert({
    where: { transporteurId },
    update: {
      successRate,
      avgCompletionTime,
      cancellationRate,
      averageRating,
      totalDeliveries: completed,
      totalCancellations: cancelled,
      totalLate: lateCount,
      score,
      lastUpdated: new Date(),
    },
    create: {
      transporteurId,
      successRate,
      avgCompletionTime,
      cancellationRate,
      averageRating,
      totalDeliveries: completed,
      totalCancellations: cancelled,
      totalLate: lateCount,
      score,
    },
  });

  return scoringRecord;
}

/**
 * Get transporter score (for matching)
 */
export async function getTransporterScore(transporteurId: string) {
  let score = await (db as any).transporterScore.findUnique({
    where: { transporteurId },
  });

  if (!score) {
    // Initialize if doesn't exist
    score = await (db as any).transporterScore.create({
      data: {
        transporteurId,
        score: 50, // New transporters start at 50
      },
    });
  }

  return score;
}

/**
 * Rank transporters by score (for intelligent matching)
 * Returns top N available transporters sorted by score (descending)
 */
export async function rankTransportersForMatching(
  villeDepart: string,
  villeArrivee: string,
  limit: number = 10
): Promise<
  Array<{
    transporteurId: string;
    score: number;
    successRate: number;
    avgCompletionTime: number;
  }>
> {
  // Get all transporters with active trajets covering this route
  const trajets = await (db as any).trajet.findMany({
    where: {
      villeDepart,
      villeArrivee,
      status: 'PROGRAMME',
      dateDepart: { gte: new Date() },
    },
    include: {
      transporteur: { select: { id: true } },
    },
  });

  const transporterIds = [...new Set(trajets.map((t) => t.transporteur.id))];

  if (transporterIds.length === 0) {
    return [];
  }

  // Get scores for all matching transporters
  const scores = await (db as any).transporterScore.findMany({
    where: { transporteurId: { in: transporterIds } },
    orderBy: { score: 'desc' },
    take: limit,
  });

  return scores.map((s) => ({
    transporteurId: s.transporteurId,
    score: s.score,
    successRate: s.successRate,
    avgCompletionTime: s.avgCompletionTime,
  }));
}

/**
 * Degrade score for penalties
 */
export async function degradeScoreForPenalty(
  transporteurId: string,
  penaltyType: 'LATE_DELIVERY' | 'LOST_PARCEL' | 'CANCELLATION'
) {
  const score = await getTransporterScore(transporteurId);

  let degradation = 0;
  switch (penaltyType) {
    case 'LATE_DELIVERY':
      degradation = 2; // -2 points
      break;
    case 'LOST_PARCEL':
      degradation = 10; // -10 points
      break;
    case 'CANCELLATION':
      degradation = 5; // -5 points
      break;
  }

  const newScore = Math.max(0, score.score - degradation);

  await (db as any).transporterScore.update({
    where: { transporteurId },
    data: { score: newScore },
  });

  return newScore;
}
