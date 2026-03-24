import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
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
 * POST /api/relais/scan-livraison
 * Relais de destination remet le colis au destinataire après triple vérification :
 *   - nom destinataire
 *   - téléphone destinataire
 *   - code_retrait
 * Transition : ARRIVE_RELAIS_DESTINATION | ARRIVED_RELAY → LIVRE
 *
 * Body : {
 *   trackingNumber?, qrData?, relaisId?,
 *   recipientFirstName, recipientLastName, recipientPhone, withdrawalCode
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const {
      trackingNumber,
      qrData,
      relaisId,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      withdrawalCode,
    } = body;

    // Validate verification fields are present
    if (
      !recipientFirstName?.trim() ||
      !recipientLastName?.trim() ||
      !recipientPhone?.trim() ||
      !withdrawalCode?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            'Vérification requise: recipientFirstName, recipientLastName, recipientPhone et withdrawalCode sont obligatoires',
        },
        { status: 400 }
      );
    }

    let tracking: string | undefined = trackingNumber;
    if (!tracking && qrData) {
      try {
        const parsed = JSON.parse(qrData);
        tracking = parsed.tracking;
      } catch {
        tracking = qrData;
      }
    }
    if (!tracking) {
      return NextResponse.json({ error: 'trackingNumber ou qrData requis' }, { status: 400 });
    }

    let actingRelaisId: string | undefined =
      typeof relaisId === 'string' && relaisId.trim().length > 0 ? relaisId.trim() : undefined;

    if (!actingRelaisId) {
      const relayFromUser = await db.relais.findUnique({
        where: { userId: auth.payload.id },
        select: { id: true },
      });
      if (relayFromUser) actingRelaisId = relayFromUser.id;
    }

    if (!actingRelaisId) {
      return NextResponse.json({ error: 'Aucun point relais trouvé pour cet utilisateur' }, { status: 400 });
    }

    const relais = await db.relais.findUnique({ where: { id: actingRelaisId } });
    if (!relais) {
      return NextResponse.json({ error: 'Point relais non trouvé' }, { status: 404 });
    }

    if (relais.cashCollected - relais.cashReversed >= RELAY_BLOCK_THRESHOLD_DA) {
      return NextResponse.json(
        { error: 'Ce point relais a atteint le seuil de cash. Contactez l\'administrateur.' },
        { status: 403 }
      );
    }

    const parcel = await db.colis.findUnique({ where: { trackingNumber: tracking } });
    if (!parcel) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    if (parcel.relaisArriveeId !== actingRelaisId) {
      return NextResponse.json(
        { error: 'Ce relais n\'est pas le relais de destination de ce colis' },
        { status: 403 }
      );
    }

    const validPriorStatuses = ['ARRIVE_RELAIS_DESTINATION', 'ARRIVED_RELAY'];
    if (!validPriorStatuses.includes(parcel.status)) {
      return NextResponse.json(
        {
          error: `Statut invalide pour la livraison: ${parcel.status}. Attendu: ${validPriorStatuses.join(' | ')}`,
        },
        { status: 400 }
      );
    }

    // Safety: parcel must have recipient info and withdrawal code hash
    if (
      !parcel.recipientFirstName ||
      !parcel.recipientLastName ||
      !parcel.recipientPhone ||
      !parcel.withdrawalCodeHash
    ) {
      return NextResponse.json(
        { error: 'Ce colis ne contient pas les données de sécurité nécessaires à la livraison' },
        { status: 400 }
      );
    }

    // Triple verification
    const identityMatches =
      normalizeName(parcel.recipientFirstName) === normalizeName(recipientFirstName) &&
      normalizeName(parcel.recipientLastName) === normalizeName(recipientLastName) &&
      normalizePhone(parcel.recipientPhone) === normalizePhone(recipientPhone);

    const codeMatches =
      hashWithdrawalCode(String(withdrawalCode).trim()) === parcel.withdrawalCodeHash;

    if (!identityMatches || !codeMatches) {
      return NextResponse.json(
        { error: 'Vérification échouée: nom, téléphone ou code de retrait invalide' },
        { status: 403 }
      );
    }

    const newStatus = 'LIVRE';
    const notes = `Colis livré au destinataire par le relais ${relais.commerceName} — identité et code vérifiés`;

    await db.colis.update({
      where: { id: parcel.id },
      data: { status: newStatus, deliveredAt: new Date() },
    });

    await db.trackingHistory.create({
      data: { colisId: parcel.id, status: newStatus, notes },
    });

    await db.notification.create({
      data: {
        userId: parcel.clientId,
        title: '📦 Colis livré',
        message: `${notes} — Suivi: ${tracking}`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({ success: true, newStatus, message: notes });
  } catch (error) {
    console.error('[scan-livraison] Error:', error);
    return NextResponse.json({ error: 'Erreur lors du scan de livraison' }, { status: 500 });
  }
}
