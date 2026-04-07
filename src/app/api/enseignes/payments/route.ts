import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

const ALLOWED_METHODS = ['CIB', 'EDAHABIA', 'BARIDI_MOB', 'STRIPE_TEST', 'BANK_TRANSFER'] as const;

function generateBatchReference(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `AUTO-${y}${m}${d}-${hh}${mm}${ss}`;
}

// GET: Récupérer les colis en attente de paiement
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ENSEIGNE', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status') || 'CREATED';

    const userId = auth.payload.role === 'ADMIN' && clientId ? clientId : auth.payload.id;

    const unpaidParcels = await db.colis.findMany({
      where: {
        clientId: userId,
        status: status === 'all'
          ? { in: ['CREATED', 'PENDING_PAYMENT', 'PAID'] }
          : (status === 'CREATED' ? { in: ['CREATED', 'PENDING_PAYMENT'] } : status),
      },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        prixClient: true,
        villeDepart: true,
        villeArrivee: true,
        recipientFirstName: true,
        recipientLastName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const stats = await db.colis.aggregate({
      where: { clientId: userId, status: { in: ['CREATED', 'PENDING_PAYMENT'] } },
      _count: { id: true },
      _sum: { prixClient: true },
    });

    return NextResponse.json({
      parcels: unpaidParcels,
      stats: {
        unpaidCount: stats._count.id,
        unpaidTotal: stats._sum.prixClient ?? 0,
      },
    });
  } catch (error) {
    console.error('Error fetching unpaid parcels:', error);
    return NextResponse.json({ error: 'Failed to fetch parcels' }, { status: 500 });
  }
}

// PUT: Creer des intentions de paiement (PENDING) en lot.
// La confirmation reelle doit venir du webhook PSP signe.
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['ENSEIGNE', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisIds, paymentMethod, batchReference } = body;

    if (!Array.isArray(colisIds) || colisIds.length === 0) {
      return NextResponse.json({ error: 'colisIds manquant ou vide' }, { status: 400 });
    }

    if (paymentMethod === 'CASH_RELAY') {
      return NextResponse.json(
        { error: 'Le paiement au relais est indisponible pour le flux enseigne (paiement en ligne uniquement).' },
        { status: 400 }
      );
    }

    if (!paymentMethod || !ALLOWED_METHODS.includes(paymentMethod)) {
      return NextResponse.json({ error: 'paymentMethod invalide' }, { status: 400 });
    }

    if (batchReference && (typeof batchReference !== 'string' || batchReference.trim().length < 6)) {
      return NextResponse.json({ error: 'batchReference requis (min 6 caracteres)' }, { status: 400 });
    }

    // Vérifier que tous les colis appartiennent à l'utilisateur
    const parcels = await db.colis.findMany({
      where: { id: { in: colisIds } },
      select: { id: true, clientId: true, status: true, prixClient: true, trackingNumber: true },
    });

    if (parcels.length !== colisIds.length) {
      return NextResponse.json({ error: 'Un ou plusieurs colis sont introuvables' }, { status: 404 });
    }

    const userId = auth.payload.role === 'ADMIN' ? parcels[0]?.clientId : auth.payload.id;
    const unauthorized = parcels.some((p) => p.clientId !== userId);
    if (unauthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const owner = await db.user.findUnique({
      where: { id: userId },
      select: { clientType: true },
    });

    if (owner?.clientType === 'PRO' && paymentMethod !== 'STRIPE_TEST') {
      return NextResponse.json(
        { error: 'Compte PRO: la methode autorisee est STRIPE_TEST uniquement.' },
        { status: 400 }
      );
    }

    const nonPayable = parcels.filter((p) => p.status !== 'CREATED');
    if (nonPayable.length > 0) {
      return NextResponse.json(
        {
          error: 'Certains colis ne sont pas en statut CREATED',
          blockedColis: nonPayable.map((p) => ({ id: p.id, status: p.status })),
        },
        { status: 400 }
      );
    }

    const normalizedBatchReference = (
      typeof batchReference === 'string' && batchReference.trim().length >= 6
        ? batchReference.trim()
        : generateBatchReference()
    ).replace(/\s+/g, '-').toUpperCase();
    const existingPayments = await db.payment.findMany({
      where: { colisId: { in: colisIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        colisId: true,
        status: true,
        method: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    const byColis = new Map<string, (typeof existingPayments)[number][]>();
    for (const payment of existingPayments) {
      const list = byColis.get(payment.colisId) || [];
      list.push(payment);
      byColis.set(payment.colisId, list);
    }

    const blockedColis: Array<{ id: string; reason: string }> = [];
    const reusableIntents: Array<{ paymentId: string; colisId: string }> = [];
    const toCreate = parcels.filter((parcel) => {
      const payments = byColis.get(parcel.id) || [];
      const completed = payments.find((p) => p.status === 'COMPLETED');
      if (completed) {
        blockedColis.push({ id: parcel.id, reason: 'Paiement deja confirme' });
        return false;
      }

      const active = payments.find((p) => p.status === 'PENDING' || p.status === 'PROCESSING');
      if (active) {
        reusableIntents.push({ paymentId: active.id, colisId: parcel.id });
        return false;
      }

      return true;
    });

    const now = Date.now();
    const createdIntents: Array<{ paymentId: string; colisId: string }> = [];
    if (toCreate.length > 0) {
      await db.$transaction(async (tx) => {
        for (let i = 0; i < toCreate.length; i++) {
          const parcel = toCreate[i];
          const payment = await tx.payment.create({
            data: {
              id: `PAY-${now}-${i}-${crypto.randomUUID().slice(0, 8)}`,
              colisId: parcel.id,
              clientId: parcel.clientId,
              amount: parcel.prixClient,
              currency: 'DZD',
              status: 'PENDING',
              method: paymentMethod,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              errorMessage: `BATCH_REFERENCE:${normalizedBatchReference}`,
            },
            select: { id: true, colisId: true },
          });
          createdIntents.push({ paymentId: payment.id, colisId: payment.colisId });
        }
      });
    }

    return NextResponse.json({
      message: 'Intentions de paiement en ligne creees. En attente de confirmation PSP.',
      created: createdIntents.length,
      reused: reusableIntents.length,
      blocked: blockedColis.length,
      batchReference: normalizedBatchReference,
      intents: [...createdIntents, ...reusableIntents],
      blockedColis,
    });
  } catch (error) {
    console.error('Error updating parcel payment:', error);
    return NextResponse.json({ error: 'Failed to create payment intents' }, { status: 500 });
  }
}
