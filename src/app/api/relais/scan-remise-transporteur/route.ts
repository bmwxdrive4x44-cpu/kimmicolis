import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { RELAY_BLOCK_THRESHOLD_DA } from '@/lib/constants';

/**
 * POST /api/relais/scan-remise-transporteur
 * Relais de départ scanne le QR pour confirmer la remise du colis au transporteur.
 * Transition : RECU_RELAIS | DEPOSITED_RELAY → EN_TRANSPORT
 *
 * Body : { trackingNumber?, qrData?, relaisId? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { trackingNumber, qrData, relaisId } = body;

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

    if (parcel.relaisDepartId !== actingRelaisId) {
      return NextResponse.json(
        { error: 'Ce relais n\'est pas le relais de départ de ce colis' },
        { status: 403 }
      );
    }

    const validPriorStatuses = ['RECU_RELAIS', 'DEPOSITED_RELAY'];
    if (!validPriorStatuses.includes(parcel.status)) {
      return NextResponse.json(
        { error: `Statut invalide pour cette action: ${parcel.status}. Attendu: ${validPriorStatuses.join(' | ')}` },
        { status: 400 }
      );
    }

    const newStatus = 'EN_TRANSPORT';
    const notes = `Colis remis au transporteur par le relais ${relais.commerceName}`;

    await db.colis.update({ where: { id: parcel.id }, data: { status: newStatus } });

    await db.trackingHistory.create({
      data: { colisId: parcel.id, status: newStatus, notes },
    });

    await db.notification.create({
      data: {
        userId: parcel.clientId,
        title: 'Colis en transport',
        message: `${notes} — Suivi: ${tracking}`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({ success: true, newStatus, message: notes });
  } catch (error) {
    console.error('[scan-remise-transporteur] Error:', error);
    return NextResponse.json({ error: 'Erreur lors du scan de remise transporteur' }, { status: 500 });
  }
}
