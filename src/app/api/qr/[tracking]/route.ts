import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { createNotificationDedup } from '@/lib/notifications';

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '').replace(/[^+\d]/g, '');
}

function hashWithdrawalCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

// ─── GET: scan QR → fetch parcel info ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tracking: string }> }
) {
  try {
    const { tracking } = await params;

    const parcel = await db.colis.findUnique({
      where: { trackingNumber: tracking },
      select: {
        id: true,
        trackingNumber: true,
        villeDepart: true,
        villeArrivee: true,
        weight: true,
        prixClient: true,
        commissionRelais: true,
        status: true,
        senderFirstName: true,
        senderLastName: true,
        senderPhone: true,
        recipientFirstName: true,
        recipientLastName: true,
        recipientPhone: true,
        client: { select: { name: true, phone: true } },
        relaisDepart: { select: { id: true, commerceName: true, ville: true, address: true } },
        relaisArrivee: { select: { id: true, commerceName: true, ville: true, address: true } },
        missions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { transporteur: { select: { name: true, phone: true } } },
        },
      },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Colis introuvable' }, { status: 404 });
    }

    return NextResponse.json(parcel);
  } catch (error) {
    console.error('Error fetching parcel by tracking:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ─── POST: process QR scan action ─────────────────────────────────────────────
/**
 * MVP Workflow:
 *   validate_payment  CREATED           → PAID_RELAY          (relay, cash collected)
 *   deposit           PAID_RELAY        → DEPOSITED_RELAY      (relay, QR scan on deposit)
 *   pickup            DEPOSITED_RELAY   → EN_TRANSPORT         (transporter takes the parcel)
 *   arrive_dest       EN_TRANSPORT      → ARRIVE_RELAIS_DESTINATION (destination relay scan)
 *   deliver           ARRIVE_RELAIS_DESTINATION → LIVRE       (client picks up)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tracking: string }> }
) {
  try {
    const { tracking } = await params;
    const body = await request.json();
    const {
      action,
      relaisId,
      transporteurId,
      userId,
      notes: extraNotes,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      withdrawalCode,
    } = body;

    const relayActions = new Set(['validate_payment', 'deposit', 'arrive_dest', 'deliver', 'receive']);
    let actingRelaisId = typeof relaisId === 'string' && relaisId.trim().length > 0 ? relaisId.trim() : undefined;

    if (relayActions.has(action) && userId) {
      const relayFromUser = await db.relais.findUnique({
        where: { userId: String(userId) },
        select: { id: true, commerceName: true },
      });

      if (relayFromUser) {
        if (actingRelaisId && actingRelaisId !== relayFromUser.id) {
          console.warn('[QR] Client relaisId mismatch, resolved from userId', {
            providedRelaisId: actingRelaisId,
            resolvedRelaisId: relayFromUser.id,
            relayName: relayFromUser.commerceName,
            userId,
          });
        }
        actingRelaisId = relayFromUser.id;
      }
    }

    const parcel = await db.colis.findUnique({
      where: { trackingNumber: tracking },
      include: {
        relaisDepart: true,
        relaisArrivee: true,
      },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Colis introuvable' }, { status: 404 });
    }

    let newStatus: string = parcel.status;
    let notes = '';
    let extraData: Record<string, unknown> = {};

    // ── validate_payment ────────────────────────────────────────────────────────
    if (action === 'validate_payment') {
      if (parcel.status !== 'CREATED') {
        return NextResponse.json({ error: `Action invalide : statut actuel ${parcel.status}` }, { status: 400 });
      }
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (userId/relaisId manquant)' }, { status: 400 });
      }
      if (parcel.relaisDepartId !== actingRelaisId) {
        console.error('[QR] Mismatch relais:', { 
          parcelId: parcel.id, 
          tracking,
          expectedRelaisId: parcel.relaisDepartId, 
          providedRelaisId: actingRelaisId,
          parcelRelaisDepart: parcel.relaisDepart?.commerceName,
        });
        return NextResponse.json({ 
          error: `Ce relais n'est pas le relais de départ. Attendu: ${parcel.relaisDepart?.commerceName || parcel.relaisDepartId}` 
        }, { status: 403 });
      }
      newStatus = 'PAID_RELAY';
      notes = `Paiement cash de ${parcel.prixClient} DA validé au relais de départ`;

      // Track cash collection
      await db.relaisCash.create({
        data: {
          relaisId: actingRelaisId,
          colisId: parcel.id,
          amount: parcel.prixClient,
          type: 'COLLECTED',
          notes: `Cash encaissé pour colis ${tracking}`,
        },
      });
      await db.relais.update({
        where: { id: actingRelaisId },
        data: { cashCollected: { increment: parcel.prixClient } },
      });
    }

    // ── deposit ─────────────────────────────────────────────────────────────────
    else if (action === 'deposit') {
      if (parcel.status !== 'PAID_RELAY') {
        return NextResponse.json({ error: `Le paiement doit être validé d'abord (statut: ${parcel.status})` }, { status: 400 });
      }
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (userId/relaisId manquant)' }, { status: 400 });
      }
      if (parcel.relaisDepartId !== actingRelaisId) {
        console.error('[QR] Mismatch relais on deposit:', { 
          parcelId: parcel.id, 
          tracking,
          expectedRelaisId: parcel.relaisDepartId, 
          providedRelaisId: actingRelaisId,
        });
        return NextResponse.json({ 
          error: `Ce relais n'est pas le relais de départ. Opération d'accès refusée.` 
        }, { status: 403 });
      }
      newStatus = 'DEPOSITED_RELAY';
      notes = 'Colis déposé et scanné au relais de départ — disponible pour transport';
    }

    // ── pickup (transporter) ─────────────────────────────────────────────────────
    else if (action === 'pickup') {
      if (parcel.status !== 'DEPOSITED_RELAY') {
        return NextResponse.json({ error: `Le colis doit être déposé au relais d'abord (statut: ${parcel.status})` }, { status: 400 });
      }
      newStatus = 'EN_TRANSPORT';
      notes = 'Colis pris en charge par le transporteur';

      // Update active mission if exists
      if (transporteurId) {
        await db.mission.updateMany({
          where: { colisId: parcel.id, transporteurId, status: 'ASSIGNE' },
          data: { status: 'EN_COURS' },
        });
        // Update wallet: move to pending
        await db.transporterWallet.upsert({
          where: { transporteurId },
          update: { pendingEarnings: { increment: parcel.netTransporteur }, totalEarned: { increment: parcel.netTransporteur } },
          create: { transporteurId, pendingEarnings: parcel.netTransporteur, totalEarned: parcel.netTransporteur },
        });
        extraData.transporteurId = transporteurId;
      }
    }

    // ── arrive_dest (destination relay) ─────────────────────────────────────────
    else if (action === 'arrive_dest') {
      if (parcel.status !== 'EN_TRANSPORT') {
        return NextResponse.json({ error: `Le colis doit être en transport (statut: ${parcel.status})` }, { status: 400 });
      }
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (userId/relaisId manquant)' }, { status: 400 });
      }
      if (parcel.relaisArriveeId !== actingRelaisId) {
        return NextResponse.json({ error: 'Ce relais n\'est pas le relais de destination' }, { status: 403 });
      }
      newStatus = 'ARRIVE_RELAIS_DESTINATION';
      notes = 'Colis arrivé au relais de destination';
    }

    // ── deliver (client picks up) ────────────────────────────────────────────────
    else if (action === 'deliver') {
      if (parcel.status !== 'ARRIVE_RELAIS_DESTINATION') {
        return NextResponse.json({ error: `Le colis n'est pas encore arrivé (statut: ${parcel.status})` }, { status: 400 });
      }
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (userId/relaisId manquant)' }, { status: 400 });
      }
      if (parcel.relaisArriveeId !== actingRelaisId) {
        return NextResponse.json({ error: 'Ce relais n\'est pas le relais de destination' }, { status: 403 });
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

      newStatus = 'LIVRE';
      notes = 'Colis remis au client après double vérification identité + code';

      // Close mission
      await db.mission.updateMany({
        where: { colisId: parcel.id, status: 'EN_COURS' },
        data: { status: 'LIVRE', completedAt: new Date() },
      });

      // Move transporter earnings from pending → available
      const mission = await db.mission.findFirst({ where: { colisId: parcel.id } });
      if (mission) {
        await db.transporterWallet.upsert({
          where: { transporteurId: mission.transporteurId },
          update: {
            pendingEarnings: { decrement: parcel.netTransporteur },
            availableEarnings: { increment: parcel.netTransporteur },
          },
          create: {
            transporteurId: mission.transporteurId,
            availableEarnings: parcel.netTransporteur,
            totalEarned: parcel.netTransporteur,
          },
        });
      }
    }

    // ── Legacy compatibility actions ───────────────────────────────────────────
    else if (action === 'receive') {
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (userId/relaisId manquant)' }, { status: 400 });
      }
      if (parcel.relaisDepartId === actingRelaisId && parcel.status === 'PAID_RELAY') {
        newStatus = 'DEPOSITED_RELAY';
        notes = 'Colis reçu au point relais de départ (compat)';
      } else if (parcel.relaisArriveeId === actingRelaisId && parcel.status === 'EN_TRANSPORT') {
        newStatus = 'ARRIVE_RELAIS_DESTINATION';
        notes = 'Colis arrivé au point relais de destination (compat)';
      } else {
        return NextResponse.json({ error: `Action 'receive' invalide pour ce statut (${parcel.status})` }, { status: 400 });
      }
    }

    else {
      return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
    }

    // ── Persist status change ────────────────────────────────────────────────────
    const updatedParcel = await db.colis.update({
      where: { trackingNumber: tracking },
      data: {
        status: newStatus,
        deliveredAt: newStatus === 'LIVRE' ? new Date() : undefined,
      },
    });

    await db.trackingHistory.create({
      data: { colisId: parcel.id, status: newStatus, notes: `[${action}] ${notes}` },
    });

    // ── Anti-fraud ActionLog ────────────────────────────────────────────────────
    await db.actionLog.create({
      data: {
        userId: userId || actingRelaisId || transporteurId || null,
        entityType: 'COLIS',
        entityId: parcel.id,
        action: `QR_SCAN:${action.toUpperCase()}`,
        details: JSON.stringify({
          tracking,
          newStatus,
          prevStatus: parcel.status,
          verificationProvided:
            action === 'deliver'
              ? Boolean(recipientFirstName && recipientLastName && recipientPhone && withdrawalCode)
              : undefined,
          ...extraData,
        }),
      },
    });

    // ── Notify client ────────────────────────────────────────────────────────────
    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Mise à jour de votre colis',
      message: `Colis ${tracking} — ${notes}`,
      type: 'IN_APP',
    });

    return NextResponse.json({ success: true, parcel: updatedParcel, message: notes });
  } catch (error) {
    console.error('Error processing QR scan:', error);
    return NextResponse.json({ error: 'Erreur lors du traitement du scan' }, { status: 500 });
  }
}

