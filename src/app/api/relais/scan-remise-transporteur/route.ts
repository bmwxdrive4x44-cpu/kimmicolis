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
import { 
  validateQRAgainstParcel, 
  isQRExpired,
  createQRScanLogEntry 
} from '@/lib/qr-security';

function isPrismaSchemaError(err: unknown): boolean {
  const code = String((err as { code?: string }).code ?? '');
  return code === 'P2022' || code === 'P2010';
}

/**
 * POST /api/relais/scan-remise-transporteur
 * Relais de départ scanne le QR pour confirmer la remise du colis au transporteur.
 * STEP 1 of double validation: Relay confirms handoff
 * Body must include: PIN (if set on parcel)
 *
 * Next step: Transporteur must POST /api/missions/{missionId}/accept-from-relay to confirm receipt
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { trackingNumber, qrData, relaisId, withdrawalPin } = body;
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

    // 🔒 NEW: QR security validation (token + expiration)
    const qrValidation = await validateQRAgainstParcel(parcel, qrSecurity, {
      checkExpiration: true,
      checkPin: !!parcel.withdrawalPin, // Check PIN if set
      pinAttempt: withdrawalPin,
    });

    if (!qrValidation.valid) {
      // 🚨 Log fraud attempt if flagged
      if (qrValidation.fraudFlag) {
        await (db as any).qrSecurityLog.create({
          data: createQRScanLogEntry({
            colisId: parcel.id,
            qrToken: qrSecurity.token || qrSecurity.parcelId || 'UNKNOWN',
            scanLocation: 'RELAIS_DEPART_FRAUD',
            scannerRole: 'RELAIS',
            fraudFlag: true,
            fraudReason: qrValidation.error,
          }),
        });
        // Notify admin asynchronously
        console.error(`[FRAUD] QR fraud detected: ${qrValidation.error}`, { colisId: parcel.id });
      }
      return NextResponse.json({ error: qrValidation.error }, { status: 403 });
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
        findUnique(args: Record<string, unknown>): Promise<{ id: string } | null>;
        create(args: Record<string, unknown>): Promise<unknown>;
      };
      qrSecurityLog: {
        create(args: Record<string, unknown>): Promise<unknown>;
      };
      mission: {
        findFirst(args: Record<string, unknown>): Promise<any | null>;
        updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
      };
    };

    const existingEvent = await actionLogDb.actionLog.findUnique({
      where: { eventId },
      select: { id: true },
    });
    if (existingEvent) {
      return NextResponse.json({ 
        success: true, 
        idempotent: true, 
        eventId, 
        message: 'Remise déjà confirmée par le relais. En attente de confirmation du transporteur.' 
      });
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

    // 🔄 NEW: Mark relais confirmation on missions instead of changing status immediately
    // This allows transporteur to confirm receipt separately

    // 🔄 NEW: Mark relais confirmation on missions instead of changing status immediately
    // This allows transporteur to confirm receipt separately
    const missions = await actionLogDb.mission.findFirst({
      where: { colisId: parcel.id, status: { in: ['ASSIGNE', 'EN_COURS'] } },
    });

    // Log QR scan for security audit
    await actionLogDb.qrSecurityLog.create({
      data: createQRScanLogEntry({
        colisId: parcel.id,
        qrToken: qrSecurity.token || qrSecurity.parcelId || 'UNKNOWN',
        scanLocation: 'RELAIS_DEPART',
        scannerRole: 'RELAIS',
        pinVerified: !!withdrawalPin,
      }),
    });

    if (missions) {
      // Mark that relais has confirmed handoff
      await actionLogDb.mission.updateMany({
        where: { id: missions.id, relaisConfirmed: false },
        data: { relaisConfirmed: true },
      });
    }

    // Status still transitions to EN_TRANSPORT for UI consistency
    const newStatus = 'EN_TRANSPORT';
    const notes = `Colis remis au transporteur par le relais ${relais.commerceName} (confirmation relais enregistrée)`;

    try {
      await db.colis.update({
        where: { id: parcel.id },
        data: { status: newStatus, custody: 'TRANSPORTEUR' },
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
        action: 'QR_SCAN_REMISE_TRANSPORTEUR',
        details: JSON.stringify({ relaisConfirmed: true, pinVerified: !!withdrawalPin }),
      },
    });

    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Colis en transport',
      message: `${notes} — Suivi: ${tracking}`,
      type: 'IN_APP',
    });

    return NextResponse.json({ 
      success: true, 
      newStatus, 
      message: notes,
      nextStep: 'Transporteur doit confirmer réception du colis',
    });
  } catch (error) {
    console.error('[scan-remise-transporteur] Error:', error);
    return NextResponse.json({ error: 'Erreur lors du scan de remise transporteur' }, { status: 500 });
  }
}
