import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RELAY_BLOCK_THRESHOLD_DA } from '@/lib/constants';

/**
 * POST /api/relais/scan-qr
 * Handle all relay QR scanning actions.
 *
 * Actions:
 *   - "validate_payment": Relay validates cash payment from client
 *       CREATED → PAID_RELAY  (requires cashAmount)
 *   - "deposit_scan": Relay scans QR code to confirm parcel deposit
 *       PAID_RELAY → DEPOSITED_RELAY  (optional photoUrl)
 *   - "receive_transporter": Relay destination receives parcel from transporter
 *       PICKED_UP → ARRIVED_RELAY
 *   - "deliver_client": Relay delivers parcel to client
 *       ARRIVED_RELAY → DELIVERED
 *
 * Legacy actions (kept for backward compatibility):
 *   - "receive": maps to validate_payment or receive_transporter depending on context
 *   - "deliver": maps to deliver_client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackingNumber, qrData, relaisId, action, cashAmount, photoUrl, actionBy } = body;

    if (!relaisId) {
      return NextResponse.json({ error: 'relaisId est requis' }, { status: 400 });
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
      return NextResponse.json({ error: 'trackingNumber ou qrData est requis' }, { status: 400 });
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

    // Verify relay is not blocked
    const relais = await db.relais.findUnique({ where: { id: relaisId } });
    if (!relais) {
      return NextResponse.json({ error: 'Point relais non trouvé' }, { status: 404 });
    }
    if (relais.isBlocked) {
      return NextResponse.json(
        { error: 'Ce point relais est bloqué. Veuillez contacter l\'administrateur.' },
        { status: 403 }
      );
    }

    // Determine effective action from parcel status if not explicit
    let effectiveAction = action;
    if (!effectiveAction) {
      if (parcel.status === 'CREATED' && parcel.relaisDepartId === relaisId) {
        effectiveAction = 'validate_payment';
      } else if (parcel.status === 'PAID_RELAY' && parcel.relaisDepartId === relaisId) {
        effectiveAction = 'deposit_scan';
      } else if (parcel.status === 'PICKED_UP' && parcel.relaisArriveeId === relaisId) {
        effectiveAction = 'receive_transporter';
      } else if (parcel.status === 'ARRIVED_RELAY' && parcel.relaisArriveeId === relaisId) {
        effectiveAction = 'deliver_client';
      }
      // Legacy fallback
      else if (action === 'receive') {
        effectiveAction = parcel.relaisDepartId === relaisId ? 'validate_payment' : 'receive_transporter';
      } else if (action === 'deliver') {
        effectiveAction = 'deliver_client';
      }
    }

    let newStatus = parcel.status;
    let notes = '';
    const updateData: Record<string, unknown> = {};

    // ──────────────────────────────────────────────
    // ACTION: validate_payment
    // Client pays cash at departure relay
    // ──────────────────────────────────────────────
    if (effectiveAction === 'validate_payment') {
      if (parcel.relaisDepartId !== relaisId) {
        return NextResponse.json(
          { error: 'Ce relais n\'est pas le relais de départ de ce colis' },
          { status: 403 }
        );
      }
      if (!['CREATED', 'PAID'].includes(parcel.status)) {
        return NextResponse.json(
          { error: `Impossible de valider le paiement pour un colis avec le statut: ${parcel.status}` },
          { status: 400 }
        );
      }
      const amount = cashAmount ?? parcel.prixClient;
      newStatus = 'PAID_RELAY';
      notes = `Paiement cash validé: ${amount} DA par le relais ${relais.commerceName}`;
      updateData.cashCollectedByRelay = amount;
      updateData.cashCollectedAt = new Date();

      // Record cash transaction
      await db.cashTransaction.create({
        data: {
          relaisId,
          colisId: parcel.id,
          type: 'COLLECTED',
          amount,
          description: `Cash encaissé pour colis ${tracking}`,
        },
      });

      // Update relay total collected and check block threshold
      const newTotal = relais.totalEncaisse + amount;
      const unReversed = newTotal - relais.totalReverseé;
      const shouldBlock = unReversed >= RELAY_BLOCK_THRESHOLD_DA;

      await db.relais.update({
        where: { id: relaisId },
        data: {
          totalEncaisse: newTotal,
          isBlocked: shouldBlock,
        },
      });

      if (shouldBlock) {
        // Notify admin
        const admins = await db.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await db.notification.create({
            data: {
              userId: admin.id,
              title: '⚠️ Relais bloqué automatiquement',
              message: `Le relais "${relais.commerceName}" a dépassé le seuil de ${RELAY_BLOCK_THRESHOLD_DA} DA non reversés (${unReversed.toFixed(0)} DA).`,
              type: 'IN_APP',
            },
          });
        }
      }
    }

    // ──────────────────────────────────────────────
    // ACTION: deposit_scan
    // Relay scans QR to confirm parcel is physically deposited
    // ──────────────────────────────────────────────
    else if (effectiveAction === 'deposit_scan') {
      if (parcel.relaisDepartId !== relaisId) {
        return NextResponse.json(
          { error: 'Ce relais n\'est pas le relais de départ de ce colis' },
          { status: 403 }
        );
      }
      if (!['PAID_RELAY', 'PAID', 'RECU_RELAIS'].includes(parcel.status)) {
        return NextResponse.json(
          { error: `Impossible de scanner le dépôt pour un colis avec le statut: ${parcel.status}` },
          { status: 400 }
        );
      }
      newStatus = 'DEPOSITED_RELAY';
      notes = `Colis scanné et déposé au relais ${relais.commerceName}`;
      if (photoUrl) updateData.photoDepot = photoUrl;
    }

    // ──────────────────────────────────────────────
    // ACTION: receive_transporter
    // Destination relay receives parcel from transporter
    // ──────────────────────────────────────────────
    else if (effectiveAction === 'receive_transporter') {
      if (parcel.relaisArriveeId !== relaisId) {
        return NextResponse.json(
          { error: 'Ce relais n\'est pas le relais de destination de ce colis' },
          { status: 403 }
        );
      }
      if (!['PICKED_UP', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION'].includes(parcel.status)) {
        return NextResponse.json(
          { error: `Impossible de recevoir ce colis avec le statut: ${parcel.status}` },
          { status: 400 }
        );
      }
      newStatus = 'ARRIVED_RELAY';
      notes = `Colis arrivé au relais de destination ${relais.commerceName}`;
    }

    // ──────────────────────────────────────────────
    // ACTION: deliver_client
    // Client picks up parcel from destination relay
    // ──────────────────────────────────────────────
    else if (effectiveAction === 'deliver_client') {
      if (parcel.relaisArriveeId !== relaisId) {
        return NextResponse.json(
          { error: 'Ce relais n\'est pas le relais de destination' },
          { status: 403 }
        );
      }
      if (!['ARRIVED_RELAY', 'ARRIVE_RELAIS_DESTINATION'].includes(parcel.status)) {
        return NextResponse.json(
          { error: `Impossible de remettre ce colis avec le statut: ${parcel.status}` },
          { status: 400 }
        );
      }
      newStatus = 'DELIVERED';
      notes = 'Colis remis au client';
      updateData.deliveredAt = new Date();
      if (photoUrl) updateData.photoLivraison = photoUrl;

      // Release transporter gains on delivery
      const missions = await db.mission.findMany({
        where: { colisId: parcel.id, status: { in: ['ASSIGNE', 'PICKED_UP', 'COMPLETED'] } },
      });
      for (const m of missions) {
        await db.mission.update({
          where: { id: m.id },
          data: { gainStatus: 'AVAILABLE', completedAt: m.completedAt ?? new Date() },
        });
      }
    } else {
      return NextResponse.json({ error: `Action inconnue: ${effectiveAction}` }, { status: 400 });
    }

    // Update parcel
    const updatedParcel = await db.colis.update({
      where: { id: parcel.id },
      data: { status: newStatus, ...updateData },
    });

    // Add tracking history
    await db.trackingHistory.create({
      data: {
        colisId: parcel.id,
        status: newStatus,
        notes,
        actionBy: actionBy ?? relaisId,
        photoUrl: photoUrl ?? null,
      },
    });

    // Notify client
    await db.notification.create({
      data: {
        userId: parcel.clientId,
        title: 'Mise à jour de votre colis',
        message: `${notes} — Colis: ${tracking}`,
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
