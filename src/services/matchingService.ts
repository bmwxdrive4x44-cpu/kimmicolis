/**
 * matchingService.ts
 * Matching automatique : associe un colis à un trajet compatible,
 * crée la mission et met à jour la capacité + le statut du colis.
 *
 * Aucun modèle existant n'est modifié, seules des extensions are ajoutées.
 */

import { db } from '@/lib/db';
import { createNotificationDedup } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrajetWithCapacity {
  id: string;
  transporteurId: string;
  lineId?: string | null;
  villeDepart: string;
  villeArrivee: string;
  villesEtapes: string[]; // Toujours un tableau (normalisé depuis JSON)
  capaciteRestante: number; // Champ virtuel : placesColis - placesUtilisees
  placesColis: number;
  placesUtilisees: number;
  dateDepart: Date;
  status: string;
  [key: string]: unknown;
}

export interface MatchResult {
  trajet: TrajetWithCapacity;
  mission: {
    id: string;
    colisId: string;
    transporteurId: string;
    trajetId: string | null;
    status: string;
    assignedAt: Date;
    [key: string]: unknown;
  };
  score: number;
}

export interface MatchColisResult {
  success: boolean;
  match?: MatchResult;
  error?: string;
}

export interface RankedTrajet extends TrajetWithCapacity {
  score: number;
  transporterActiveMissions: number;
  hopDistance: number;
}

export interface AutoAssignResult {
  processed: number;
  assigned: number;
  skipped: number;
  errors: Array<{ colisId: string; reason: string }>;
  matches: Array<{ colisId: string; trajetId: string; missionId: string; score: number }>;
}

