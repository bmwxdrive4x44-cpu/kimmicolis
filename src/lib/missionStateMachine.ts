/**
 * Mission State Machine
 *
 * Transitions autorisées :
 *   ASSIGNE → EN_COURS  (transporteur prend en charge le colis)
 *   EN_COURS → LIVRE    (colis remis au client ou arrivé relais destination)
 *   ASSIGNE  → ANNULE   (timeout ou annulation)
 *   EN_COURS → ANNULE   (annulation en cours de route)
 *
 * LIVRE et ANNULE sont des états terminaux.
 */

export type MissionStatus = 'ASSIGNE' | 'EN_COURS' | 'LIVRE' | 'ANNULE';
type LegacyMissionStatus = 'PICKED_UP' | 'COMPLETED';

const LEGACY_TO_CANONICAL: Record<LegacyMissionStatus, MissionStatus> = {
  PICKED_UP: 'EN_COURS',
  COMPLETED: 'LIVRE',
};

const TERMINAL: MissionStatus[] = ['LIVRE', 'ANNULE'];

const transitions: Record<MissionStatus, MissionStatus[]> = {
  ASSIGNE: ['EN_COURS', 'ANNULE'],
  EN_COURS: ['LIVRE', 'ANNULE'],
  LIVRE: [],
  ANNULE: [],
};

export function normalizeMissionStatus(status: string): MissionStatus | string {
  return LEGACY_TO_CANONICAL[status as LegacyMissionStatus] ?? status;
}

/** Retourne `true` si la transition `from → to` est légale. */
export function canMissionTransition(from: string, to: string): boolean {
  const normalizedFrom = normalizeMissionStatus(from);
  const normalizedTo = normalizeMissionStatus(to);

  if (normalizedFrom === normalizedTo) return true;
  if (!transitions[normalizedFrom as MissionStatus]) return false;
  return (transitions[normalizedFrom as MissionStatus] as string[]).includes(normalizedTo);
}

/**
 * Lève une erreur si la transition est illégale.
 * À utiliser dans toutes les routes API avant d'écrire en base.
 */
export function assertMissionTransition(from: string, to: string): void {
  if (!canMissionTransition(from, to)) {
    throw new Error(`Transition mission invalide : ${from} → ${to}`);
  }
}

/** Retourne `true` si le statut est terminal (LIVRE ou ANNULE). */
export function isMissionTerminal(status: string): boolean {
  return TERMINAL.includes(normalizeMissionStatus(status) as MissionStatus);
}

/** Liste des statuts considérés comme "actifs" (non terminaux et non nuls). */
export const ACTIVE_MISSION_STATUSES: MissionStatus[] = ['ASSIGNE', 'EN_COURS'];

/** Liste des statuts reconnus (whitelist pour la validation des inputs). */
export const ALL_MISSION_STATUSES: MissionStatus[] = ['ASSIGNE', 'EN_COURS', 'LIVRE', 'ANNULE'];
