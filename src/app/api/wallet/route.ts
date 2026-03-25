import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * GET /api/wallet?transporteurId=...
 * Returns the wallet for a given transporter (creates it if missing).
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const transporteurId = searchParams.get('transporteurId');

    if (!transporteurId) {
      return NextResponse.json({ error: 'transporteurId requis' }, { status: 400 });
    }

    if (auth.payload.role === 'TRANSPORTER' && auth.payload.id !== transporteurId) {
      return NextResponse.json({ error: 'Accès interdit à ce wallet' }, { status: 403 });
    }

    const wallet = await db.transporterWallet.upsert({
      where: { transporteurId },
      update: {},
      create: { transporteurId },
    });

    // Fetch missions history for audit
    const missions = await db.mission.findMany({
      where: { transporteurId },
      include: {
        colis: {
          select: {
            trackingNumber: true,
            format: true,
            netTransporteur: true,
            status: true,
            villeDepart: true,
            villeArrivee: true,
            deliveredAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ wallet, missions });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/wallet/withdraw
 * Request withdrawal of available earnings.
 * Body: { transporteurId, amount }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { transporteurId, amount } = body;

    if (!transporteurId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }

    if (auth.payload.role === 'TRANSPORTER' && auth.payload.id !== transporteurId) {
      return NextResponse.json({ error: 'Accès interdit à ce wallet' }, { status: 403 });
    }

    const wallet = await db.transporterWallet.findUnique({ where: { transporteurId } });
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 });
    }
    if (wallet.availableEarnings < amount) {
      return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
    }

    const updated = await db.transporterWallet.update({
      where: { transporteurId },
      data: {
        availableEarnings: { decrement: amount },
        totalWithdrawn:    { increment: amount },
      },
    });

    // Log the withdrawal
    await db.actionLog.create({
      data: {
        userId: transporteurId,
        entityType: 'TRANSPORTER',
        entityId: transporteurId,
        action: 'WALLET_WITHDRAW',
        details: JSON.stringify({ amount, newBalance: updated.availableEarnings }),
      },
    });

    return NextResponse.json({ success: true, wallet: updated });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
