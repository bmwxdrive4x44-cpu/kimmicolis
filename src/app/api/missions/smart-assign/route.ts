import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { rankTransportersForMatching } from '@/lib/transporter-scoring';
import { escrowMissionEarnings } from '@/lib/wallet-escrow';
import { createNotificationDedup } from '@/lib/notifications';

/**
 * POST /api/missions/smart-assign
 * Intelligent mission assignment using transporter scores
 * (Called after payment received, when parcel ready for transport)
 *
 * Body: { colisId, preferredTransporteurId? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisId, preferredTransporteurId } = body;

    if (!colisId) {
      return NextResponse.json({ error: 'colisId required' }, { status: 400 });
    }

    const colis = await db.colis.findUnique({
      where: { id: colisId },
      include: { client: true },
    });

    if (!colis) {
      return NextResponse.json({ error: 'Colis not found' }, { status: 404 });
    }

    // If preferred transporteur specified, use that
    if (preferredTransporteurId) {
      // TODO: Validate preferred transporteur is valid
      const mission = await (db as any).mission.create({
        data: {
          colisId,
          transporteurId: preferredTransporteurId,
          status: 'ASSIGNE',
          assignmentDeadline: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        },
      });

      // Escrow 50% of earnings
      await escrowMissionEarnings(
        preferredTransporteurId,
        colis.netTransporteur,
        mission.id,
        colisId
      );

      // Notify
      const transporteur = await db.user.findUnique({
        where: { id: preferredTransporteurId },
      });

      if (transporteur) {
        await createNotificationDedup({
          userId: preferredTransporteurId,
          title: 'Nouvelle mission assignée',
          message: `Colis #${colis.trackingNumber} - ${colis.villeDepart} → ${colis.villeArrivee}. Veuillez confirmer dans 30 min.`,
          type: 'IN_APP',
        });
      }

      return NextResponse.json({
        success: true,
        mission: {
          id: mission.id,
          colisId,
          transporteurId: preferredTransporteurId,
          status: 'ASSIGNE',
          earnings: colis.netTransporteur,
        },
      });
    }

    // Smart matching: rank by score
    const candidates = await rankTransportersForMatching(
      colis.villeDepart,
      colis.villeArrivee,
      5
    );

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No available transporters for this route' },
        { status: 404 }
      );
    }

    // Assign to highest score
    const selectedTransporteur = candidates[0];

    const mission = await (db as any).mission.create({
      data: {
        colisId,
        transporteurId: selectedTransporteur.transporteurId,
        status: 'ASSIGNE',
        assignmentDeadline: new Date(Date.now() + 30 * 60 * 1000), // 30 min deadline
      },
    });

    // Escrow 50% of earnings
    await escrowMissionEarnings(
      selectedTransporteur.transporteurId,
      colis.netTransporteur,
      mission.id,
      colisId
    );

    // Log action
    await (db as any).actionLog.create({
      data: {
        eventId: `SMART_ASSIGN:${colisId}:${mission.id}`,
        scope: 'MISSION_ASSIGN',
        userId: auth.payload.id,
        entityType: 'MISSION',
        entityId: mission.id,
        action: 'MISSION_SMART_ASSIGNED',
        details: JSON.stringify({
          missionId: mission.id,
          colisId,
          transporteurId: selectedTransporteur.transporteurId,
          score: selectedTransporteur.score,
          successRate: selectedTransporteur.successRate,
          candidates: candidates.length,
        }),
      },
    });

    // Notify transporteur
    const transporteur = await db.user.findUnique({
      where: { id: selectedTransporteur.transporteurId },
    });

    if (transporteur) {
      await createNotificationDedup({
        userId: selectedTransporteur.transporteurId,
        title: 'Nouvelle mission assignée',
        message: `Colis #${colis.trackingNumber} - ${colis.villeDepart} → ${colis.villeArrivee}. Score de match: ${selectedTransporteur.score}/100. Veuillez confirmer dans 30 min.`,
        type: 'IN_APP',
      });
    }

    // Notify client
    await createNotificationDedup({
      userId: colis.clientId,
      title: 'Transporteur assigné',
      message: `Votre colis #${colis.trackingNumber} a été assigné à un transporteur de confiance. Score: ${selectedTransporteur.score}/100.`,
      type: 'IN_APP',
    });

    return NextResponse.json({
      success: true,
      mission: {
        id: mission.id,
        colisId,
        transporteurId: selectedTransporteur.transporteurId,
        status: 'ASSIGNE',
        score: selectedTransporteur.score,
        earnings: colis.netTransporteur,
        escrowed: colis.netTransporteur * 0.5,
      },
    });
  } catch (error) {
    console.error('[smart-assign] Error:', error);
    return NextResponse.json({ error: 'Failed to assign mission' }, { status: 500 });
  }
}
