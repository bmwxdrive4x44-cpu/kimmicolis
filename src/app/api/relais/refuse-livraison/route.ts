import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { createNotificationDedup } from '@/lib/notifications';
import {
  resolveActingRelais,
  resolveTrackingNumber,
} from '@/lib/relais-scan';

/**
 * POST /api/relais/refuse-livraison
 * Le destinataire refuse de récupérer le colis au relais de destination.
 * Transition: ARRIVE_RELAIS_DESTINATION → RETOUR
 *
 * Body: { trackingNumber?, qrData?, relaisId?, reason? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { trackingNumber, qrData, relaisId, reason } = body;

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

    const parcel = await db.colis.findUnique({ where: { trackingNumber: tracking } });
    if (!parcel) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    // This relais must be the destination relay
    if (parcel.relaisArriveeId !== actingRelaisId) {
      return NextResponse.json(
        { error: "Ce relais n'est pas le relais de destination de ce colis" },
        { status: 403 }
      );
    }

    const validStatuses = ['ARRIVE_RELAIS_DESTINATION', 'ARRIVED_RELAY'];
    if (!validStatuses.includes(parcel.status)) {
      return NextResponse.json(
        { error: `Statut invalide pour refus: ${parcel.status}. Attendu: ${validStatuses.join(' | ')}` },
        { status: 400 }
      );
    }

    const refusedReason = reason?.trim() || 'Refus du destinataire';

    await db.colis.update({
      where: { id: parcel.id },
      data: { status: 'RETOUR', updatedAt: new Date() },
    });

    await Promise.all([
      db.trackingHistory.create({
        data: {
          colisId: parcel.id,
          status: 'RETOUR',
          location: relais.commerceName,
          notes: `Refusé au relais ${relais.commerceName}. Raison: ${refusedReason}`,
        },
      }),
      createNotificationDedup({
        userId: parcel.clientId,
        title: 'Colis refusé — retour en cours',
        message: `Votre colis ${parcel.trackingNumber} a été refusé par le destinataire au relais ${relais.commerceName}. Il sera retourné au point de départ. Raison: ${refusedReason}`,
        type: 'IN_APP',
      }),
      db.actionLog.create({
        data: {
          userId: auth.payload.id,
          entityType: 'COLIS',
          entityId: parcel.id,
          action: 'REFUSE_LIVRAISON',
          details: JSON.stringify({ relaisId: actingRelaisId, reason: refusedReason }),
          ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      trackingNumber: parcel.trackingNumber,
      status: 'RETOUR',
      message: `Colis ${parcel.trackingNumber} marqué en retour. Le client a été notifié.`,
    });
  } catch (error) {
    console.error('Error in refuse-livraison:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
