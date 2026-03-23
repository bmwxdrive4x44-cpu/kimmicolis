import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { RELAY_BLOCK_THRESHOLD_DA } from '@/lib/constants';

/**
 * GET /api/relais/financials
 * Get financial summary for a relay point.
 * - totalEncaisse: total cash collected from clients
 * - totalReverseé: total reversed/sent to platform
 * - balance: unreversed amount (totalEncaisse - totalReverseé)
 * - isBlocked: whether relay is auto-blocked
 * - transactions: cash transaction history
 *
 * POST /api/relais/financials
 * Admin records a cash reversal from relay to platform.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    let relaisId = searchParams.get('relaisId');

    // If RELAIS role, find their own relais
    if (!relaisId && auth.payload.role === 'RELAIS') {
      const relais = await db.relais.findUnique({ where: { userId: auth.payload.id } });
      if (!relais) {
        return NextResponse.json({ error: 'Point relais non trouvé' }, { status: 404 });
      }
      relaisId = relais.id;
    }

    if (!relaisId) {
      return NextResponse.json({ error: 'relaisId is required' }, { status: 400 });
    }

    const relais = await db.relais.findUnique({ where: { id: relaisId } });
    if (!relais) {
      return NextResponse.json({ error: 'Point relais non trouvé' }, { status: 404 });
    }

    // Get transaction history
    const transactions = await db.cashTransaction.findMany({
      where: { relaisId },
      include: {
        colis: { select: { trackingNumber: true, villeDepart: true, villeArrivee: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const balance = relais.totalEncaisse - relais.totalReverseé;
    const blockRisk = (balance / RELAY_BLOCK_THRESHOLD_DA) * 100; // percentage

    return NextResponse.json({
      relaisId,
      commerceName: relais.commerceName,
      totalEncaisse: relais.totalEncaisse,
      totalReverse: relais.totalReverseé, // DB field uses accented char; API exposes clean name
      balance,
      isBlocked: relais.isBlocked,
      blockThreshold: RELAY_BLOCK_THRESHOLD_DA,
      blockRiskPercent: Math.min(blockRisk, 100),
      transactions,
    });
  } catch (error) {
    console.error('Error fetching relay financials:', error);
    return NextResponse.json({ error: 'Failed to fetch financials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { relaisId, amount, description } = body;

    if (!relaisId || !amount) {
      return NextResponse.json(
        { error: 'relaisId and amount are required' },
        { status: 400 }
      );
    }

    const relais = await db.relais.findUnique({ where: { id: relaisId } });
    if (!relais) {
      return NextResponse.json({ error: 'Point relais non trouvé' }, { status: 404 });
    }

    // Record reversal
    await db.cashTransaction.create({
      data: {
        relaisId,
        type: 'REVERSED',
        amount,
        description: description || `Reversement de ${amount} DA`,
      },
    });

    // Update relay totals and check if should unblock
    const newReversed = relais.totalReverseé + amount;
    const newBalance = relais.totalEncaisse - newReversed;
    const shouldUnblock = relais.isBlocked && newBalance < RELAY_BLOCK_THRESHOLD_DA;

    const updatedRelais = await db.relais.update({
      where: { id: relaisId },
      data: {
        totalReverseé: newReversed,
        isBlocked: shouldUnblock ? false : relais.isBlocked,
      },
    });

    // Notify relay user
    await db.notification.create({
      data: {
        userId: relais.userId,
        title: 'Reversement enregistré',
        message: `Un reversement de ${amount} DA a été enregistré pour votre point relais.`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({
      success: true,
      relais: updatedRelais,
      balance: newBalance,
      message: `Reversement de ${amount} DA enregistré`,
    });
  } catch (error) {
    console.error('Error recording reversal:', error);
    return NextResponse.json({ error: 'Failed to record reversal' }, { status: 500 });
  }
}
