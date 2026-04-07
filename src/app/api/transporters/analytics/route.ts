import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * GET /api/transporters/analytics
 * Analytiques d'auto-assign pour un transporteur :
 * - Missions assignées/livrées/échouées
 * - Gain moyen par mission
 * - Top routes
 * - Stats mensuelles
 * - Taux de complétion
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const requestedId = searchParams.get('transporteurId');

  // Transporteur ne peut voir que ses propres analytics
  const transporteurId =
    auth.payload.role === 'ADMIN' && requestedId ? requestedId : auth.payload.id;

  try {
    // Toutes les missions avec données colis
    const missions = await db.mission.findMany({
      where: { transporteurId },
      include: {
        colis: {
          select: {
            villeDepart: true,
            villeArrivee: true,
            netTransporteur: true,
            weight: true,
            status: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const totalAssigned = missions.length;
    const totalCompleted = missions.filter(m => m.status === 'LIVRE').length;
    const totalActive = missions.filter(m => ['ASSIGNE', 'EN_COURS'].includes(m.status)).length;
    const totalFailed = missions.filter(m => m.status === 'ANNULE').length;

    const successRate = totalAssigned > 0
      ? Math.round((totalCompleted / totalAssigned) * 100)
      : 100;

    // Gain moyen par mission livrée
    const completedMissions = missions.filter(m => m.status === 'LIVRE' && m.colis);
    const totalEarnings = completedMissions.reduce(
      (sum, m) => sum + (m.colis?.netTransporteur ?? 0),
      0
    );
    const avgEarningsPerMission = completedMissions.length > 0
      ? totalEarnings / completedMissions.length
      : 0;

    // Top routes (par nombre de missions)
    const routeCounts = new Map<string, { villeDepart: string; villeArrivee: string; count: number }>();
    for (const m of missions) {
      if (!m.colis) continue;
      const key = `${m.colis.villeDepart}→${m.colis.villeArrivee}`;
      const existing = routeCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        routeCounts.set(key, {
          villeDepart: m.colis.villeDepart,
          villeArrivee: m.colis.villeArrivee,
          count: 1,
        });
      }
    }
    const topRoutes = Array.from(routeCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Stats mensuelles (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentMissions = missions.filter(m => new Date(m.assignedAt) >= sixMonthsAgo);
    const monthlyMap = new Map<string, { count: number; earnings: number }>();

    for (const m of recentMissions) {
      const d = new Date(m.assignedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyMap.get(key) || { count: 0, earnings: 0 };
      existing.count++;
      if (m.status === 'LIVRE') {
        existing.earnings += m.colis?.netTransporteur ?? 0;
      }
      monthlyMap.set(key, existing);
    }

    const monthlyStats = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    // Missions des 7 derniers jours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentWeek = missions.filter(m => new Date(m.assignedAt) >= sevenDaysAgo);

    // Répartition par statut
    const statusBreakdown = {
      ASSIGNE: missions.filter(m => m.status === 'ASSIGNE').length,
      EN_COURS: missions.filter(m => m.status === 'EN_COURS').length,
      LIVRE: totalCompleted,
      ANNULE: totalFailed,
    };

    return NextResponse.json({
      totalAssigned,
      totalCompleted,
      totalActive,
      totalFailed,
      successRate,
      avgEarningsPerMission,
      totalEarnings,
      topRoutes,
      monthlyStats,
      recentWeekCount: recentWeek.length,
      statusBreakdown,
    });
  } catch (error) {
    console.error('Error fetching transporter analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
