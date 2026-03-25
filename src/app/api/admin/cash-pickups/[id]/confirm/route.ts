import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

async function getFirstCollectedColisId(relaisId: string): Promise<string | null> {
  const tx = await db.relaisCash.findFirst({
    where: { relaisId, type: 'COLLECTED' },
    orderBy: { createdAt: 'asc' },
    select: { colisId: true },
  });
  return tx?.colisId || null;
}

/**
 * POST /api/admin/cash-pickups/:id/confirm
 * Body: { collectedAmount, relayValidationCode, collectorValidationCode, proofPhotoUrl?, notes? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      collectedAmount,
      relayValidationCode,
      collectorValidationCode,
      proofPhotoUrl,
      notes,
    } = body;

    if (!collectedAmount || Number(collectedAmount) <= 0) {
      return NextResponse.json({ error: 'collectedAmount requis et > 0' }, { status: 400 });
    }
    if (!relayValidationCode || !collectorValidationCode) {
      return NextResponse.json({ error: 'Double validation requise (relais + collecteur)' }, { status: 400 });
    }

    const pickup = await db.cashPickup.findUnique({
      where: { id },
      include: { relais: { select: { id: true, cashCollected: true, cashReversed: true } } },
    });

    if (!pickup) {
      return NextResponse.json({ error: 'Collecte introuvable' }, { status: 404 });
    }

    if (!['IN_PROGRESS', 'ASSIGNED'].includes(pickup.status)) {
      return NextResponse.json({ error: `Statut invalide: ${pickup.status}` }, { status: 400 });
    }

    const outstanding = Math.max((pickup.relais.cashCollected || 0) - (pickup.relais.cashReversed || 0), 0);
    if (Number(collectedAmount) > outstanding) {
      return NextResponse.json({
        error: `Montant collecté (${collectedAmount} DA) supérieur au cash en attente (${outstanding.toFixed(0)} DA)`,
      }, { status: 400 });
    }

    const anchorColisId = await getFirstCollectedColisId(pickup.relaisId);
    if (!anchorColisId) {
      return NextResponse.json({ error: 'Aucun colis collecté trouvé pour ce relais' }, { status: 400 });
    }

    const receiptRef = `PICKUP-${pickup.relaisId.slice(0, 6).toUpperCase()}-${Date.now()}`;

    const [updatedPickup, reversedTx] = await db.$transaction([
      db.cashPickup.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          collectedAmount: Number(collectedAmount),
          confirmedAt: new Date(),
          receiptRef,
          relayValidationCodeHash: sha256(String(relayValidationCode)),
          collectorCodeHash: sha256(String(collectorValidationCode)),
          proofPhotoUrl: proofPhotoUrl || null,
          notes: notes || pickup.notes,
        },
      }),
      db.relaisCash.create({
        data: {
          relaisId: pickup.relaisId,
          colisId: anchorColisId,
          amount: Number(collectedAmount),
          type: 'REVERSED',
          notes: `Cash pickup confirmed (${receiptRef})`,
        },
      }),
      db.relais.update({
        where: { id: pickup.relaisId },
        data: {
          cashReversed: { increment: Number(collectedAmount) },
        },
      }),
      db.actionLog.create({
        data: {
          userId: auth.payload.id,
          entityType: 'RELAIS',
          entityId: pickup.relaisId,
          action: 'CASH_PICKUP_CONFIRMED',
          details: JSON.stringify({
            pickupId: id,
            receiptRef,
            collectedAmount: Number(collectedAmount),
          }),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      pickup: updatedPickup,
      reversal: reversedTx,
    });
  } catch (error) {
    console.error('Error confirming cash pickup:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
