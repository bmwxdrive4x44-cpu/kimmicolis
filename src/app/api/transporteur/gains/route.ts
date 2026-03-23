import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

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

    // Calculate wallet buckets
    let pendingGains = 0;   // In transit (not yet delivered)
    let availableGains = 0; // Delivered but not yet paid
    let paidGains = 0;      // Already paid out

    missions.forEach((m) => {
      const gain = m.gainAmount || m.colis?.netTransporteur || 0;
      if (m.gainStatus === 'PAID') paidGains += gain;
      else if (m.gainStatus === 'AVAILABLE') availableGains += gain;
      else pendingGains += gain; // PENDING
    });

    const totalEarnings = paidGains + availableGains; // Confirmed earnings (excludes pending)

    // Monthly breakdown of confirmed earnings
    const monthlyMap = new Map<string, number>();
    missions
      .filter((m) => m.gainStatus !== 'PENDING' && m.completedAt)
      .forEach((m) => {
        const month = m.completedAt!.toISOString().slice(0, 7);
        const gain = m.gainAmount || m.colis?.netTransporteur || 0;
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
