import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/relais/scan-qr
 * Handle QR code scanning by relay points.
 * Actions:
 *   - "receive": Relay receives parcel from client (PAID → RECU_RELAIS)
 *   - "deliver": Relay delivers parcel to client (ARRIVE_RELAIS_DESTINATION → LIVRE)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackingNumber, qrData, relaisId, action } = body;

    if (!relaisId) {
      return NextResponse.json({ error: 'relaisId is required' }, { status: 400 });
    }

    // Parse tracking number from QR data if not directly provided
    let tracking = trackingNumber;
    if (!tracking && qrData) {
      try {
        const parsed = JSON.parse(qrData);
        tracking = parsed.tracking;
      } catch {
        tracking = qrData;
      }
    }

    if (!tracking) {
      return NextResponse.json({ error: 'trackingNumber or qrData is required' }, { status: 400 });
    }

    // Find parcel
    const parcel = await db.colis.findUnique({
      where: { trackingNumber: tracking },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        relaisDepart: { select: { id: true, commerceName: true, ville: true } },
        relaisArrivee: { select: { id: true, commerceName: true, ville: true } },
      },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    let newStatus = parcel.status;
    let notes = '';
    const scanAction = action || (parcel.status === 'ARRIVE_RELAIS_DESTINATION' ? 'deliver' : 'receive');

    if (scanAction === 'receive') {
      // Relay depart receives from client
      if (parcel.relaisDepartId === relaisId) {
        if (parcel.status !== 'PAID' && parcel.status !== 'CREATED') {
          return NextResponse.json(
            { error: `Impossible de recevoir un colis avec le statut: ${parcel.status}` },
            { status: 400 }
          );
        }
        newStatus = 'RECU_RELAIS';
        notes = `Colis reçu au point relais de départ (${parcel.relaisDepart.commerceName})`;
      }
      // Relay destination receives from transporter
      else if (parcel.relaisArriveeId === relaisId) {
        if (parcel.status !== 'EN_TRANSPORT') {
          return NextResponse.json(
            { error: `Impossible de recevoir un colis avec le statut: ${parcel.status}` },
            { status: 400 }
          );
        }
        newStatus = 'ARRIVE_RELAIS_DESTINATION';
        notes = `Colis arrivé au point relais de destination (${parcel.relaisArrivee.commerceName})`;
      } else {
        return NextResponse.json(
          { error: 'Ce point relais n\'est pas associé à ce colis' },
          { status: 403 }
        );
      }
    } else if (scanAction === 'deliver') {
      // Client picks up from destination relay
      if (parcel.relaisArriveeId !== relaisId) {
        return NextResponse.json(
          { error: 'Ce point relais n\'est pas le relais de destination' },
          { status: 403 }
        );
      }
      if (parcel.status !== 'ARRIVE_RELAIS_DESTINATION') {
        return NextResponse.json(
          { error: `Impossible de remettre un colis avec le statut: ${parcel.status}` },
          { status: 400 }
        );
      }
      newStatus = 'LIVRE';
      notes = 'Colis remis au client';
    } else {
      return NextResponse.json({ error: `Action inconnue: ${scanAction}` }, { status: 400 });
    }

    // Update parcel
    const updatedParcel = await db.colis.update({
      where: { id: parcel.id },
      data: {
        status: newStatus,
        deliveredAt: newStatus === 'LIVRE' ? new Date() : undefined,
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

    // Notify client
    await db.notification.create({
      data: {
        userId: parcel.clientId,
        title: 'Mise à jour de votre colis',
        message: `${notes} - Colis: ${tracking}`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({
      success: true,
      parcel: updatedParcel,
      message: notes,
      newStatus,
    });
  } catch (error) {
    console.error('Error processing QR scan:', error);
    return NextResponse.json({ error: 'Erreur lors du scan QR' }, { status: 500 });
  }
}
