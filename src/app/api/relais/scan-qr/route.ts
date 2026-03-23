import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RELAY_BLOCK_THRESHOLD_DA } from '@/lib/constants';
import { createHash } from 'crypto';

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '').replace(/[^+\d]/g, '');
}

function hashWithdrawalCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

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
    const {
      trackingNumber,
      qrData,
      relaisId,
      userId,
      action,
      cashAmount,
      photoUrl,
      actionBy,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      withdrawalCode,
    } = body;

    const relayActions = new Set(['validate_payment', 'deposit_scan', 'receive_transporter', 'deliver_client', 'receive', 'deliver']);
    let actingRelaisId = typeof relaisId === 'string' && relaisId.trim().length > 0 ? relaisId.trim() : undefined;
    const actorUserId = typeof actionBy === 'string' && actionBy.trim().length > 0
      ? actionBy.trim()
      : typeof userId === 'string' && userId.trim().length > 0
        ? userId.trim()
        : undefined;

    if (actorUserId) {
      const relayFromUser = await db.relais.findUnique({
        where: { userId: actorUserId },
        select: { id: true, commerceName: true },
      });

      if (relayFromUser) {
        if (actingRelaisId && actingRelaisId !== relayFromUser.id) {
          return NextResponse.json(
            { error: `Relais invalide pour cet utilisateur. Relais attendu: ${relayFromUser.commerceName}` },
            { status: 403 }
          );
        }
        actingRelaisId = relayFromUser.id;
      }
    }

    if (relayActions.has(action) && !actingRelaisId) {
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
    const relais = actingRelaisId ? await db.relais.findUnique({ where: { id: actingRelaisId } }) : null;
    if (!relais) {
      return NextResponse.json({ error: 'Point relais non trouvé' }, { status: 404 });
    }
    // Block check: if cashCollected - cashReversed >= threshold, prevent new operations
    const unreversed = relais.cashCollected - relais.cashReversed;
    if (unreversed >= RELAY_BLOCK_THRESHOLD_DA) {
      return NextResponse.json(
        { error: 'Ce point relais a atteint le seuil de cash. Veuillez contacter l\'administrateur.' },
        { status: 403 }
      );
    }

    // Determine effective action from parcel status if not explicit
    let effectiveAction = action;
    if (!effectiveAction) {
      if (parcel.status === 'CREATED' && parcel.relaisDepartId === actingRelaisId) {
        effectiveAction = 'validate_payment';
      } else if (parcel.status === 'PAID_RELAY' && parcel.relaisDepartId === actingRelaisId) {
        effectiveAction = 'deposit_scan';
      } else if (parcel.status === 'PICKED_UP' && parcel.relaisArriveeId === actingRelaisId) {
        effectiveAction = 'receive_transporter';
      } else if (parcel.status === 'ARRIVED_RELAY' && parcel.relaisArriveeId === actingRelaisId) {
        effectiveAction = 'deliver_client';
      }
      // Legacy fallback
      else if (action === 'receive') {
        effectiveAction = parcel.relaisDepartId === actingRelaisId ? 'validate_payment' : 'receive_transporter';
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
      if (parcel.relaisDepartId !== actingRelaisId) {
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
      // Record cash transaction
      await db.relaisCash.create({
        data: {
          relaisId: actingRelaisId!,
          colisId: parcel.id,
          type: 'COLLECTED',
          amount,
          notes: `Cash encaissé pour colis ${tracking}`,
        },
      });

      // Update relay total collected
      const newTotal = relais.cashCollected + amount;
      const newUnreversed = newTotal - relais.cashReversed;

      await db.relais.update({
        where: { id: actingRelaisId! },
        data: { cashCollected: newTotal },
      });

      if (newUnreversed >= RELAY_BLOCK_THRESHOLD_DA) {
        const admins = await db.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await db.notification.create({
            data: {
              userId: admin.id,
              title: '⚠️ Seuil cash relais atteint',
              message: `Le relais "${relais.commerceName}" a dépassé ${RELAY_BLOCK_THRESHOLD_DA} DA non reversés (${newUnreversed.toFixed(0)} DA).`,
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
      if (parcel.relaisDepartId !== actingRelaisId) {
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
      if (parcel.relaisArriveeId !== actingRelaisId) {
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
      if (parcel.relaisArriveeId !== actingRelaisId) {
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

      if (
        !recipientFirstName?.trim() ||
        !recipientLastName?.trim() ||
        !recipientPhone?.trim() ||
        !withdrawalCode?.trim()
      ) {
        return NextResponse.json(
          { error: 'Vérification incomplète: nom, prénom, téléphone et code de retrait requis' },
          { status: 400 }
        );
      }

      const expectedFirstName = parcel.recipientFirstName;
      const expectedLastName = parcel.recipientLastName;
      const expectedPhone = parcel.recipientPhone;
      const expectedCodeHash = parcel.withdrawalCodeHash;

      if (!expectedFirstName || !expectedLastName || !expectedPhone || !expectedCodeHash) {
        return NextResponse.json(
          { error: 'Ce colis ne contient pas les informations de sécurité nécessaires' },
          { status: 400 }
        );
      }

      const identityMatches =
        normalizeName(expectedFirstName) === normalizeName(recipientFirstName) &&
        normalizeName(expectedLastName) === normalizeName(recipientLastName) &&
        normalizePhone(expectedPhone) === normalizePhone(recipientPhone);
      const codeMatches = hashWithdrawalCode(String(withdrawalCode).trim()) === expectedCodeHash;

      if (!identityMatches || !codeMatches) {
        return NextResponse.json(
          { error: 'Vérification échouée: identité, téléphone ou code de retrait invalide' },
          { status: 403 }
        );
      }

      newStatus = 'DELIVERED';
      notes = 'Colis remis au client après double vérification identité + code';
      updateData.deliveredAt = new Date();
      if (photoUrl) updateData.photoLivraison = photoUrl;

      // Release transporter gains on delivery
      const missions = await db.mission.findMany({
        where: { colisId: parcel.id, status: { in: ['ASSIGNE', 'PICKED_UP', 'COMPLETED'] } },
      });
      for (const m of missions) {
        await db.mission.update({
          where: { id: m.id },
          data: { completedAt: m.completedAt ?? new Date() },
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
