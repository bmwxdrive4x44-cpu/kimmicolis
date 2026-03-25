import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createNotificationDedup } from '@/lib/notifications';
import { requireRole } from '@/lib/rbac';

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
    const { trackingNumber, qrData, missionId, action, location, photoUrl } = body;

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
          status: { in: ['ASSIGNE', 'PICKED_UP'] },
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

    let newParcelStatus: string;
    let newMissionStatus: string;
    let notes: string;
    const parcelUpdateData: Record<string, unknown> = {};
    const missionUpdateData: Record<string, unknown> = {};

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
      newParcelStatus = 'PICKED_UP';
      newMissionStatus = 'PICKED_UP';
      notes = 'Colis pris en charge par le transporteur';
    }

    // ──────────────────────────────────────────────
    // ACTION: arrive_relay
    // Transporter delivers parcel to destination relay
    // ──────────────────────────────────────────────
    else if (effectiveAction === 'arrive_relay') {
      if (!['PICKED_UP', 'EN_TRANSPORT'].includes(parcel.status)) {
        return NextResponse.json(
          { error: `Impossible de livrer au relais un colis avec le statut: ${parcel.status}` },
          { status: 400 }
        );
      }
      newParcelStatus = 'ARRIVED_RELAY';
      newMissionStatus = 'COMPLETED';
      notes = 'Colis livré au relais de destination par le transporteur';
      missionUpdateData.completedAt = new Date();
    } else {
      return NextResponse.json({ error: `Action inconnue: ${effectiveAction}` }, { status: 400 });
    }

    // Update parcel
    const updatedParcel = await db.colis.update({
      where: { id: parcel.id },
      data: { status: newParcelStatus, ...parcelUpdateData },
    });

    // Update mission
    if (mission) {
      await db.mission.update({
        where: { id: mission.id },
        data: { status: newMissionStatus, ...missionUpdateData },
      });
    }

    // Add tracking history
    await db.trackingHistory.create({
      data: {
        colisId: parcel.id,
        status: newParcelStatus,
        location: location ?? null,
        notes,
      },
    });

    // Notify client
    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Mise à jour de votre colis',
      message: `${notes} — Colis: ${parcel.trackingNumber}`,
      type: 'IN_APP',
    });

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
