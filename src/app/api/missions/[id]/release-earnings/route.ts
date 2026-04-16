import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * POST /api/missions/{id}/release-earnings
 * Release escrowed earnings when mission completed (LIVRE)
 * Called when colis status changes to LIVRE
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  const { id: missionId } = await params;

  try {
    const eventId = `EARNINGS_RELEASED:${missionId}`;

    const result = await db.$transaction(async (tx) => {
      const mission = await (tx as any).mission.findUnique({
        where: { id: missionId },
        include: { colis: true },
      });

      if (!mission) {
        return { kind: 'not_found' as const };
      }

      if (mission.status !== 'LIVRE') {
        return { kind: 'invalid_mission_status' as const, missionStatus: mission.status };
      }

      // Strict guard for payout: client-side final delivery only.
      const colisFinal = ['LIVRE', 'DELIVERED'];
      if (!colisFinal.includes(mission.colis.status)) {
        return { kind: 'invalid_colis_status' as const, colisStatus: mission.colis.status };
      }

      const alreadyReleased = await (tx as any).actionLog.findUnique({
        where: { eventId },
        select: { id: true },
      });

      if (alreadyReleased) {
        const walletSnapshot = await tx.transporterWallet.findUnique({
          where: { transporteurId: mission.transporteurId },
          select: { availableEarnings: true, escrowedEarnings: true },
        });

        return {
          kind: 'idempotent' as const,
          wallet: {
            available: walletSnapshot?.availableEarnings ?? 0,
            escrowed: walletSnapshot?.escrowedEarnings ?? 0,
          },
        };
      }

      const releaseAmount = Number(mission.colis.netTransporteur || 0) * 0.5;

      const currentWallet = await tx.transporterWallet.findUnique({
        where: { transporteurId: mission.transporteurId },
      });

      if (!currentWallet) {
        return { kind: 'wallet_missing' as const };
      }

      if (currentWallet.escrowedEarnings < releaseAmount) {
        return {
          kind: 'insufficient_escrow' as const,
          escrowed: currentWallet.escrowedEarnings,
          required: releaseAmount,
        };
      }

      const wallet = await tx.transporterWallet.update({
        where: { transporteurId: mission.transporteurId },
        data: {
          escrowedEarnings: { decrement: releaseAmount },
          availableEarnings: { increment: releaseAmount },
          totalEarned: { increment: Number(mission.colis.netTransporteur || 0) },
        },
      });

      await (tx as any).actionLog.create({
        data: {
          eventId,
          scope: 'PAYMENT',
          userId: auth.payload.id,
          entityType: 'MISSION',
          entityId: missionId,
          action: 'MISSION_EARNINGS_RELEASED',
          details: JSON.stringify({
            missionId,
            colisId: mission.colis.id,
            transporteurId: mission.transporteurId,
            amount: mission.colis.netTransporteur,
            releaseAmount,
          }),
        },
      });

      return {
        kind: 'released' as const,
        wallet: {
          available: wallet.availableEarnings,
          escrowed: wallet.escrowedEarnings,
        },
      };
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    if (result.kind === 'invalid_mission_status') {
      return NextResponse.json(
        { error: `Impossible de libérer les gains : mission en statut "${result.missionStatus}", attendu LIVRE` },
        { status: 409 }
      );
    }

    if (result.kind === 'invalid_colis_status') {
      return NextResponse.json(
        { error: `Impossible de libérer les gains : colis en statut "${result.colisStatus}", attendu LIVRE/DELIVERED` },
        { status: 409 }
      );
    }

    if (result.kind === 'wallet_missing') {
      return NextResponse.json(
        { error: 'Wallet transporteur introuvable' },
        { status: 409 }
      );
    }

    if (result.kind === 'insufficient_escrow') {
      return NextResponse.json(
        { error: `Escrow insuffisant (${result.escrowed} < ${result.required})` },
        { status: 409 }
      );
    }

    if (result.kind === 'idempotent') {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Earnings déjà libérés',
        wallet: result.wallet,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Earnings released from escrow',
      wallet: {
        available: result.wallet.available,
        escrowed: result.wallet.escrowed,
      },
    });
  } catch (error) {
    console.error('[release-earnings] Error:', error);
    return NextResponse.json({ error: 'Failed to release earnings' }, { status: 500 });
  }
}
