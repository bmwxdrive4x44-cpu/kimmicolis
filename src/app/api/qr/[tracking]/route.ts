import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET parcel by tracking number (for QR scan)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tracking: string }> }
) {
  try {
    const { tracking } = await params;

    const parcel = await db.colis.findUnique({
      where: { trackingNumber: tracking },
      include: {
        client: { select: { name: true, phone: true } },
        relaisDepart: { select: { commerceName: true, ville: true, address: true } },
        relaisArrivee: { select: { commerceName: true, ville: true, address: true } },
      },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    return NextResponse.json(parcel);
  } catch (error) {
    console.error('Error fetching parcel by tracking:', error);
    return NextResponse.json({ error: 'Failed to fetch parcel' }, { status: 500 });
  }
}

// POST update parcel status via QR scan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tracking: string }> }
) {
  try {
    const { tracking } = await params;
    const body = await request.json();
    const { action, relaisId } = body;

    const parcel = await db.colis.findUnique({
      where: { trackingNumber: tracking },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    let newStatus = parcel.status;
    let notes = '';

    if (action === 'receive') {
      // Relay receives parcel from client
      if (parcel.relaisDepartId === relaisId) {
        newStatus = 'RECU_RELAIS';
        notes = 'Colis reçu au point relais de départ';
      }
      // Relay receives parcel from transporter (destination)
      else if (parcel.relaisArriveeId === relaisId) {
        newStatus = 'ARRIVE_RELAIS_DESTINATION';
        notes = 'Colis arrivé au point relais de destination';
      }
    } else if (action === 'deliver') {
      // Client picks up parcel
      newStatus = 'LIVRE';
      notes = 'Colis remis au client';
    }

    // Update parcel
    const updatedParcel = await db.colis.update({
      where: { trackingNumber: tracking },
      data: {
        status: newStatus,
        deliveredAt: newStatus === 'LIVRE' ? new Date() : null,
      },
    });

    // Add tracking history
    await db.trackingHistory.create({
      data: {
        colisId: parcel.id,
        status: newStatus,
        notes,
      },
    });

    // Create notification for client
    await db.notification.create({
      data: {
        userId: parcel.clientId,
        title: 'Mise à jour de votre colis',
        message: `Votre colis ${tracking} - ${notes}`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({
      success: true,
      parcel: updatedParcel,
      message: notes,
    });
  } catch (error) {
    console.error('Error processing QR scan:', error);
    return NextResponse.json({ error: 'Failed to process scan' }, { status: 500 });
  }
}
