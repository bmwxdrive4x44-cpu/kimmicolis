import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/relais-cash?relaisId=...
 * Returns cash ledger for a relay point.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relaisId = searchParams.get('relaisId');

    if (!relaisId) {
      return NextResponse.json({ error: 'relaisId requis' }, { status: 400 });
    }

    const [relais, transactions] = await Promise.all([
      db.relais.findUnique({
        where: { id: relaisId },
        select: { cashCollected: true, cashReversed: true, commissionPetit: true, commissionMoyen: true, commissionGros: true },
      }),
      db.relaisCash.findMany({
        where: { relaisId },
        include: { colis: { select: { trackingNumber: true, format: true, prixClient: true, commissionRelais: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    if (!relais) {
      return NextResponse.json({ error: 'Relais introuvable' }, { status: 404 });
    }

    const balance = relais.cashCollected - relais.cashReversed;
    const totalCommissions = transactions
      .filter(t => t.type === 'COLLECTED')
      .reduce((sum, t) => sum + (t.colis?.commissionRelais || 0), 0);

    return NextResponse.json({
      cashCollected: relais.cashCollected,
      cashReversed: relais.cashReversed,
      balance,
      totalCommissions,
      transactions,
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
  try {
    const body = await request.json();
    const { relaisId, amount, notes, userId, colisId } = body;

    if (!relaisId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'relaisId et amount requis' }, { status: 400 });
    }

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
          userId,
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
