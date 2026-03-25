import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { syncTransporterWallets } from '@/lib/payout-sync';

/**
 * GET /api/transporteur/gains
 * Get wallet summary and earnings history for the authenticated transporter.
 *
 * Returns:
 * - pendingGains: gains locked until delivery confirmed
 * - availableGains: gains released (delivery confirmed, awaiting payment)
 * - paidGains: gains already paid out
 * - totalEarnings: sum of all completed deliveries
 * - missions: list of all missions with gain status
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const transporteurId = searchParams.get('transporteurId') || auth.payload.id;

    await syncTransporterWallets({
      actorId: auth.payload.id,
      transporteurId,
    });

    const wallet = await db.transporterWallet.upsert({
      where: { transporteurId },
      update: {},
      create: { transporteurId },
    });

    // Fetch all missions with parcel info
    const missions = await db.mission.findMany({
      where: { transporteurId },
      include: {
        colis: {
          select: {
            trackingNumber: true,
            villeDepart: true,
            villeArrivee: true,
            format: true,
            prixClient: true,
            netTransporteur: true,
            commissionPlateforme: true,
            commissionRelais: true,
            deliveredAt: true,
            status: true,
          },
        },
        trajet: {
          select: { villeDepart: true, villeArrivee: true, dateDepart: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const pendingGains = wallet.pendingEarnings;
    const availableGains = wallet.availableEarnings;
    const paidGains = wallet.totalWithdrawn;
    const totalEarnings = wallet.totalEarned;

    // Monthly breakdown of completed missions
    const monthlyMap = new Map<string, number>();
    missions
      .filter((m) => m.completedAt !== null)
      .forEach((m) => {
        const month = m.completedAt!.toISOString().slice(0, 7);
        const gain = m.colis?.netTransporteur || 0;
        monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + gain);
      });

    const monthly = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }));

    return NextResponse.json({
      wallet: {
        pending: pendingGains,
        available: availableGains,
        paid: paidGains,
        total: totalEarnings,
      },
      monthly,
      missions,
    });
  } catch (error) {
    console.error('Error fetching transporter gains:', error);
    return NextResponse.json({ error: 'Failed to fetch gains' }, { status: 500 });
  }
}
