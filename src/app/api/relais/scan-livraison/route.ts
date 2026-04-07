import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { createHash } from 'crypto';
import { createNotificationDedup } from '@/lib/notifications';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';
import {
  getRelaisCashBlockIssue,
  resolveActingRelais,
  resolveTrackingNumber,
} from '@/lib/relais-scan';

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

    const tracking = resolveTrackingNumber(trackingNumber, qrData);
    if (!tracking) {
      return NextResponse.json({ error: 'trackingNumber ou qrData requis' }, { status: 400 });
    }

    const relaisResult = await resolveActingRelais(auth.payload.id, relaisId);
    if (!relaisResult.ok) {
      return NextResponse.json({ error: relaisResult.issue.error }, { status: relaisResult.issue.status });
    }
    const relais = relaisResult.data;
    const actingRelaisId = relais.id;

    // Check if relais is operational
    if (relais.operationalStatus === 'SUSPENDU') {
      return NextResponse.json(
        { 
          error: 'Ce relais est suspendu', 
          details: relais.suspensionReason || 'Raison non spécifiée'
        },
        { status: 400 }
      );
    }

    const blockIssue = getRelaisCashBlockIssue(relais);
    if (blockIssue) {
      return NextResponse.json({ error: blockIssue.error }, { status: blockIssue.status });
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

    await db.$transaction([
      db.colis.update({
        where: { id: parcel.id },
        data: { status: newStatus, deliveredAt: new Date() },
      }),
      db.trackingHistory.create({
        data: { colisId: parcel.id, status: newStatus, notes },
      }),
    ]);

    await createNotificationDedup({
      userId: parcel.clientId,
      title: '📦 Colis livré',
      message: `${notes} — Suivi: ${tracking}`,
      type: 'IN_APP',
    });

    try {
      await evaluateImplicitProEligibility(parcel.clientId);
    } catch (eligibilityError) {
      console.error('[implicit-pro] scan-livraison evaluation failed:', eligibilityError);
    }

    return NextResponse.json({ success: true, newStatus, message: notes });
  } catch (error) {
    console.error('[scan-livraison] Error:', error);
    return NextResponse.json({ error: 'Erreur lors du scan de livraison' }, { status: 500 });
  }
}
