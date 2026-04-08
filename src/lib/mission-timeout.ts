import { db } from '@/lib/db';
import { rankTransportersForMatching } from '@/lib/transporter-scoring';
import { createNotificationDedup } from '@/lib/notifications';

export type TimeoutRunOptions = {
  actorId?: string | null;
};

export type TimeoutReassignment = {
  fromTransporteurId: string;
  toTransporteurId: string;
  score: number;
  colisId: string;
};

export async function processMissionAssignmentTimeouts(
  options: TimeoutRunOptions = {}
): Promise<{ reassigned: TimeoutReassignment[]; extendedCount: number; expiredCount: number }> {
  const { actorId = null } = options;
  const now = new Date();

  const expiredMissions = await (db as any).mission.findMany({
    where: {
      status: { in: ['ASSIGNE'] },
      assignmentDeadline: { lte: now },
      relaisConfirmed: false,
    },
    include: {
      colis: { select: { id: true, status: true, villeDepart: true, villeArrivee: true } },
      transporteur: { select: { id: true, name: true, email: true } },
    },
  });

  if (expiredMissions.length === 0) {
    return { reassigned: [], extendedCount: 0, expiredCount: 0 };
  }

  const reassignedMissions: TimeoutReassignment[] = [];
  let extendedCount = 0;

  for (const mission of expiredMissions) {
    const colis = mission.colis;

    const candidateTransporters = await rankTransportersForMatching(
      colis.villeDepart,
      colis.villeArrivee,
      5
    );

    const alternates = candidateTransporters.filter((t) => t.transporteurId !== mission.transporteurId);

    if (alternates.length === 0) {
      await (db as any).mission.update({
        where: { id: mission.id },
        data: {
          status: 'ASSIGNE',
          assignmentDeadline: new Date(now.getTime() + 30 * 60 * 1000),
        },
      });

      await createNotificationDedup({
        userId: mission.transporteur.id,
        title: 'Délai prolongé d\'acceptation',
        message: `Vous avez 30 minutes de plus pour confirmer la réception du colis #${colis.id}`,
        type: 'IN_APP',
      });

      extendedCount += 1;
      continue;
    }

    const nextTransporteur = alternates[0];

    const newMission = await (db as any).mission.create({
      data: {
        colisId: colis.id,
        transporteurId: nextTransporteur.transporteurId,
        status: 'ASSIGNE',
        assignmentDeadline: new Date(now.getTime() + 30 * 60 * 1000),
      },
    });

    await (db as any).mission.update({
      where: { id: mission.id },
      data: {
        status: 'ANNULE',
      },
    });

    await (db as any).actionLog.create({
      data: {
        eventId: `MISSION_TIMEOUT_REASSIGN:${mission.id}:${newMission.id}`,
        scope: 'MISSION_REASSIGN',
        userId: actorId,
        entityType: 'MISSION',
        entityId: mission.id,
        action: 'MISSION_AUTO_REASSIGNED',
        details: JSON.stringify({
          originalMissionId: mission.id,
          newMissionId: newMission.id,
          originalTransporteurId: mission.transporteurId,
          newTransporteurId: nextTransporteur.transporteurId,
          reason: 'assignment_timeout',
          colisId: colis.id,
          source: actorId ? 'manual-or-admin' : 'system',
        }),
      },
    });

    await db.trackingHistory.create({
      data: {
        colisId: colis.id,
        status: colis.status,
        notes: `Mission réassignée automatiquement: ancien transporteur ${mission.transporteur.name} → nouveau transporteur (score: ${nextTransporteur.score}/100)`,
        userId: actorId,
      },
    });

    await createNotificationDedup({
      userId: mission.transporteur.id,
      title: 'Mission expirée',
      message: `Vous n'avez pas confirmer la réception du colis #${colis.id} à temps. La mission a été réassignée.`,
      type: 'IN_APP',
    });

    const newTransporterUser = await db.user.findUnique({
      where: { id: nextTransporteur.transporteurId },
    });

    if (newTransporterUser) {
      await createNotificationDedup({
        userId: nextTransporteur.transporteurId,
        title: 'Nouvelle mission assignée',
        message: `Nouvelle mission auto-assignée: colis #${colis.id} (score matching: ${nextTransporteur.score}/100)`,
        type: 'IN_APP',
      });
    }

    reassignedMissions.push({
      fromTransporteurId: mission.transporteurId,
      toTransporteurId: nextTransporteur.transporteurId,
      score: nextTransporteur.score,
      colisId: colis.id,
    });
  }

  return {
    reassigned: reassignedMissions,
    extendedCount,
    expiredCount: expiredMissions.length,
  };
}
