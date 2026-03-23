import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * GET /api/transporteur/gains
 * Get earnings summary and history for the authenticated transporter.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const transporteurId = searchParams.get('transporteurId') || auth.payload.id;

    // Fetch all completed missions with parcel info
    const missions = await db.mission.findMany({
      where: {
        transporteurId,
        status: 'LIVRE',
      },
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
          },
        },
        trajet: {
          select: {
            villeDepart: true,
            villeArrivee: true,
            dateDepart: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    const totalEarnings = missions.reduce(
      (sum, m) => sum + (m.colis?.netTransporteur ?? 0),
      0
    );
    const completedDeliveries = missions.length;

    // Monthly breakdown
    const monthlyMap = new Map<string, number>();
    missions.forEach((m) => {
      if (m.completedAt) {
        const month = m.completedAt.toISOString().slice(0, 7); // YYYY-MM
        monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + (m.colis?.netTransporteur ?? 0));
      }
    });

    const monthly = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }));

    return NextResponse.json({
      totalEarnings,
      completedDeliveries,
      monthly,
      missions,
    });
  } catch (error) {
    console.error('Error fetching transporter gains:', error);
    return NextResponse.json({ error: 'Failed to fetch gains' }, { status: 500 });
  }
}
