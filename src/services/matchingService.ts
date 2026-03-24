/**
 * matchingService.ts
 * Matching automatique : associe un colis à un trajet compatible,
 * crée la mission et met à jour la capacité + le statut du colis.
 *
 * Aucun modèle existant n'est modifié, seules des extensions are ajoutées.
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrajetWithCapacity {
  id: string;
  transporteurId: string;
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

  const depIdx = itinerary.indexOf(villeDepart);
  const arrIdx = itinerary.indexOf(villeArrivee);

  // Les deux villes doivent être présentes dans l'itinéraire
  if (depIdx === -1 || arrIdx === -1) return false;

  // La ville d'arrivée du colis doit être APRÈS la ville de départ
  return arrIdx > depIdx;
}

/**
 * Calcule un score de pertinence (0–120) pour le tri.
 */
function scoreMatch(trajet: TrajetWithCapacity, villeDepart: string, villeArrivee: string): number {
  let score = 0;

  // Correspondance directe départ/arrivée → score maximal
  if (trajet.villeDepart === villeDepart && trajet.villeArrivee === villeArrivee) {
    score = 100;
  } else if (trajet.villeDepart === villeDepart) {
    score = 80;
  } else if (trajet.villeArrivee === villeArrivee) {
    score = 70;
  } else {
    score = 50;
  }

  // Bonus capacité disponible (max +20)
  score += Math.min(trajet.capaciteRestante * 2, 20);

  return score;
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
 *  6. Met à jour le statut du colis → ASSIGNED
 *
 * @param colis - Doit contenir au minimum { id, villeDepart, villeArrivee, clientId, status }
 */
export async function matchColisToTrajets(colis: {
  id: string;
  villeDepart: string;
  villeArrivee: string;
  clientId: string;
  status: string;
}): Promise<MatchColisResult> {
  // Guard: ne pas re-matcher un colis déjà assigné ou livré
  const terminalStatuses = ['ASSIGNED', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION', 'LIVRE', 'ANNULE'];
  if (terminalStatuses.includes(colis.status)) {
    return {
      success: false,
      error: `Le colis est dans un statut non éligible au matching: ${colis.status}`,
    };
  }

  // Vérifier qu'il n'existe pas déjà une mission active pour ce colis
  const existingMission = await db.mission.findFirst({
    where: {
      colisId: colis.id,
      status: { in: ['ASSIGNE', 'PICKED_UP'] },
    },
  });
  if (existingMission) {
    return {
      success: false,
      error: 'Ce colis a déjà une mission active en cours',
    };
  }

  // 1. Récupérer les trajets actifs avec capacité disponible
  const rawTrajets = await db.trajet.findMany({
    where: {
      status: 'PROGRAMME',
      dateDepart: { gte: new Date() },
    },
    include: {
      transporteur: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { dateDepart: 'asc' },
  });

  // 2. Normaliser et filtrer
  const trajets = rawTrajets
    .map(normalizeTrajet)
    .filter(
      (t) =>
        t.capaciteRestante > 0 &&
        isCompatible(t, colis.villeDepart, colis.villeArrivee)
    );

  if (trajets.length === 0) {
    return {
      success: false,
      error: `Aucun trajet disponible pour ${colis.villeDepart} → ${colis.villeArrivee}`,
    };
  }

  // 3. Trier par score décroissant, prendre le meilleur
  const scored = trajets
    .map((t) => ({ trajet: t, score: scoreMatch(t, colis.villeDepart, colis.villeArrivee) }))
    .sort((a, b) => b.score - a.score);

  const { trajet, score } = scored[0];

  // 4. Créer la mission (transaction atomique avec décrémentation)
  const [mission] = await db.$transaction([
    db.mission.create({
      data: {
        colisId: colis.id,
        transporteurId: trajet.transporteurId,
        trajetId: trajet.id,
        status: 'ASSIGNE',
      },
    }),
    // 5. Décrémenter placesUtilisees
    db.trajet.update({
      where: { id: trajet.id },
      data: { placesUtilisees: { increment: 1 } },
    }),
    // 6. Mettre à jour le statut du colis
    db.colis.update({
      where: { id: colis.id },
      data: { status: 'RECU_RELAIS' },
    }),
  ]);

  // Notifier le client
  await db.notification.create({
    data: {
      userId: colis.clientId,
      title: 'Votre colis a été assigné',
      message: `Un transporteur a été trouvé pour votre colis ${colis.villeDepart} → ${colis.villeArrivee}.`,
      type: 'IN_APP',
    },
  });

  return {
    success: true,
    match: {
      trajet: { ...trajet, capaciteRestante: trajet.capaciteRestante - 1 },
      mission,
      score,
    },
  };
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
