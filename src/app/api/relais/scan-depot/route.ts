import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { RELAY_BLOCK_THRESHOLD_DA } from '@/lib/constants';
import { createNotificationDedup } from '@/lib/notifications';
import { matchColisToTrajets } from '@/services/matchingService';
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
 * POST /api/relais/scan-depot
 * Relais de départ scanne le QR pour confirmer la réception physique du colis déposé par le client.
 *
 * Si le colis est en statut CREATED (aucun paiement en ligne) :
 *   → encaissement cash au scan + transition directe vers RECU_RELAIS
 *   → crée un enregistrement RelaisCash (COLLECTED)
 *   → incrémente cashCollected du relais
 *
 * Si le colis est déjà PAID_RELAY | DEPOSITED_RELAY | PAID :
 *   → transition simple vers RECU_RELAIS (cash déjà enregistré)
 *
 * Body : { trackingNumber?, qrData?, relaisId?, cashAmount? }
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
      `QR_DEPOSIT:${parcel.id}:${actingRelaisId}`;

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

    const { cashAmount } = body;
    const validPriorStatuses = ['CREATED', 'PAID_RELAY', 'DEPOSITED_RELAY', 'PAID'];
    if (!validPriorStatuses.includes(parcel.status)) {
      return NextResponse.json(
        { error: `Statut invalide pour cette action: ${parcel.status}. Attendu: ${validPriorStatuses.join(' | ')}` },
        { status: 400 }
      );
    }

    const newStatus = 'RECU_RELAIS';
    let notes = `Colis réceptionné au relais de départ ${relais.commerceName}`;

    // Logique cash : si le colis n'est pas encore payé (CREATED), encaisser au scan
    if (parcel.status === 'CREATED') {
      const amount = Number(cashAmount) || parcel.prixClient;
      notes = `Paiement cash encaissé (${amount} DA) et colis réceptionné au relais ${relais.commerceName}`;

      const newTotal = relais.cashCollected + amount;
      const newUnreversed = newTotal - relais.cashReversed;

      await db.$transaction([
        db.relaisCash.create({
          data: {
            relaisId: actingRelaisId,
            colisId: parcel.id,
            type: 'COLLECTED',
            amount,
            notes: `Cash encaissé au dépôt pour colis ${tracking}`,
          },
        }),
        db.relais.update({
          where: { id: actingRelaisId },
          data: { cashCollected: newTotal },
        }),
      ]);

      try {
        await db.colis.update({
          where: { id: parcel.id },
          data: { status: newStatus, custody: 'RELAIS_DEPART' },
          select: { id: true, status: true },
        });
      } catch (custodyErr) {
        if (isPrismaSchemaError(custodyErr)) {
          await db.$executeRaw`UPDATE "Colis" SET status = ${newStatus}, "updatedAt" = NOW() WHERE id = ${parcel.id}`;
        } else throw custodyErr;
      }

      // Alerter les admins si seuil atteint
      if (newUnreversed >= RELAY_BLOCK_THRESHOLD_DA) {
        const admins = await db.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await db.notification.create({
            data: {
              userId: admin.id,
              title: '⚠️ Seuil cash relais atteint',
              message: `Le relais "${relais.commerceName}" a dépassé ${RELAY_BLOCK_THRESHOLD_DA} DA non reversés (${newUnreversed.toFixed(0)} DA).`,
              type: 'IN_APP',
            },
          });
        }
      }
    } else {
      // Cash déjà enregistré lors d'une étape précédente
      try {
        await db.colis.update({
          where: { id: parcel.id },
          data: { status: newStatus, custody: 'RELAIS_DEPART' },
          select: { id: true, status: true },
        });
      } catch (custodyErr) {
        if (isPrismaSchemaError(custodyErr)) {
          await db.$executeRaw`UPDATE "Colis" SET status = ${newStatus}, "updatedAt" = NOW() WHERE id = ${parcel.id}`;
        } else throw custodyErr;
      }
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
        action: 'QR_SCAN_DEPOT',
      },
    });

    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Colis reçu au relais',
      message: `${notes} — Suivi: ${tracking}`,
      type: 'IN_APP',
    });

    let matching: { attempted: boolean; matched: boolean; error: string | null } = {
      attempted: true,
      matched: false,
      error: null,
    };

    try {
      const matchingResult = await matchColisToTrajets({
        id: parcel.id,
        lineId: parcel.lineId,
        villeDepart: parcel.villeDepart,
        villeArrivee: parcel.villeArrivee,
        clientId: parcel.clientId,
        status: newStatus,
      });
      matching = {
        attempted: true,
        matched: matchingResult.success,
        error: matchingResult.success ? null : matchingResult.error ?? null,
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
              message: `Aucun transporteur trouvé après dépôt du colis ${tracking} (${parcel.villeDepart} → ${parcel.villeArrivee}) au relais ${relais.commerceName}. Raison: ${matchingResult.error || 'inconnue'}.`,
              type: 'IN_APP',
            })
          )
        );
      }
    } catch (matchingError) {
      console.error('[scan-depot] matching after deposit failed:', matchingError);
      matching = {
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
            message: `Erreur de matching après dépôt du colis ${tracking} (${parcel.villeDepart} → ${parcel.villeArrivee}) au relais ${relais.commerceName}.`,
            type: 'IN_APP',
          })
        )
      );
    }

    return NextResponse.json({ success: true, newStatus, message: notes, matching });
  } catch (error) {
    console.error('[scan-depot] Error:', error);
    return NextResponse.json({ error: 'Erreur lors du scan de dépôt' }, { status: 500 });
  }
}
