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

function isPrismaSchemaError(err: unknown): boolean {
  const code = String((err as { code?: string }).code ?? '');
  return code === 'P2022' || code === 'P2010';
}

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
      `QR_ARRIVEE_RELAIS_DEST:${parcel.id}:${actingRelaisId}`;

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

    try {
      await db.colis.update({
        where: { id: parcel.id },
        data: { status: newStatus, custody: 'RELAIS_DEST' },
        select: { id: true, status: true },
      });
    } catch (custodyErr) {
      if (isPrismaSchemaError(custodyErr)) {
        await db.$executeRaw`UPDATE "Colis" SET status = ${newStatus}, "updatedAt" = NOW() WHERE id = ${parcel.id}`;
      } else throw custodyErr;
    }

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
        action: 'QR_SCAN_ARRIVEE_RELAIS_DEST',
      },
    });

    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Colis arrivé au relais',
      message: `${notes} — Suivi: ${tracking}. Vous pouvez récupérer votre colis.`,
      type: 'IN_APP',
    });

    return NextResponse.json({ success: true, newStatus, message: notes });
  } catch (error) {
    console.error('[scan-arrivee] Error:', error);
    return NextResponse.json({ error: 'Erreur lors du scan d\'arrivée' }, { status: 500 });
  }
}
