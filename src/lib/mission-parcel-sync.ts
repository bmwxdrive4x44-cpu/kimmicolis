/**
 * mission-parcel-sync.ts
 *
 * Source de vérité unique pour toute transition de statut mission.
 * INTERDIT d'appeler db.mission.update() + db.colis.update() séparément ailleurs dans le code.
 * Toujours passer par transitionMission() qui garantit :
 *   - atomicité (transaction Prisma)
 *   - cohérence mission ↔ colis
 *   - guard de concurrence (optimistic lock sur status)
 */

import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events/store';
import { assertMissionTransition, normalizeMissionStatus } from '@/lib/missionStateMachine';

/**
 * Mapping canonique : statut mission → statut colis résultant.
 * Toute évolution métier de la synchro doit se faire ICI uniquement.
 *
 *   EN_COURS → EN_TRANSPORT            (transporteur a pris en charge le colis)
 *   LIVRE    → ARRIVE_RELAIS_DESTINATION (transporteur a déposé au relais destination)
 *   ANNULE   → pas de changement colis  (la mission est annulée, le colis reste où il est)
 */
export const MISSION_TO_PARCEL_STATUS: Partial<Record<string, string>> = {
  EN_COURS: 'EN_TRANSPORT',
  LIVRE: 'ARRIVE_RELAIS_DESTINATION',
} as const;

export type TransitionSuccess = { updated: true; colisId: string };
export type TransitionSkipped = { updated: false; reason: string };
export type TransitionResult = TransitionSuccess | TransitionSkipped;

/**
 * Applique atomiquement une transition mission + synchro colis dans une transaction.
 *
 * Guard de concurrence : la mise à jour n'est effectuée que si la mission est encore
 * dans `expectedCurrentStatus`. Si un autre appel concurrent a déjà modifié la mission,
 * retourne `{ updated: false }` sans lever d'erreur (idempotent côté appelant).
 *
 * @example
 *   const res = await transitionMission({ missionId, expectedCurrentStatus: 'ASSIGNE', newStatus: 'EN_COURS' });
 *   if (!res.updated) return NextResponse.json({ error: res.reason }, { status: 409 });
 */
export async function transitionMission(params: {
  missionId: string;
  expectedCurrentStatus: string;
  newStatus: string;
  notes?: string;
  syncParcel?: boolean;
}): Promise<TransitionResult> {
  const { missionId, expectedCurrentStatus, newStatus, notes, syncParcel = true } = params;
  const normalizedCurrent = normalizeMissionStatus(expectedCurrentStatus);
  const normalizedNext = normalizeMissionStatus(newStatus);

  assertMissionTransition(normalizedCurrent, normalizedNext);

  const transitionResult = await db.$transaction(async (tx) => {
    // Optimistic concurrency : updateMany avec guard sur le statut actuel.
    // Si la mission a déjà été transitionée (race condition), count === 0.
    const result = await tx.mission.updateMany({
      where: { id: missionId, status: expectedCurrentStatus },
      data: {
        status: normalizedNext,
        // completedAt uniquement si terminal ; undefined n'écrase pas la valeur existante
        ...(normalizedNext === 'LIVRE' ? { completedAt: new Date() } : {}),
      },
    });

    if (result.count === 0) {
      return {
        updated: false,
        reason: `Transition ignorée : mission "${missionId}" n'est plus en statut "${expectedCurrentStatus}" (modification concurrente détectée)`,
      } satisfies TransitionSkipped;
    }

    // Récupère colisId — nécessaire pour la synchro colis
    const mission = await tx.mission.findUnique({
      where: { id: missionId },
      select: { colisId: true, transporteurId: true },
    });

    if (!mission) {
      // Ne devrait jamais arriver mais lève une erreur descriptive
      throw new Error(`[mission-parcel-sync] Mission "${missionId}" introuvable après updateMany`);
    }

    const targetParcelStatus = MISSION_TO_PARCEL_STATUS[normalizedNext];
    if (syncParcel && targetParcelStatus) {
      // Mise à jour colis DANS la même transaction → cohérence garantie
      await tx.colis.update({
        where: { id: mission.colisId },
        data: { status: targetParcelStatus },
        select: { id: true },
      });

      await tx.trackingHistory.create({
        data: {
          colisId: mission.colisId,
          status: targetParcelStatus,
          notes: notes ?? defaultTrackingNote(normalizedNext),
        },
      });
    }

    return {
      updated: true,
      colisId: mission.colisId,
      transporteurId: mission.transporteurId,
      parcelStatus: syncParcel ? targetParcelStatus : undefined,
    } as TransitionSuccess & { transporteurId: string; parcelStatus?: string };
  });

  if (!transitionResult.updated) {
    return transitionResult;
  }

  const missionEventType =
    normalizedNext === 'ASSIGNE'
      ? 'MISSION_ASSIGNED'
      : normalizedNext === 'EN_COURS'
        ? 'MISSION_ACCEPTED'
        : normalizedNext === 'LIVRE'
          ? 'MISSION_COMPLETED'
          : null;

  if (missionEventType) {
    await emitEvent({
      type: missionEventType,
      aggregateType: 'mission',
      aggregateId: missionId,
      payload: {
        missionId,
        transporteurId: transitionResult.transporteurId,
        colisId: transitionResult.colisId,
        fromStatus: normalizedCurrent,
        toStatus: normalizedNext,
      },
    });
  }

  if (transitionResult.parcelStatus) {
    const parcelRow = await db.colis.findUnique({
      where: { id: transitionResult.colisId },
      select: {
        id: true,
        clientId: true,
        relaisDepartId: true,
        relaisArriveeId: true,
        status: true,
      },
    });

    if (parcelRow) {
      const parcelEventType =
        transitionResult.parcelStatus === 'EN_TRANSPORT'
          ? 'PARCEL_IN_TRANSIT'
          : transitionResult.parcelStatus === 'ARRIVE_RELAIS_DESTINATION'
            ? 'PARCEL_ARRIVED_RELAY'
            : null;

      if (parcelEventType) {
        await emitEvent({
          type: parcelEventType,
          aggregateType: 'parcel',
          aggregateId: parcelRow.id,
          payload: {
            parcelId: parcelRow.id,
            clientId: parcelRow.clientId,
            relaisDepartId: parcelRow.relaisDepartId,
            relaisArriveeId: parcelRow.relaisArriveeId,
            status: parcelRow.status,
            missionId,
          },
        });
      }
    }
  }

  return transitionResult;
}

function defaultTrackingNote(missionStatus: string): string {
  const notes: Record<string, string> = {
    EN_COURS: 'Transport en cours',
    LIVRE: 'Colis arrivé au relais de destination',
    ANNULE: 'Mission annulée',
  };
  return notes[missionStatus] ?? `Statut mission: ${missionStatus}`;
}
