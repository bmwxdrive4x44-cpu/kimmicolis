import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { createNotificationDedup } from '@/lib/notifications';
import { resolveQrSecurityPayload } from '@/lib/relais-scan';
import { 
  validateQRAgainstParcel,
  createQRScanLogEntry 
} from '@/lib/qr-security';

/**
 * POST /api/missions/{id}/accept-from-relay
 * STEP 2 of double validation: Transporter confirms receipt from relay
 * 
 * Only called after relais has scanned QR (relaisConfirmed=true)
 * Marks transporteurConfirmed=true and logs audit trail
 *
 * Body: { qrData?, withdrawalPin?, location? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { id: missionId } = await params;

  try {
    const body = await request.json();
    const { qrData, withdrawalPin, location } = body;
    const qrSecurity = resolveQrSecurityPayload(qrData);

    // Get mission
    const mission = await (db as any).mission.findUnique({
      where: { id: missionId },
      include: { colis: true, transporteur: true },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Verify ownership
    if (mission.transporteurId !== auth.payload.id && auth.payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized to accept this mission' }, { status: 403 });
    }

    const parcel = mission.colis;

    // Verify relais already confirmed handoff
    if (!mission.relaisConfirmed) {
      return NextResponse.json(
        { error: 'Relais must confirm handoff first before transporteur can accept' },
        { status: 400 }
      );
    }

    // Verify mission status is EN_COURS (relais scan already transitioned to EN_TRANSPORT)
    if (!['EN_TRANSPORT', 'ASSIGNE', 'EN_COURS'].includes(parcel.status)) {
      return NextResponse.json(
        { error: `Invalid parcel status for acceptance: ${parcel.status}` },
        { status: 400 }
      );
    }

    // 🔒 QR security validation
    const qrValidation = await validateQRAgainstParcel(parcel, qrSecurity, {
      checkExpiration: true,
      checkPin: !!parcel.withdrawalPin,
      pinAttempt: withdrawalPin,
    });

    if (!qrValidation.valid) {
      if (qrValidation.fraudFlag) {
        await (db as any).qrSecurityLog.create({
          data: createQRScanLogEntry({
            colisId: parcel.id,
            qrToken: qrSecurity.token || qrSecurity.parcelId || 'UNKNOWN',
            scanLocation: location || 'UNKNOWN',
            scannerRole: 'TRANSPORTER',
            fraudFlag: true,
            fraudReason: qrValidation.error,
          }),
        });
        console.error(`[FRAUD] Transporteur QR fraud: ${qrValidation.error}`, { missionId });
      }
      return NextResponse.json({ error: qrValidation.error }, { status: 403 });
    }

    // Idempotence check
    const eventId = `MISSION_ACCEPT:${missionId}:${auth.payload.id}`;
    const existingEvent = await (db as any).actionLog.findFirst({
      where: { eventId, scope: 'MISSION_ACCEPT', entityId: missionId },
      select: { id: true },
    });
    if (existingEvent) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Receipt already confirmed',
      });
    }

    // 🔄 Mark transporteur confirmation and update mission status
    const updatedMission = await (db as any).mission.update({
      where: { id: missionId },
      data: {
        transporteurConfirmed: true,
        status: 'EN_COURS', // Ensure status is EN_COURS
      },
    });

    // Log confirmation
    await (db as any).qrSecurityLog.create({
      data: createQRScanLogEntry({
        colisId: parcel.id,
        qrToken: qrSecurity.token || qrSecurity.parcelId || 'UNKNOWN',
        scanLocation: location || 'ACCEPTED_FROM_RELAY',
        scannerRole: 'TRANSPORTER',
        pinVerified: !!withdrawalPin,
      }),
    });

    // Log action
    await (db as any).actionLog.create({
      data: {
        eventId,
        scope: 'MISSION_ACCEPT',
        userId: auth.payload.id,
        entityType: 'MISSION',
        entityId: missionId,
        action: 'TRANSPORTEUR_CONFIRMED_RECEIPT',
        details: JSON.stringify({
          missionId,
          colisId: parcel.id,
          transporteurConfirmed: true,
          location,
        }),
      },
    });

    // Create tracking history entry
    await db.trackingHistory.create({
      data: {
        colisId: parcel.id,
        status: 'EN_COURS',
        notes: `Transporteur a confirmé la réception du colis au relais de départ (double validation complétée)`,
        userId: auth.payload.id,
      },
    });

    // Notify relay that transporteur confirmed
    const relaisDepart = await db.relais.findUnique({
      where: { id: parcel.relaisDepartId },
      include: { user: true },
    });

    if (relaisDepart?.user) {
      await createNotificationDedup({
        userId: relaisDepart.user.id,
        title: 'Colis confirmé en possession du transporteur',
        message: `Le transporteur a confirmé la réception du colis #${parcel.trackingNumber}. Transport en cours.`,
        type: 'IN_APP',
      });
    }

    // Notify client
    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Colis confirmé en transit',
      message: `Double validation complétée: le transporteur a pris possession du colis. Suivi: ${parcel.trackingNumber}`,
      type: 'IN_APP',
    });

    return NextResponse.json({
      success: true,
      message: 'Colis confirmé en possession du transporteur (remise relais validée)',
      mission: updatedMission,
    });
  } catch (error) {
    console.error('[accept-from-relay] Error:', error);
    return NextResponse.json({ error: 'Failed to confirm receipt' }, { status: 500 });
  }
}