type AutoAssignableColis = {
  id: string;
  lineId?: string | null;
  villeDepart: string;
  villeArrivee: string;
  clientId: string;
  status: string;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse villesEtapes from DB (JSON string | string[] | null) → string[]
 */
function parseVillesEtapes(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      // CSV fallback
    }
    return raw.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function normalizeCity(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalise un trajet DB en exposant villesEtapes[] et capaciteRestante.
 */
function normalizeTrajet(trajet: {
  id: string;
  transporteurId: string;
  villeDepart: string;
  villeArrivee: string;
  villesEtapes: unknown;
  placesColis: number;
  placesUtilisees: number;
  dateDepart: Date;
  status: string;
  [key: string]: unknown;
}): TrajetWithCapacity {
  const villesEtapes = parseVillesEtapes(trajet.villesEtapes);
  return {
    ...trajet,
    villesEtapes,
    capaciteRestante: trajet.placesColis - trajet.placesUtilisees,
  };
}

/**
 * Vérifie que le colis peut être pris en charge par le trajet :
 *  1. ville_depart_colis ∈ (départ du trajet OU étapes)
 *  2. ville_arrivee_colis ∈ (arrivée du trajet OU étapes APRÈS le départ)
 *  3. La ville d'arrivée du colis est positionnée APRÈS ou EN MÊME TEMPS que la
 *     ville de départ du colis dans l'itinéraire complet du trajet.
 */
function isCompatible(
  trajet: TrajetWithCapacity,
  villeDepart: string,
  villeArrivee: string
): boolean {
  // Itinéraire complet du trajet : départ → étapes → arrivée
  const itinerary: string[] = [
    trajet.villeDepart,
    ...trajet.villesEtapes,
    trajet.villeArrivee,
  ];

  const normalizedItinerary = itinerary.map(normalizeCity);
  const depIdx = normalizedItinerary.indexOf(normalizeCity(villeDepart));
  const arrIdx = normalizedItinerary.indexOf(normalizeCity(villeArrivee));

  // Les deux villes doivent être présentes dans l'itinéraire
  if (depIdx === -1 || arrIdx === -1) return false;

  // La ville d'arrivée du colis doit être APRÈS la ville de départ
  return arrIdx > depIdx;
}

function getRouteIndexes(
  trajet: TrajetWithCapacity,
  villeDepart: string,
  villeArrivee: string
): { depIdx: number; arrIdx: number } {
  const itinerary: string[] = [
    trajet.villeDepart,
    ...trajet.villesEtapes,
    trajet.villeArrivee,
  ];

  const normalizedItinerary = itinerary.map(normalizeCity);

  return {
    depIdx: normalizedItinerary.indexOf(normalizeCity(villeDepart)),
    arrIdx: normalizedItinerary.indexOf(normalizeCity(villeArrivee)),
  };
}

/**
 * Calcule un score de pertinence (0–120) pour le tri.
 */
function scoreMatch(
  trajet: TrajetWithCapacity,
  villeDepart: string,
  villeArrivee: string,
  transporterActiveMissions: number
): number {
  let score = 0;

  // Correspondance directe départ/arrivée → score maximal
  if (
    normalizeCity(trajet.villeDepart) === normalizeCity(villeDepart) &&
    normalizeCity(trajet.villeArrivee) === normalizeCity(villeArrivee)
  ) {
    score = 100;
  } else if (normalizeCity(trajet.villeDepart) === normalizeCity(villeDepart)) {
    score = 85;
  } else if (normalizeCity(trajet.villeArrivee) === normalizeCity(villeArrivee)) {
    score = 75;
  } else {
    score = 60;
  }

  // Bonus capacité disponible (max +20)
  score += Math.min(trajet.capaciteRestante * 2, 20);

  // Bonus proximité sur l'itinéraire (plus la distance en étapes est courte, mieux c'est)
  const { depIdx, arrIdx } = getRouteIndexes(trajet, villeDepart, villeArrivee);
  const hopDistance = depIdx >= 0 && arrIdx >= 0 ? arrIdx - depIdx : 99;
  if (hopDistance > 0 && hopDistance < 99) {
    score += Math.max(20 - (hopDistance - 1) * 5, 0);
  }

  // Bonus disponibilité transporteur (moins de missions actives = plus disponible)
  score += Math.max(15 - transporterActiveMissions * 3, 0);

  // Bonus départ proche dans le temps
  const hoursUntilDeparture = (trajet.dateDepart.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilDeparture <= 24) {
    score += 8;
  } else if (hoursUntilDeparture <= 72) {
    score += 4;
  }

  return score;
}

async function getActiveMissionCountMap(transporteurIds: string[]): Promise<Map<string, number>> {
  if (transporteurIds.length === 0) {
    return new Map<string, number>();
  }

  const activeMissionCounts = await db.mission.groupBy({
    by: ['transporteurId'],
    where: {
      transporteurId: { in: transporteurIds },
      status: { in: ['ASSIGNE', 'EN_COURS', 'PICKED_UP'] },
    },
    _count: { _all: true },
  });

  return new Map(activeMissionCounts.map((row) => [row.transporteurId, row._count._all]));
}

export async function getRankedTrajetsForRoute(params: {
  lineId?: string | null;
  villeDepart: string;
  villeArrivee: string;
}): Promise<RankedTrajet[]> {
  const { lineId, villeDepart, villeArrivee } = params;

  const rawTrajets = await db.trajet.findMany({
    where: {
      status: 'PROGRAMME',
      dateDepart: { gte: new Date() },
      ...(lineId ? { lineId } : {}),
    },
    include: {
      transporteur: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: { dateDepart: 'asc' },
  });

  const trajets = rawTrajets
    .map(normalizeTrajet)
    .filter((t) => t.capaciteRestante > 0 && isCompatible(t, villeDepart, villeArrivee));

  if (trajets.length === 0) {
    return [];
  }

  const transporteurIds = Array.from(new Set(trajets.map((t) => t.transporteurId)));
  const activeMissionMap = await getActiveMissionCountMap(transporteurIds);

  return trajets
    .map((trajet) => {
      const transporterActiveMissions = activeMissionMap.get(trajet.transporteurId) ?? 0;
      const { depIdx, arrIdx } = getRouteIndexes(trajet, villeDepart, villeArrivee);
      const hopDistance = depIdx >= 0 && arrIdx >= 0 ? arrIdx - depIdx : 999;

      return {
        ...trajet,
        score: scoreMatch(trajet, villeDepart, villeArrivee, transporterActiveMissions),
        transporterActiveMissions,
        hopDistance,
      } satisfies RankedTrajet;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.transporterActiveMissions !== b.transporterActiveMissions) {
        return a.transporterActiveMissions - b.transporterActiveMissions;
      }
      if (a.dateDepart.getTime() !== b.dateDepart.getTime()) {
        return a.dateDepart.getTime() - b.dateDepart.getTime();
      }
      return b.capaciteRestante - a.capaciteRestante;
    });
}

// ---------------------------------------------------------------------------
// Fonction principale : matchColisToTrajets
// ---------------------------------------------------------------------------

/**
 * Associe automatiquement un colis à un trajet compatible.
 *
 * Étapes :
 *  1. Récupère les trajets actifs (PROGRAMME + date future)
 *  2. Filtre par compatibilité des villes (départ/arrivée/étapes) et capacité dispo
 *  3. Trie par score décroissant
 *  4. Crée une Mission sur le meilleur trajet
 *  5. Décrémente placesUtilisees sur le trajet
 *  6. Conserve le statut actuel du colis (pas de transition métier implicite)
 *
 * @param colis - Doit contenir au minimum { id, villeDepart, villeArrivee, clientId, status }
 */
export async function matchColisToTrajets(colis: {
  id: string;
  lineId?: string | null;
  villeDepart: string;
  villeArrivee: string;
  clientId: string;
  status: string;
}): Promise<MatchColisResult> {
  const eligibleStatuses = ['PAID', 'PAID_RELAY', 'DEPOSITED_RELAY', 'RECU_RELAIS'];
  if (!eligibleStatuses.includes(colis.status)) {
    return {
      success: false,
      error: `Paiement requis avant matching (statut actuel: ${colis.status})`,
    };
  }

  // Vérifier qu'il n'existe pas déjà une mission active pour ce colis
  const existingMission = await db.mission.findFirst({
    where: {
      colisId: colis.id,
      status: { in: ['ASSIGNE', 'EN_COURS', 'PICKED_UP'] },
    },
  });
  if (existingMission) {
    return {
      success: false,
      error: 'Ce colis a déjà une mission active en cours',
    };
  }

  const rankedTrajets = await getRankedTrajetsForRoute({
    lineId: colis.lineId,
    villeDepart: colis.villeDepart,
    villeArrivee: colis.villeArrivee,
  });

  if (rankedTrajets.length === 0) {
    return {
      success: false,
      error: `Aucun trajet disponible pour ${colis.villeDepart} → ${colis.villeArrivee}`,
    };
  }

  const trajet = rankedTrajets[0];
  const score = trajet.score;

  let mission: {
    id: string;
    colisId: string;
    transporteurId: string;
    trajetId: string | null;
    status: string;
    assignedAt: Date;
    [key: string]: unknown;
  };

  try {
    mission = await db.$transaction(async (tx) => {
      const activeMission = await tx.mission.findFirst({
        where: {
          colisId: colis.id,
          status: { in: ['ASSIGNE', 'EN_COURS', 'PICKED_UP'] },
        },
      });

      if (activeMission) {
        throw new Error('Ce colis a déjà une mission active en cours');
      }

      const reservedCapacity = await tx.trajet.updateMany({
        where: {
          id: trajet.id,
          status: 'PROGRAMME',
          dateDepart: { gte: new Date() },
          placesUtilisees: { lt: trajet.placesColis },
        },
        data: { placesUtilisees: { increment: 1 } },
      });

      if (reservedCapacity.count === 0) {
        throw new Error('Capacité du trajet indisponible, veuillez relancer le matching');
      }

      const createdMission = await tx.mission.create({
        data: {
          colisId: colis.id,
          transporteurId: trajet.transporteurId,
          trajetId: trajet.id,
          status: 'ASSIGNE',
        },
      });

      return createdMission;
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l’assignation du colis',
    };
  }

  // Notifier le client
  try {
    await createNotificationDedup({
      userId: colis.clientId,
      title: 'Votre colis a été assigné',
      message: `Un transporteur a été trouvé pour votre colis ${colis.villeDepart} → ${colis.villeArrivee}.`,
      type: 'IN_APP',
    });
  } catch (error) {
    console.error('Notification matching non envoyée:', error);
  }

  // Notifier le transporteur
  try {
    await createNotificationDedup({
      userId: trajet.transporteurId,
      title: 'Nouvelle mission assignée',
      message: `Nouveau colis à prendre en charge: ${colis.villeDepart} → ${colis.villeArrivee}. La mission est disponible dans votre dashboard transporteur.`,
      type: 'IN_APP',
    });
  } catch (error) {
    console.error('Notification transporteur non envoyee:', error);
  }

  return {
    success: true,
    match: {
      trajet: { ...trajet, capaciteRestante: trajet.capaciteRestante - 1 },
      mission,
      score,
    },
  };
}

export async function autoAssignUnmatchedColis(limit = 50): Promise<AutoAssignResult> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50;

  const eligibleStatuses = ['PAID', 'PAID_RELAY', 'DEPOSITED_RELAY', 'RECU_RELAIS'];

  const baseColisWhere = {
    status: { in: eligibleStatuses },
    missions: {
      none: {
        status: { in: ['ASSIGNE', 'EN_COURS', 'PICKED_UP'] },
      },
    },
  };

  const [pendingEligibleCount, capacityAggregate] = await Promise.all([
    db.colis.count({ where: baseColisWhere }),
    db.trajet.aggregate({
      where: {
        status: 'PROGRAMME',
        dateDepart: { gte: new Date() },
      },
      _sum: {
        placesColis: true,
        placesUtilisees: true,
      },
    }),
  ]);

  const totalPlaces = capacityAggregate._sum.placesColis ?? 0;
  const usedPlaces = capacityAggregate._sum.placesUtilisees ?? 0;
  const availableSlots = Math.max(totalPlaces - usedPlaces, 0);
  const highLoadMode = pendingEligibleCount > availableSlots;

  const getStatusPriority = (status: string): number => {
    switch (status) {
      case 'RECU_RELAIS':
        return 4;
      case 'DEPOSITED_RELAY':
        return 3;
      case 'PAID_RELAY':
      case 'PAID':
        return 2;
      default:
        return 1;
    }
  };

  const compareByPriority = (a: AutoAssignableColis, b: AutoAssignableColis): number => {
    if (highLoadMode) {
      const ageDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (ageDiff !== 0) return ageDiff;
      return getStatusPriority(b.status) - getStatusPriority(a.status);
    }

    const statusDiff = getStatusPriority(b.status) - getStatusPriority(a.status);
    if (statusDiff !== 0) return statusDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  };

  const colisList = await db.colis.findMany({
    where: baseColisWhere,
    select: {
      id: true,
      lineId: true,
      villeDepart: true,
      villeArrivee: true,
      clientId: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: safeLimit,
  });

  const prioritizedColis = [...colisList].sort(compareByPriority);

  const result: AutoAssignResult = {
    processed: colisList.length,
    assigned: 0,
    skipped: 0,
    errors: [],
    matches: [],
  };

  for (const colis of prioritizedColis) {
    try {
      const match = await matchColisToTrajets(colis);
      if (match.success && match.match) {
        result.assigned += 1;
        result.matches.push({
          colisId: colis.id,
          trajetId: match.match.trajet.id,
          missionId: match.match.mission.id,
          score: match.match.score,
        });
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      result.errors.push({
        colisId: colis.id,
        reason: error instanceof Error ? error.message : 'Unknown matching error',
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Fonction utilitaire : getTrajetsWithCapacity
// Exposée pour les routes API qui n'ont besoin que de lire les trajets enrichis
// ---------------------------------------------------------------------------

/**
 * Retourne tous les trajets actifs enrichis avec `capaciteRestante` et `villesEtapes[]`.
 * Filtre optionnel par ville de départ / arrivée.
 */
export async function getTrajetsWithCapacity(filters?: {
  villeDepart?: string;
  villeArrivee?: string;
  onlyAvailable?: boolean;
}): Promise<TrajetWithCapacity[]> {
  const where: Record<string, unknown> = {
    status: 'PROGRAMME',
    dateDepart: { gte: new Date() },
  };

  const rawTrajets = await db.trajet.findMany({
    where,
    include: {
      transporteur: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { dateDepart: 'asc' },
  });

  let results = rawTrajets.map(normalizeTrajet);

  if (filters?.onlyAvailable) {
    results = results.filter((t) => t.capaciteRestante > 0);
  }

  if (filters?.villeDepart && filters?.villeArrivee) {
    results = results.filter((t) =>
      isCompatible(t, filters.villeDepart!, filters.villeArrivee!)
    );
  }

  return results;
}
