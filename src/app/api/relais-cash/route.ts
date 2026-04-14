import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

const COMMISSION_EARNED_STATUSES = [
  'PAID_RELAY',
  'DEPOSITED_RELAY',
  'RECU_RELAIS',
  'WAITING_PICKUP',
  'ASSIGNED',
  'PICKED_UP',
  'EN_TRANSPORT',
  'IN_TRANSIT',
  'ARRIVED_RELAY',
  'ARRIVE_RELAIS_DESTINATION',
  'LIVRE',
];

const RELAY_SCAN_STATUSES = ['PAID_RELAY', 'DEPOSITED_RELAY', 'RECU_RELAIS'];

/**
 * GET /api/relais-cash?relaisId=...
 * Returns cash ledger for a relay point.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    let relaisId = searchParams.get('relaisId');

    if (!relaisId && auth.payload.role === 'RELAIS') {
      const relais = await db.relais.findUnique({ where: { userId: auth.payload.id }, select: { id: true } });
      if (!relais) {
        return NextResponse.json({ error: 'Relais introuvable pour cet utilisateur' }, { status: 404 });
      }
      relaisId = relais.id;
    }

    if (!relaisId) {
      return NextResponse.json({ error: 'relaisId requis' }, { status: 400 });
    }

    if (auth.payload.role === 'RELAIS') {
      const ownedRelais = await db.relais.findFirst({ where: { id: relaisId, userId: auth.payload.id }, select: { id: true } });
      if (!ownedRelais) {
        return NextResponse.json({ error: 'Accès interdit à ce relais' }, { status: 403 });
      }
    }

    const [relais, transactions, commissionParcels] = await Promise.all([
      db.relais.findUnique({
        where: { id: relaisId },
        select: { cashCollected: true, cashReversed: true, commissionPetit: true, commissionMoyen: true, commissionGros: true },
      }),
      db.relaisCash.findMany({
        where: { relaisId },
        include: { colis: { select: { id: true, trackingNumber: true, weight: true, prixClient: true, commissionRelais: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.colis.findMany({
        where: {
          relaisDepartId: relaisId,
          status: { in: COMMISSION_EARNED_STATUSES },
        },
        select: {
          id: true,
          trackingNumber: true,
          prixClient: true,
          commissionRelais: true,
          villeDepart: true,
          villeArrivee: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    if (!relais) {
      return NextResponse.json({ error: 'Relais introuvable' }, { status: 404 });
    }

    const parcelIds = commissionParcels.map((p) => p.id);
    const parcelById = new Map(commissionParcels.map((p) => [p.id, p]));

    const [scanHistoryRaw, validatePaymentLogs] = await Promise.all([
      parcelIds.length > 0
        ? db.trackingHistory.findMany({
            where: {
              status: { in: RELAY_SCAN_STATUSES },
              colisId: { in: parcelIds },
            },
            select: {
              id: true,
              status: true,
              createdAt: true,
              notes: true,
              colisId: true,
              colis: {
                select: {
                  id: true,
                  trackingNumber: true,
                  prixClient: true,
                  commissionRelais: true,
                  villeDepart: true,
                  villeArrivee: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 300,
          })
        : Promise.resolve([]),
      parcelIds.length > 0
        ? db.actionLog.findMany({
            where: {
              entityType: 'COLIS',
              action: 'QR_SCAN:VALIDATE_PAYMENT',
              entityId: { in: parcelIds },
            },
            select: {
              id: true,
              entityId: true,
              details: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 300,
          })
        : Promise.resolve([]),
    ]);

    const paidRelayHistoryColisIds = new Set(
      scanHistoryRaw.filter((h) => h.status === 'PAID_RELAY').map((h) => h.colisId)
    );

    const scanHistoryFromLogs = validatePaymentLogs
      .filter((log) => !paidRelayHistoryColisIds.has(log.entityId))
      .map((log) => {
        const parcel = parcelById.get(log.entityId);
        let amountFromLog = Number(parcel?.prixClient || 0);
        let notes = 'Paiement cash validé (action log)';

        if (log.details) {
          try {
            const parsed = JSON.parse(log.details) as { cashCollected?: number; tracking?: string };
            if (typeof parsed.cashCollected === 'number') {
              amountFromLog = parsed.cashCollected;
            }
            if (typeof parsed.tracking === 'string') {
              notes = `Paiement cash validé pour ${parsed.tracking}`;
            }
          } catch {
            // ignore malformed details
          }
        }

        return {
          id: `log-${log.id}`,
          status: 'PAID_RELAY',
          createdAt: log.createdAt,
          notes,
          colisId: log.entityId,
          colis: {
            id: log.entityId,
            trackingNumber: parcel?.trackingNumber || 'UNKNOWN',
            prixClient: amountFromLog,
            commissionRelais: Number(parcel?.commissionRelais || 0),
            villeDepart: parcel?.villeDepart || '',
            villeArrivee: parcel?.villeArrivee || '',
          },
        };
      });

    const scanHistory = [...scanHistoryRaw, ...scanHistoryFromLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Compute from ledger transactions, with fallback from PAID_RELAY history when
    // COLLECTED rows are missing for legacy/partial flows.
    const collectedTransactions = transactions.filter(t => t.type === 'COLLECTED');
    const collectedColisIds = new Set(
      collectedTransactions
        .map((t) => t.colis?.id)
        .filter((id): id is string => Boolean(id))
    );

    const inferredCollectedFromHistory = scanHistory
      .filter((h) => h.status === 'PAID_RELAY' && !collectedColisIds.has(h.colis.id))
      .reduce((sum, h) => sum + Number(h.colis.prixClient || 0), 0);

    const cashCollected = collectedTransactions
      .reduce((sum, t) => sum + t.amount, 0) + inferredCollectedFromHistory;

    const cashReversed = transactions
      .filter(t => t.type === 'REVERSED')
      .reduce((sum, t) => sum + t.amount, 0);
    const balance = cashCollected - cashReversed;

    // Relay commission is earned on eligible parcels handled by the departure relay,
    // including online-paid parcels that do not create a cash collection transaction.
    const totalCommissions = commissionParcels
      .reduce((sum, parcel) => sum + Number(parcel.commissionRelais || 0), 0);

    // Sync denormalized fields if out of date
    if (relais.cashCollected !== cashCollected || relais.cashReversed !== cashReversed) {
      await db.relais.update({
        where: { id: relaisId as string },
        data: { cashCollected, cashReversed },
      });
    }

    return NextResponse.json({
      cashCollected,
      cashReversed,
      balance,
      totalCommissions,
      transactions,
      scanHistory,
    });
  } catch (error) {
    console.error('Error fetching relais cash:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/relais-cash/reverse
 * Record a cash reversal from relay to platform.
 * Body: { relaisId, amount, notes }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { relaisId, amount, notes, colisId } = body;

    if (!relaisId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'relaisId et amount requis' }, { status: 400 });
    }

    if (auth.payload.role === 'RELAIS') {
      const ownedRelais = await db.relais.findFirst({ where: { id: relaisId, userId: auth.payload.id }, select: { id: true } });
      if (!ownedRelais) {
        return NextResponse.json({ error: 'Accès interdit à ce relais' }, { status: 403 });
      }
    }

    const actorUserId = auth.payload.id;

    const relais = await db.relais.findUnique({ where: { id: relaisId } });
    if (!relais) {
      return NextResponse.json({ error: 'Relais introuvable' }, { status: 404 });
    }

    const balance = relais.cashCollected - relais.cashReversed;
    if (amount > balance) {
      return NextResponse.json({ error: `Impossible de reverser ${amount} DA — solde: ${balance} DA` }, { status: 400 });
    }

    // For a reversal, a colisId is optional (bulk reversal possible)
    const dummyColisId = colisId || await getFirstUnreversedColis(relaisId);

    if (!dummyColisId) {
      return NextResponse.json({ error: 'Aucun colis à reverser' }, { status: 400 });
    }

    const [tx] = await Promise.all([
      db.relaisCash.create({
        data: { relaisId, colisId: dummyColisId, amount, type: 'REVERSED', notes },
      }),
      db.relais.update({
        where: { id: relaisId },
        data: { cashReversed: { increment: amount } },
      }),
      db.actionLog.create({
        data: {
          userId: actorUserId,
          entityType: 'RELAIS',
          entityId: relaisId,
          action: 'CASH_REVERSED',
          details: JSON.stringify({ amount, notes }),
        },
      }),
    ]);

    return NextResponse.json({ success: true, transaction: tx });
  } catch (error) {
    console.error('Error recording cash reversal:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

async function getFirstUnreversedColis(relaisId: string): Promise<string | null> {
  const tx = await db.relaisCash.findFirst({
    where: { relaisId, type: 'COLLECTED' },
    select: { colisId: true },
  });
  return tx?.colisId || null;
}
