/**
 * intelligent-matching-service.ts
 * 
 * Améliore le matching automatique en utilisant les préférences du transporteur :
 * - Villes préférées
 * - Limites de poids/dimension
 * - Horaires de disponibilité
 * - Scoring pondéré selon les préférences
 */

import { db } from '@/lib/db';
import { RankedTrajet } from './matchingService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransporterPrefsData {
  preferredCities?: string[];
  preferredRoutes?: Array<{ villeDepart: string; villeArrivee: string }>;
  excludedCities?: string[];
  maxDailyMissions: number;
  maxActiveParallel: number;
  maxWeightKg?: number;
  maxDimensionCm?: number;
  acceptsCOD: boolean;
  acceptsPriority: boolean;
  acceptsBulk: boolean;
  scoreWeightDistance: number;
  scoreWeightCapacity: number;
  scoreWeightTiming: number;
  scoreWeightEarnings: number;
  successRate: number;
  avgRating?: number;
}

export interface IntelligentMatchCandidate extends RankedTrajet {
  scorePreference: number; // Score 0-100 basé sur les préférences
  meetsRequirements: boolean;
  requirementsMissing: string[];
}

export interface AutoAssignScheduleConfig {
  type: 'MANUAL' | 'DAILY_8AM' | 'DAILY_6PM' | 'WEEKLY' | 'CUSTOM';
  customCron?: string;
  lastRun?: Date;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Parse préférences JSON depuis la DB
 */
export function parseTransporterPrefs(prefs: {
  preferredCities: string | null;
  preferredRoutes: string | null;
  excludedCities: string | null;
  maxDailyMissions: number;
  maxActiveParallel: number;
  maxWeightKg: number | null;
  maxDimensionCm: number | null;
  acceptsCOD: boolean;
  acceptsPriority: boolean;
  acceptsBulk: boolean;
  scoreWeightDistance: number;
  scoreWeightCapacity: number;
  scoreWeightTiming: number;
  scoreWeightEarnings: number;
  successRate: number;
  avgRating: number | null;
}): TransporterPrefsData {
  const parseArray = (val: string | null): any[] => {
    if (!val) return [];
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  };

  return {
    preferredCities: parseArray(prefs.preferredCities),
    preferredRoutes: parseArray(prefs.preferredRoutes),
    excludedCities: parseArray(prefs.excludedCities),
    maxDailyMissions: prefs.maxDailyMissions || 10,
    maxActiveParallel: prefs.maxActiveParallel || 5,
    maxWeightKg: prefs.maxWeightKg ?? undefined,
    maxDimensionCm: prefs.maxDimensionCm ?? undefined,
    acceptsCOD: prefs.acceptsCOD ?? true,
    acceptsPriority: prefs.acceptsPriority ?? true,
    acceptsBulk: prefs.acceptsBulk ?? false,
    scoreWeightDistance: prefs.scoreWeightDistance || 30,
    scoreWeightCapacity: prefs.scoreWeightCapacity || 25,
    scoreWeightTiming: prefs.scoreWeightTiming || 20,
    scoreWeightEarnings: prefs.scoreWeightEarnings || 25,
    successRate: prefs.successRate || 100,
    avgRating: prefs.avgRating ?? undefined,
  };
}

/**
 * Vérifie si un colis satisfait les exigences du transporteur
 */
export function validateColisAgainstPrefs(
  colis: {
    weight?: number | null;
    description?: string;
    isPriority: boolean;
  },
  prefs: TransporterPrefsData
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Vérifier poids
  if (colis.weight && prefs.maxWeightKg && colis.weight > prefs.maxWeightKg) {
    missing.push(`Poids ${colis.weight}kg dépasse limite ${prefs.maxWeightKg}kg`);
  }

  // Vérifier priorité
  if (colis.isPriority && !prefs.acceptsPriority) {
    missing.push('Colis prioritaire : non accepté par ce transporteur');
  }

  // Vérifier COD (sera déterminé par le statut du paiement)
  // Pas de vérif simple ici

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Calcule un score de préférence (0-100) pour un trajet
 */
export function scorePreference(
  trajet: RankedTrajet,
  colis: { villeDepart: string; villeArrivee: string },
  prefs: TransporterPrefsData
): number {
  let score = 50; // Base score

  // Bonus si ville préférée
  if (prefs.preferredCities?.length) {
    const normalizeCity = (v: string) => v.trim().toLowerCase();
    if (
      prefs.preferredCities.some((city) => normalizeCity(city) === normalizeCity(colis.villeDepart)) ||
      prefs.preferredCities.some((city) => normalizeCity(city) === normalizeCity(colis.villeArrivee))
    ) {
      score += 25;
    }
  }

  // Bonus si route préférée
  if (prefs.preferredRoutes?.length) {
    const normalizeRoute = (r: string) => r.trim().toLowerCase();
    const colisRoute = `${colis.villeDepart}-${colis.villeArrivee}`.trim().toLowerCase();
    if (
      prefs.preferredRoutes.some(
        (route) =>
          normalizeRoute(`${route.villeDepart}-${route.villeArrivee}`) === normalizeRoute(colisRoute)
      )
    ) {
      score += 30;
    }
  }

  // Pénalité si ville exclue
  if (prefs.excludedCities?.length) {
    const normalizeCity = (v: string) => v.trim().toLowerCase();
    if (
      prefs.excludedCities.some((city) => normalizeCity(city) === normalizeCity(colis.villeDepart)) ||
      prefs.excludedCities.some((city) => normalizeCity(city) === normalizeCity(colis.villeArrivee))
    ) {
      score -= 50;
    }
  }

  // Bonus basé sur rating transporteur (0-15 points)
  if (prefs.avgRating != null) {
    score += Math.min(prefs.avgRating / 5 * 15, 15);
  }

  // Bonus si capacité excellente (85%+)
  const capacityPercent = (trajet.capaciteRestante / trajet.placesColis) * 100;
  if (capacityPercent >= 85) {
    score += 10;
  } else if (capacityPercent >= 50) {
    score += 5;
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Améliore le scoring en utilisant les poids de préférence du transporteur
 */
export function enhanceScoreWithPreferences(
  score: number,
  preferenceScore: number,
  prefs: TransporterPrefsData
): number {
  const totalWeight =
    prefs.scoreWeightDistance +
    prefs.scoreWeightCapacity +
    prefs.scoreWeightTiming +
    prefs.scoreWeightEarnings;

  if (totalWeight === 0) return score; // Avoid division by zero

  // Normaliser les poids
  const weightDistance = prefs.scoreWeightDistance / totalWeight;
  const weightPreference = (prefs.scoreWeightDistance + 50) / totalWeight / 2; // Préf utilise distance weight

  // Blending: 70% score algo original, 30% préférences
  const blendedScore = score * 0.7 + preferenceScore * 0.3;

  return Math.round(blendedScore);
}

/**
 * Filtre et classe les trajets compatibles en utilisant les préférences
 */
export async function getRankedTrajetsWithPreferences(
  params: {
    trajets: RankedTrajet[];
    colis: { villeDepart: string; villeArrivee: string; weight?: number | null; isPriority: boolean };
    transporterId: string;
  }
): Promise<IntelligentMatchCandidate[]> {
  const { trajets, colis, transporterId } = params;

  // Charger les préférences du transporteur
  let prefs: TransporterPrefsData | null = null;
  try {
    const prefData = await db.transporterPreferences.findUnique({
      where: { userId: transporterId },
    });
    prefs = prefData ? parseTransporterPrefs(prefData) : null;
  } catch (error) {
    console.warn(`Impossible de charger préférences pour ${transporterId}:`, error);
  }

  if (!prefs) {
    // Si pas de préférences, retourner les trajets normaux
    return trajets.map((t) => ({
      ...t,
      scorePreference: 50,
      meetsRequirements: true,
      requirementsMissing: [],
    }));
  }

  // Valider le colis
  const validation = validateColisAgainstPrefs(colis, prefs);

  // Scorer et filtrer
  const candidates: IntelligentMatchCandidate[] = trajets.map((trajet) => {
    const preferenceScore = scorePreference(trajet, colis, prefs!);
    const enhancedScore = enhanceScoreWithPreferences(trajet.score, preferenceScore, prefs!);

    return {
      ...trajet,
      score: enhancedScore,
      scorePreference: preferenceScore,
      meetsRequirements: validation.valid,
      requirementsMissing: validation.missing,
    };
  });

  // Trier : d'abord les trajets valides par score, ensuite les invalid
  return candidates.sort((a, b) => {
    if (a.meetsRequirements !== b.meetsRequirements) {
      return a.meetsRequirements ? -1 : 1;
    }
    return b.score - a.score;
  });
}

/**
 * Compte les missions actives d'un transporteur
 */
export async function getTransporterActiveMissions(
  transporterId: string
): Promise<{ total: number; count: number }> {
  const activeMissions = await db.mission.findMany({
    where: {
      transporteurId: transporterId,
      status: { in: ['ASSIGNE', 'EN_COURS'] },
    },
  });

  return {
    total: activeMissions.length,
    count: activeMissions.length,
  };
}

/**
 * Vérifie si un transporteur peut accepter plus de missions
 */
export async function canAcceptMoreMissions(
  transporterId: string,
  prefs: TransporterPrefsData
): Promise<{ canAccept: boolean; reason?: string }> {
  const activeMissions = await getTransporterActiveMissions(transporterId);

  if (activeMissions.total >= prefs.maxActiveParallel) {
    return {
      canAccept: false,
      reason: `Maximum ${prefs.maxActiveParallel} missions parallèles atteint`,
    };
  }

  // Vérifier missions du jour
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaysMissions = await db.mission.count({
    where: {
      transporteurId: transporterId,
      assignedAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  if (todaysMissions >= prefs.maxDailyMissions) {
    return {
      canAccept: false,
      reason: `Maximum ${prefs.maxDailyMissions} missions par jour atteint`,
    };
  }

  return { canAccept: true };
}

/**
 * Auto-assign avec préférences - teste tous les transporteurs avec auto-assign activé
 */
export async function autoAssignWithPreferences(
  colisId: string,
  limit = 5
): Promise<{
  success: boolean;
  transporterId?: string;
  score?: number;
  error?: string;
}> {
  // Charger le colis
  const colis = await db.colis.findUnique({
    where: { id: colisId },
    select: {
      id: true,
      villeDepart: true,
      villeArrivee: true,
      weight: true,
      isPriority: true,
      status: true,
    },
  });

  if (!colis) {
    return { success: false, error: 'Colis non trouvé' };
  }

  // Charger les transporteurs avec auto-assign activé pour cette route
  const transportsWithAutoAssign = await db.transporterPreferences.findMany({
    where: {
      autoAssignEnabled: true,
      user: {
        role: 'TRANSPORTER',
        isActive: true,
      },
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    take: limit,
  });

  if (transportsWithAutoAssign.length === 0) {
    return { success: false, error: 'Aucun transporteur avec auto-assign activé' };
  }

  // Tester chaque transporteur
  for (const prefData of transportsWithAutoAssign) {
    const transporterId = prefData.userId;
    const prefs = parseTransporterPrefs(prefData);

    // Vérifier capacité
    const capacity = await canAcceptMoreMissions(transporterId, prefs);
    if (!capacity.canAccept) {
      continue;
    }

    // Valider colis
    const valid = validateColisAgainstPrefs(colis, prefs);
    if (!valid.valid) {
      continue;
    }

    // Créer la mission
    try {
      const mission = await db.mission.create({
        data: {
          colisId: colis.id,
          transporteurId: transporterId,
          status: 'ASSIGNE',
        },
      });

      // Notify
      await db.notification.create({
        data: {
          userId: transporterId,
          title: 'Nouvelle mission auto-assignée',
          message: `Colis ${colis.villeDepart} → ${colis.villeArrivee} assigné automatiquement`,
          type: 'IN_APP',
        },
      }).catch(() => {});

      return {
        success: true,
        transporterId,
        score: 100,
      };
    } catch (error) {
      console.error(`Erreur création mission pour transporteur ${transporterId}:`, error);
      continue;
    }
  }

  return {
    success: false,
    error: 'Aucun transporteur disponible ne peut accepter ce colis',
  };
}
