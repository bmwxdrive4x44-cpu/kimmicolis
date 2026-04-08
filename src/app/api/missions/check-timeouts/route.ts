import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { rankTransportersForMatching } from '@/lib/transporter-scoring';
import { createNotificationDedup } from '@/lib/notifications';

/**
 * POST /api/missions/check-timeouts
 * Check for expired mission assignments and auto-reassign
 * (Can be triggered by cron job or manual)
 *
 * Timeout default: 30 minutes from assignment
 * If transporteur hasn't confirmed receipt (relaisConfirmed=false),
 * auto-reassign to next best ranked transporteur
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const now = new Date();

    // Get missions with expired deadline and not yet relaisConfirmed
    const expiredMissions = await (db as any).mission.findMany({
      where: {
        status: { in: ['ASSIGNE'] },
        assignmentDeadline: { lte: now },
        relaisConfirmed: false, // Not yet confirmed by relay
      },
      include: {
        colis: { select: { id: true, villeDepart: true, villeArrivee: true, netTransporteur: true } },
        transporteur: { select: { id: true, name: true, email: true } },
      },
    });

    if (expiredMissions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired missions',
        reassigned: 0,
      });
    }

    const reassignedMissions: Array<{ fromTransporteurId: string; toTransporteurId: string; score: number; colisId: string }> = [];

    for (const mission of expiredMissions) {
      const colis = mission.colis;

      // Get ranked transporters for this route
      const candidateTransporters = await rankTransportersForMatching(
        colis.villeDepart,
        colis.villeArrivee,
        5 // Get top 5 candidates
      );

      // Filter out the original transporteur
      const alternates = candidateTransporters.filter((t) => t.transporteurId !== mission.transporteurId);

      if (alternates.length === 0) {
        // No alternates available - mark mission as pending reassignment
        await (db as any).mission.update({
          where: { id: mission.id },
          data: {
            status: 'ASSIGNE', // Keep same status, just extend deadline
            assignmentDeadline: new Date(now.getTime() + 30 * 60 * 1000), // Extend 30 min
          },
        });

        // Notify original transporteur
        await createNotificationDedup({
          userId: mission.transporteur.id,
          title: 'Délai prolongé d\'acceptation',
          message: `Vous avez 30 minutes de plus pour confirmer la réception du colis #${colis.id}`,
          type: 'IN_APP',
        });

        continue;
      }

      // Auto-reassign to next best transporteur
      const nextTransporteur = alternates[0];

      // Create new mission for next transporteur
      const newMission = await (db as any).mission.create({
        data: {
          colisId: colis.id,
          transporteurId: nextTransporteur.transporteurId,
          status: 'ASSIGNE',
          assignmentDeadline: new Date(now.getTime() + 30 * 60 * 1000), // 30 min deadline
        },
      });

      // Mark old mission as timeout
      await (db as any).mission.update({
        where: { id: mission.id },
        data: {
          status: 'ANNULE', // Mark as cancelled due to timeout
        },
      });

      // Log action
      await (db as any).actionLog.create({
        data: {
          eventId: `MISSION_TIMEOUT_REASSIGN:${mission.id}:${newMission.id}`,
          scope: 'MISSION_REASSIGN',
          userId: auth.payload.id,
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
          }),
        },
      });

      // Create tracking history
      await db.trackingHistory.create({
        data: {
          colisId: colis.id,
          status: colis.status,
          notes: `Mission réassignée automatiquement: ancien transporteur ${mission.transporteur.name} → nouveau transporteur (score: ${nextTransporteur.score}/100)`,
          userId: auth.payload.id,
        },
      });

      // Notify original transporteur
      await createNotificationDedup({
        userId: mission.transporteur.id,
        title: 'Mission expirée',
        message: `Vous n'avez pas confirmer la réception du colis #${colis.id} à temps. La mission a été réassignée.`,
        type: 'IN_APP',
      });

      // Notify new transporteur
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

    return NextResponse.json({
      success: true,
      message: `${reassignedMissions.length} mission(s) reassigned`,
      reassigned: reassignedMissions.length,
      details: reassignedMissions,
    });
  } catch (error) {
    console.error('[check-timeouts] Error:', error);
    return NextResponse.json({ error: 'Failed to check timeouts' }, { status: 500 });
  }
}
