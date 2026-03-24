import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import {
  getRelaisCashBlockIssue,
  resolveActingRelais,
  resolveTrackingNumber,
} from '@/lib/relais-scan';

/**
 * POST /api/relais/scan-arrivee
 * Relais de destination scanne le QR pour confirmer la réception du colis depuis le transporteur.
 * Transition : EN_TRANSPORT | PICKED_UP → ARRIVE_RELAIS_DESTINATION
 *
 * Body : { trackingNumber?, qrData?, relaisId? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { trackingNumber, qrData, relaisId } = body;

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

    const validPriorStatuses = ['EN_TRANSPORT', 'PICKED_UP'];
    if (!validPriorStatuses.includes(parcel.status)) {
      return NextResponse.json(
        { error: `Statut invalide pour cette action: ${parcel.status}. Attendu: ${validPriorStatuses.join(' | ')}` },
        { status: 400 }
      );
    }

    const newStatus = 'ARRIVE_RELAIS_DESTINATION';
    const notes = `Colis arrivé au relais de destination ${relais.commerceName}`;

    await db.colis.update({ where: { id: parcel.id }, data: { status: newStatus } });

    await db.trackingHistory.create({
      data: { colisId: parcel.id, status: newStatus, notes },
    });

    await db.notification.create({
      data: {
        userId: parcel.clientId,
        title: 'Colis arrivé au relais',
        message: `${notes} — Suivi: ${tracking}. Vous pouvez récupérer votre colis.`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({ success: true, newStatus, message: notes });
  } catch (error) {
    console.error('[scan-arrivee] Error:', error);
    return NextResponse.json({ error: 'Erreur lors du scan d\'arrivée' }, { status: 500 });
  }
}
