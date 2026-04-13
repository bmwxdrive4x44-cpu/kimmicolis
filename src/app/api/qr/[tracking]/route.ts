import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { createNotificationDedup } from '@/lib/notifications';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';
import { requireRole } from '@/lib/rbac';
import { applyTransition, canTransition } from '@/lib/parcelStateMachine';
import { matchColisToTrajets } from '@/services/matchingService';

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
        description: true,
        status: true,
        qrCodeImage: true,
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

    const amountToPayAtRelay = parcel.status === 'CREATED' ? Number(parcel.prixClient || 0) : 0;

    return NextResponse.json({
      ...parcel,
      amountToPayAtRelay,
    });
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
  const auth = await requireRole(request, ['RELAIS', 'TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { tracking } = await params;
    const body = await request.json();
    const {
      action,
      relaisId,
      transporteurId,
      eventId: bodyEventId,
      notes: extraNotes,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      withdrawalCode,
      recipientIdentityNumber,
    } = body;

    const relayActions = new Set(['validate_payment', 'deposit', 'arrive_dest', 'deliver', 'receive', 'print_label']);
    let actingRelaisId = typeof relaisId === 'string' && relaisId.trim().length > 0 ? relaisId.trim() : undefined;
    const normalizedRole = String(auth.payload.role || '').toUpperCase();
    const actingTransporterId = normalizedRole === 'TRANSPORTER' ? auth.payload.id : undefined;

    if (normalizedRole === 'RELAIS') {
      const relayFromSession = await db.relais.findUnique({
        where: { userId: auth.payload.id },
        select: { id: true, commerceName: true },
      });

      if (!relayFromSession) {
        return NextResponse.json({ error: 'Compte relais introuvable' }, { status: 403 });
      }

      if (actingRelaisId && actingRelaisId !== relayFromSession.id) {
        console.warn('[QR] Client relaisId mismatch, resolved from session user', {
          providedRelaisId: actingRelaisId,
          resolvedRelaisId: relayFromSession.id,
          relayName: relayFromSession.commerceName,
          userId: auth.payload.id,
        });
      }

      actingRelaisId = relayFromSession.id;
    }

    const parcel = await db.colis.findUnique({
      where: { trackingNumber: tracking },
      select: {
        id: true,
        status: true,
        relaisDepartId: true,
        relaisArriveeId: true,
        clientId: true,
        prixClient: true,
        villeDepart: true,
        villeArrivee: true,
        netTransporteur: true,
        recipientFirstName: true,
        recipientLastName: true,
        recipientPhone: true,
        withdrawalCodeHash: true,
        relaisDepart: { select: { id: true, commerceName: true } },
      },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Colis introuvable' }, { status: 404 });
    }

    const effectiveEventId =
      (typeof bodyEventId === 'string' && bodyEventId.trim().length > 0 ? bodyEventId.trim() : null) ||
      request.headers.get('x-event-id') ||
      `${action || 'unknown'}:${parcel.id}:${normalizedRole}`;

    const existingEvent = await db.actionLog.findFirst({
      where: {
        entityType: 'COLIS',
        entityId: parcel.id,
        action: `QR_EVENT:${effectiveEventId}`,
      },
      select: { id: true },
    });

    if (existingEvent) {
      return NextResponse.json({ success: true, idempotent: true, message: 'Événement déjà traité' });
    }

    let newStatus: string = parcel.status;
    let trackingStatus: string = parcel.status;
    let notes = '';
    let extraData: Record<string, unknown> = {};
    let responseData: Record<string, unknown> = {};
    let shouldUpdateParcelStatus = true;

    const getRelayPrinterStatus = async (id: string) => {
      const printerSetting = await db.setting.findUnique({ where: { key: `relayPrinterStatus:${id}` } });
      return String(printerSetting?.value || 'READY').toUpperCase();
    };

    // ── validate_payment ───────────────────────────────────────────────────────
    if (action === 'validate_payment') {
      if (relayActions.has(action) && !['RELAIS', 'ADMIN'].includes(normalizedRole)) {
        return NextResponse.json({ error: 'Action réservée au relais' }, { status: 403 });
      }
      if (!['CREATED', 'PAID'].includes(parcel.status)) {
        return NextResponse.json({ error: `Le colis n'est pas éligible au paiement cash (statut: ${parcel.status})` }, { status: 400 });
      }
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (userId/relaisId manquant)' }, { status: 400 });
      }
      if (parcel.relaisDepartId !== actingRelaisId) {
        return NextResponse.json({ error: 'Ce relais n\'est pas le relais de départ' }, { status: 403 });
      }

      const amount = Number(parcel.prixClient || 0);
      newStatus = 'PAID_RELAY';
      notes = `Paiement cash validé: ${amount.toFixed(0)} DA`;
      extraData.cashCollected = amount;
      responseData.amountCollected = amount;
      responseData.amountCurrency = 'DZD';

      await db.relaisCash.create({
        data: {
          relaisId: actingRelaisId,
          colisId: parcel.id,
          type: 'COLLECTED',
          amount,
          notes: `Cash encaissé pour colis ${tracking}`,
        },
      });

      await db.relais.update({
        where: { id: actingRelaisId },
        data: { cashCollected: { increment: amount } },
      });
    }

    // ── deposit ─────────────────────────────────────────────────────────────────
    else if (action === 'deposit') {
      if (relayActions.has(action) && !['RELAIS', 'ADMIN'].includes(normalizedRole)) {
        return NextResponse.json({ error: 'Action réservée au relais' }, { status: 403 });
      }
      // Accept both legacy cash-paid (PAID_RELAY) and new digital-paid (READY_FOR_DEPOSIT)
      if (!['PAID_RELAY', 'READY_FOR_DEPOSIT'].includes(parcel.status)) {
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
      if (parcel.status === 'PAID_RELAY') {
        newStatus = 'DEPOSITED_RELAY';
      } else {
        newStatus = applyTransition(parcel.status, 'DEPOSITED_RELAY');
      }
      notes = 'Colis déposé et scanné au relais de départ — disponible pour transport';
    }

    // ── pickup (transporter) ─────────────────────────────────────────────────────
    else if (action === 'pickup') {
      if (!['TRANSPORTER', 'ADMIN'].includes(normalizedRole)) {
        return NextResponse.json({ error: 'Action réservée au transporteur' }, { status: 403 });
      }
      if (!['DEPOSITED_RELAY', 'WAITING_PICKUP', 'ASSIGNED'].includes(parcel.status)) {
        return NextResponse.json({ error: `Le colis doit être déposé au relais d'abord (statut: ${parcel.status})` }, { status: 400 });
      }
      newStatus = applyTransition(parcel.status === 'WAITING_PICKUP' || parcel.status === 'ASSIGNED' ? 'DEPOSITED_RELAY' : parcel.status, 'PICKED_UP');
      notes = 'Colis pris en charge par le transporteur';

      // Update active mission if exists
      const transporterId = actingTransporterId || (typeof transporteurId === 'string' ? transporteurId : undefined);
      if (transporterId) {
        await db.mission.updateMany({
          where: { colisId: parcel.id, transporteurId: transporterId, status: 'ASSIGNE' },
          data: { status: 'PICKED_UP' },
        });
        // Update wallet: move to pending
        await db.transporterWallet.upsert({
          where: { transporteurId: transporterId },
          update: { pendingEarnings: { increment: parcel.netTransporteur }, totalEarned: { increment: parcel.netTransporteur } },
          create: { transporteurId: transporterId, pendingEarnings: parcel.netTransporteur, totalEarned: parcel.netTransporteur },
        });
        extraData.transporteurId = transporterId;
      }
    }

    // ── arrive_dest (destination relay) ─────────────────────────────────────────
    else if (action === 'arrive_dest') {
      if (relayActions.has(action) && !['RELAIS', 'ADMIN'].includes(normalizedRole)) {
        return NextResponse.json({ error: 'Action réservée au relais' }, { status: 403 });
      }
      if (!['PICKED_UP', 'IN_TRANSIT', 'EN_TRANSPORT'].includes(parcel.status)) {
        return NextResponse.json({ error: `Le colis doit être en transport (statut: ${parcel.status})` }, { status: 400 });
      }
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (session invalide)' }, { status: 400 });
      }
      if (parcel.relaisArriveeId !== actingRelaisId) {
        return NextResponse.json({ error: 'Ce relais n\'est pas le relais de destination' }, { status: 403 });
      }
      if (canTransition(parcel.status, 'ARRIVED_RELAY')) {
        newStatus = applyTransition(parcel.status, 'ARRIVED_RELAY');
      } else {
        const inTransit = applyTransition(parcel.status, 'IN_TRANSIT');
        newStatus = applyTransition(inTransit, 'ARRIVED_RELAY');
      }
      notes = 'Colis arrivé au relais de destination';
    }

    // ── deliver (client picks up) ────────────────────────────────────────────────
    else if (action === 'deliver') {
      if (relayActions.has(action) && !['RELAIS', 'ADMIN'].includes(normalizedRole)) {
        return NextResponse.json({ error: 'Action réservée au relais' }, { status: 403 });
      }
      if (!['ARRIVED_RELAY', 'ARRIVE_RELAIS_DESTINATION'].includes(parcel.status)) {
        return NextResponse.json({ error: `Le colis n'est pas encore arrivé (statut: ${parcel.status})` }, { status: 400 });
      }
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (session invalide)' }, { status: 400 });
      }
      if (parcel.relaisArriveeId !== actingRelaisId) {
        return NextResponse.json({ error: 'Ce relais n\'est pas le relais de destination' }, { status: 403 });
      }
      if (
        !recipientFirstName?.trim() ||
        !recipientLastName?.trim() ||
        !recipientPhone?.trim() ||
        !withdrawalCode?.trim() ||
        !recipientIdentityNumber?.trim()
      ) {
        return NextResponse.json(
          { error: 'Vérification incomplète: nom, prénom, téléphone, code de retrait et numéro de pièce d\'identité requis' },
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

      newStatus = applyTransition(parcel.status, 'DELIVERED');
      const sanitizedId = String(recipientIdentityNumber).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      notes = `Colis remis au destinataire après triple vérification: identité + téléphone + code de retrait. Pièce d'identité n°: ${sanitizedId}`;

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
      if (relayActions.has(action) && !['RELAIS', 'ADMIN'].includes(normalizedRole)) {
        return NextResponse.json({ error: 'Action réservée au relais' }, { status: 403 });
      }
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (userId/relaisId manquant)' }, { status: 400 });
      }
      if (parcel.relaisDepartId === actingRelaisId && parcel.status === 'PAID_RELAY') {
        newStatus = 'DEPOSITED_RELAY';
        notes = 'Colis reçu au point relais de départ (compat)';
      } else if (parcel.relaisArriveeId === actingRelaisId && ['IN_TRANSIT', 'EN_TRANSPORT'].includes(parcel.status)) {
        newStatus = applyTransition(parcel.status, 'ARRIVED_RELAY');
        notes = 'Colis arrivé au point relais de destination (compat)';
      } else {
        return NextResponse.json({ error: `Action 'receive' invalide pour ce statut (${parcel.status})` }, { status: 400 });
      }
    }

    // ── print_label (relay print authorization) ───────────────────────────────
    else if (action === 'print_label') {
      if (!actingRelaisId) {
        return NextResponse.json({ error: 'Relais non identifié (userId/relaisId manquant)' }, { status: 400 });
      }

      if (parcel.relaisDepartId !== actingRelaisId) {
        return NextResponse.json({ error: 'Impression autorisée uniquement au relais de départ' }, { status: 403 });
      }

      if (!['PAID_RELAY', 'READY_FOR_DEPOSIT', 'DEPOSITED_RELAY'].includes(parcel.status)) {
        return NextResponse.json(
          { error: 'Paiement non validé: impression interdite avant paiement' },
          { status: 400 }
        );
      }

      const printerStatus = await getRelayPrinterStatus(actingRelaisId);
      if (printerStatus !== 'READY') {
        return NextResponse.json(
          {
            error: 'Impression indisponible au relais',
            details: 'Alternative: changer de relais ou demander au client d\'imprimer',
            printerStatus,
          },
          { status: 409 }
        );
      }

      const previousPrint = await db.trackingHistory.findFirst({
        where: {
          colisId: parcel.id,
          status: 'LABEL_PRINTED',
          notes: { contains: actingRelaisId },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (previousPrint) {
        return NextResponse.json(
          { error: 'Double scan bloqué: ce QR a déjà été utilisé pour impression' },
          { status: 409 }
        );
      }

      shouldUpdateParcelStatus = false;
      trackingStatus = 'LABEL_PRINTED';
      notes = `Étiquette imprimée au relais ${actingRelaisId} après validation paiement`;
      extraData.printAuthorized = true;
      extraData.printerStatus = printerStatus;
    }

    else {
      return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
    }

    // ── Persist status change ────────────────────────────────────────────────────
    const updatedParcel = shouldUpdateParcelStatus
      ? await db.colis.update({
          where: { trackingNumber: tracking },
          data: {
            status: newStatus,
            deliveredAt: newStatus === 'LIVRE' ? new Date() : undefined,
          },
          select: { id: true, status: true, deliveredAt: true },
        })
      : parcel;

    await db.trackingHistory.create({
      data: { colisId: parcel.id, status: trackingStatus, notes: `[${action}] ${notes} :: relais=${actingRelaisId || 'n/a'}` },
    });

    // ── Anti-fraud ActionLog ────────────────────────────────────────────────────
    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'COLIS',
        entityId: parcel.id,
        action: `QR_SCAN:${action.toUpperCase()}`,
        details: JSON.stringify({
          tracking,
          newStatus: shouldUpdateParcelStatus ? newStatus : parcel.status,
          prevStatus: parcel.status,
          verificationProvided:
            action === 'deliver'
              ? Boolean(recipientFirstName && recipientLastName && recipientPhone && withdrawalCode)
              : undefined,
          ...extraData,
        }),
      },
    });

    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'COLIS',
        entityId: parcel.id,
        action: `QR_EVENT:${effectiveEventId}`,
        details: JSON.stringify({
          action,
          tracking,
          fromStatus: parcel.status,
          toStatus: shouldUpdateParcelStatus ? newStatus : parcel.status,
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

    if (action === 'deposit' && shouldUpdateParcelStatus) {
      try {
        const matchingResult = await matchColisToTrajets({
          id: parcel.id,
          villeDepart: parcel.villeDepart,
          villeArrivee: parcel.villeArrivee,
          clientId: parcel.clientId,
          status: newStatus,
        });

        responseData.matching = {
          attempted: true,
          matched: matchingResult.success,
          error: matchingResult.success ? null : matchingResult.error,
        };

        if (!matchingResult.success) {
          const admins = await db.user.findMany({
            where: { role: 'ADMIN' },
            select: { id: true },
          });

          await Promise.all(
            admins.map((admin) =>
              createNotificationDedup({
                userId: admin.id,
                title: 'Alerte matching relais',
                message: `Aucun transporteur trouvé après dépôt du colis ${tracking} (${parcel.villeDepart} → ${parcel.villeArrivee}) au relais ${parcel.relaisDepart?.commerceName || 'départ'}. Raison: ${matchingResult.error || 'inconnue'}.`,
                type: 'IN_APP',
              })
            )
          );
        }
      } catch (matchingError) {
        console.error('[qr] matching after deposit failed:', matchingError);
        responseData.matching = {
          attempted: true,
          matched: false,
          error: matchingError instanceof Error ? matchingError.message : 'Erreur de matching',
        };

        const admins = await db.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true },
        });

        await Promise.all(
          admins.map((admin) =>
            createNotificationDedup({
              userId: admin.id,
              title: 'Alerte matching relais',
              message: `Erreur de matching après dépôt du colis ${tracking} (${parcel.villeDepart} → ${parcel.villeArrivee}) au relais ${parcel.relaisDepart?.commerceName || 'départ'}.`,
              type: 'IN_APP',
            })
          )
        );
      }
    }

    if (shouldUpdateParcelStatus) {
      try {
        await evaluateImplicitProEligibility(parcel.clientId);
      } catch (eligibilityError) {
        console.error('[implicit-pro] qr status evaluation failed:', eligibilityError);
      }
    }

    return NextResponse.json({ success: true, parcel: updatedParcel, message: notes, ...responseData });
  } catch (error) {
    console.error('Error processing QR scan:', error);
    return NextResponse.json({ error: 'Erreur lors du traitement du scan' }, { status: 500 });
  }
}

