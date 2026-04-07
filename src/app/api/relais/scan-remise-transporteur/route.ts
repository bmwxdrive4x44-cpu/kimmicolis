import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { createNotificationDedup } from '@/lib/notifications';
import {
  getRelaisCashBlockIssue,
  resolveActingRelais,
  resolveQrSecurityPayload,
  resolveTrackingNumber,
} from '@/lib/relais-scan';

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
    const qrSecurity = resolveQrSecurityPayload(qrData);

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

    const parcel = qrSecurity.parcelId
      ? await db.colis.findUnique({ where: { id: qrSecurity.parcelId } })
      : await db.colis.findUnique({ where: { trackingNumber: tracking } });
    if (!parcel) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    if (qrSecurity.token && parcel.qrToken && qrSecurity.token !== parcel.qrToken) {
      return NextResponse.json({ error: 'QR invalide (token mismatch)' }, { status: 403 });
    }

    const eventId =
      (typeof body.eventId === 'string' && body.eventId.trim().length > 0 ? body.eventId.trim() : null) ||
      request.headers.get('x-event-id') ||
      `QR_REMISE_TRANSPORTEUR:${parcel.id}:${actingRelaisId}`;

    const actionLogDb = db as typeof db & {
      actionLog: {
        findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>;
        create(args: Record<string, unknown>): Promise<unknown>;
      };
    };

    const existingEvent = await actionLogDb.actionLog.findFirst({
      where: { eventId, scope: 'QR', entityId: parcel.id },
      select: { id: true },
    });
    if (existingEvent) {
      return NextResponse.json({ success: true, idempotent: true, eventId, newStatus: parcel.status });
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

    await db.colis.update({ where: { id: parcel.id }, data: { status: newStatus, custody: 'TRANSPORTEUR' } });

    await db.trackingHistory.create({
      data: { colisId: parcel.id, status: newStatus, notes, userId: auth.payload.id, relaisId: actingRelaisId },
    });

    await actionLogDb.actionLog.create({
      data: {
        eventId,
        scope: 'QR',
        userId: auth.payload.id,
        entityType: 'COLIS',
        entityId: parcel.id,
        action: 'QR_SCAN_REMISE_TRANSPORTEUR',
      },
    });

    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Colis en transport',
      message: `${notes} — Suivi: ${tracking}`,
      type: 'IN_APP',
    });

    return NextResponse.json({ success: true, newStatus, message: notes });
  } catch (error) {
    console.error('[scan-remise-transporteur] Error:', error);
    return NextResponse.json({ error: 'Erreur lors du scan de remise transporteur' }, { status: 500 });
  }
}
