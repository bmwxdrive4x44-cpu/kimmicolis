import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * POST /api/delivery/confirm
 * Transporter confirms delivery of a parcel via QR scan.
 * Updates the mission and parcel status.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { trackingNumber, qrData, missionId, location } = body;

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

    let parcel;
    let mission;

    if (missionId) {
      mission = await db.mission.findUnique({
        where: { id: missionId },
        include: { colis: true },
      });
      if (!mission) {
        return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
      }
      parcel = mission.colis;
    } else {
      parcel = await db.colis.findUnique({
        where: { trackingNumber: tracking },
      });
      if (!parcel) {
        return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
      }
      // Find associated mission for this transporter
      mission = await db.mission.findFirst({
        where: {
          colisId: parcel.id,
          transporteurId: auth.payload.id,
          status: { in: ['ASSIGNE', 'EN_COURS'] },
        },
      });
    }

    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    // Update parcel status to ARRIVE_RELAIS_DESTINATION
    const updatedParcel = await db.colis.update({
      where: { id: parcel.id },
      data: { status: 'ARRIVE_RELAIS_DESTINATION' },
    });

    // Update mission status
    if (mission) {
      await db.mission.update({
        where: { id: mission.id },
        data: { status: 'LIVRE', completedAt: new Date() },
      });
    }

    // Add tracking history
    await db.trackingHistory.create({
      data: {
        colisId: parcel.id,
        status: 'ARRIVE_RELAIS_DESTINATION',
        location: location || undefined,
        notes: 'Colis livré au relais de destination par le transporteur',
      },
    });

    // Notify client
    await db.notification.create({
      data: {
        userId: parcel.clientId,
        title: 'Votre colis est arrivé',
        message: `Votre colis ${parcel.trackingNumber} est arrivé au point relais de destination. Vous pouvez le récupérer.`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({
      success: true,
      parcel: updatedParcel,
      message: 'Livraison confirmée au relais de destination',
    });
  } catch (error) {
    console.error('Error confirming delivery:', error);
    return NextResponse.json({ error: 'Failed to confirm delivery' }, { status: 500 });
  }
}
