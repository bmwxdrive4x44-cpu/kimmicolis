import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events/store';
import { createNotificationDedup } from '@/lib/notifications';
import { requireRole } from '@/lib/rbac';
import { applyTransition, canTransition } from '@/lib/parcelStateMachine';
import { transitionMission } from '@/lib/mission-parcel-sync';
import { normalizeMissionStatus } from '@/lib/missionStateMachine';

function isPrismaSchemaError(err: unknown): boolean {
  const code = String((err as { code?: string }).code ?? '');
  return code === 'P2022' || code === 'P2010';
}

/**
 * POST /api/delivery/confirm
 * Transporter scans QR code at key steps.
 *
 * Actions:
 *   - "pickup": Transporter scans QR when picking up parcel from relay
 *       DEPOSITED_RELAY / ASSIGNED → PICKED_UP
 *   - "arrive_relay": Transporter scans QR when dropping off at destination relay
 *       PICKED_UP → ARRIVED_RELAY
 *
 * Legacy action (backward compat):
 *   - (no action / default): ARRIVE_RELAIS_DESTINATION
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { trackingNumber, qrData, missionId, action, location, photoUrl, eventId: bodyEventId } = body;

    // Parse tracking from QR data if not directly provided
    let tracking = trackingNumber;
    if (!tracking && qrData) {
      try {
        const parsed = JSON.parse(qrData);
        tracking = parsed.tracking;
      } catch {
        tracking = qrData;
      }
    }

    if (!tracking && !missionId) {
      return NextResponse.json(
        { error: 'trackingNumber, qrData, or missionId is required' },
        { status: 400 }
      );
    }

    // Resolve parcel and mission
    let parcel;
    let mission;

    if (missionId) {
      mission = await db.mission.findUnique({
        where: { id: missionId },
        include: { colis: true },
      });
      if (!mission) {
        return NextResponse.json({ error: 'Mission non trouvée' }, { status: 404 });
      }

      if (auth.payload.role === 'TRANSPORTER' && mission.transporteurId !== auth.payload.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      parcel = mission.colis;
    } else {
      parcel = await db.colis.findUnique({ where: { trackingNumber: tracking } });
      if (!parcel) {
        return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
      }
      mission = await db.mission.findFirst({
        where: {
          colisId: parcel.id,
          transporteurId: auth.payload.id,
          status: { in: ['ASSIGNE', 'EN_COURS'] },
        },
      });
    }

    if (!parcel) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    // Determine effective action
    let effectiveAction = action;
    if (!effectiveAction) {
      // Auto-detect from parcel status
      if (['DEPOSITED_RELAY', 'ASSIGNED', 'RECU_RELAIS'].includes(parcel.status)) {
        effectiveAction = 'pickup';
      } else if (['PICKED_UP', 'EN_TRANSPORT'].includes(parcel.status)) {
        effectiveAction = 'arrive_relay';
      } else {
        effectiveAction = 'arrive_relay'; // legacy default
      }
    }

    const effectiveEventId =
      (typeof bodyEventId === 'string' && bodyEventId.trim().length > 0 ? bodyEventId.trim() : null) ||
      request.headers.get('x-event-id') ||
      `${effectiveAction || 'unknown'}:${parcel.id}:${mission?.id || 'no-mission'}`;

    const existingEvent = await db.actionLog.findFirst({
      where: {
        scope: 'DELIVERY',
        entityType: 'COLIS',
        entityId: parcel.id,
        eventId: effectiveEventId,
      },
      select: { id: true },
    });

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Événement déjà traité',
      });
    }

    let newParcelStatus: string;
    let newMissionStatus: string;
    let notes: string;
    const parcelUpdateData: Record<string, unknown> = {};

    // ──────────────────────────────────────────────
    // ACTION: pickup
    // Transporter picks up parcel at departure relay
    // ──────────────────────────────────────────────
    if (effectiveAction === 'pickup') {
      // DEPOSITED_RELAY/ASSIGNED = new workflow; RECU_RELAIS = legacy backward compat
      const validStatuses = ['DEPOSITED_RELAY', 'ASSIGNED', 'RECU_RELAIS'];
      if (!validStatuses.includes(parcel.status)) {
        return NextResponse.json(
          { error: `Impossible de prendre en charge un colis avec le statut: ${parcel.status}` },
          { status: 400 }
        );
      }
      newParcelStatus = applyTransition(parcel.status === 'ASSIGNED' || parcel.status === 'RECU_RELAIS' ? 'DEPOSITED_RELAY' : parcel.status, 'PICKED_UP');
      newMissionStatus = 'EN_COURS';
      notes = 'Colis pris en charge par le transporteur';
      parcelUpdateData.custody = 'TRANSPORTEUR';
    }

    // ──────────────────────────────────────────────
    // ACTION: arrive_relay
    // Transporter delivers parcel to destination relay
    // ──────────────────────────────────────────────
    else if (effectiveAction === 'arrive_relay') {
      if (!['PICKED_UP', 'IN_TRANSIT', 'EN_TRANSPORT'].includes(parcel.status)) {
        return NextResponse.json(
          { error: `Impossible de livrer au relais un colis avec le statut: ${parcel.status}` },
          { status: 400 }
        );
      }

      if (canTransition(parcel.status, 'ARRIVED_RELAY')) {
        newParcelStatus = applyTransition(parcel.status, 'ARRIVED_RELAY');
      } else {
        // Support one-scan arrival by traversing PICKED_UP -> IN_TRANSIT -> ARRIVED_RELAY via state machine.
        const inTransit = applyTransition(parcel.status, 'IN_TRANSIT');
        newParcelStatus = applyTransition(inTransit, 'ARRIVED_RELAY');
      }

      newMissionStatus = 'LIVRE';
      notes = 'Colis livré au relais de destination par le transporteur';
      parcelUpdateData.custody = 'RELAIS_DEST';
    } else {
      return NextResponse.json({ error: `Action inconnue: ${effectiveAction}` }, { status: 400 });
    }

    // Update parcel
    let updatedParcel: { id: string; status: string; deliveredAt: Date | null };
    try {
      updatedParcel = await db.colis.update({
        where: { id: parcel.id },
        data: { status: newParcelStatus, ...parcelUpdateData },
        select: { id: true, status: true, deliveredAt: true },
      });
    } catch (custodyErr) {
      if (isPrismaSchemaError(custodyErr)) {
        // Fallback: update without custody field
        const { custody: _custody, ...safeUpdateData } = parcelUpdateData as Record<string, unknown> & { custody?: unknown };
        void _custody;
        updatedParcel = await db.colis.update({
          where: { id: parcel.id },
          data: { status: newParcelStatus, ...safeUpdateData },
          select: { id: true, status: true, deliveredAt: true },
        });
      } else {
        throw custodyErr;
      }
    }

    // Update mission
    if (mission) {
      const normalizedCurrent = normalizeMissionStatus(String(mission.status));
      const normalizedNext = normalizeMissionStatus(newMissionStatus);

      if (normalizedCurrent !== normalizedNext) {
        const transitionResult = await transitionMission({
          missionId: mission.id,
          expectedCurrentStatus: mission.status,
          newStatus: newMissionStatus,
          notes,
          syncParcel: false,
        });

        if (!transitionResult.updated) {
          return NextResponse.json(
            { error: transitionResult.reason, code: 'CONCURRENT_MODIFICATION' },
            { status: 409 }
          );
        }
      }
    }

    // Add tracking history
    await db.trackingHistory.create({
      data: {
        colisId: parcel.id,
        status: newParcelStatus,
        location: location ?? null,
        notes,
        userId: auth.payload.id,
      },
    });

    // Notify client
    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Mise à jour de votre colis',
      message: `${notes} — Colis: ${parcel.trackingNumber}`,
      type: 'IN_APP',
    });

    await db.actionLog.create({
      data: {
        eventId: effectiveEventId,
        scope: 'DELIVERY',
        userId: auth.payload.id,
        entityType: 'COLIS',
        entityId: parcel.id,
        action: `DELIVERY_EVENT:${effectiveEventId}`,
        details: JSON.stringify({
          missionId: mission?.id || null,
          action: effectiveAction,
          fromStatus: parcel.status,
          toStatus: newParcelStatus,
          location: location || null,
          photoUrl: photoUrl || null,
        }),
      },
    });

    if (effectiveAction === 'pickup') {
      await emitEvent({
        type: 'PARCEL_PICKED_UP',
        aggregateType: 'parcel',
        aggregateId: parcel.id,
        payload: {
          parcelId: parcel.id,
          clientId: parcel.clientId,
          relaisDepartId: parcel.relaisDepartId,
          transporteurId: mission?.transporteurId || auth.payload.id,
          status: newParcelStatus,
        },
      });

      await emitEvent({
        type: 'PARCEL_IN_TRANSIT',
        aggregateType: 'parcel',
        aggregateId: parcel.id,
        payload: {
          parcelId: parcel.id,
          clientId: parcel.clientId,
          status: newParcelStatus,
          transporteurId: mission?.transporteurId || auth.payload.id,
        },
      });
    }

    if (effectiveAction === 'arrive_relay') {
      await emitEvent({
        type: 'PARCEL_ARRIVED_RELAY',
        aggregateType: 'parcel',
        aggregateId: parcel.id,
        payload: {
          parcelId: parcel.id,
          clientId: parcel.clientId,
          relaisArriveeId: parcel.relaisArriveeId,
          status: newParcelStatus,
          transporteurId: mission?.transporteurId || auth.payload.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      parcel: updatedParcel,
      message: notes,
      newStatus: newParcelStatus,
    });
  } catch (error) {
    console.error('Error confirming delivery step:', error);
    return NextResponse.json({ error: 'Failed to process delivery action' }, { status: 500 });
  }
}
