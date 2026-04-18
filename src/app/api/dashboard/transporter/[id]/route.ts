import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

function isMissingKpiTableError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    code === 'P2010' ||
    code === 'P2021' ||
    message.includes('relation "kpitransporter" does not exist')
  );
}

const emptyKpi = {
  missionsTotal: 0,
  missionsActive: 0,
  missionsAssigned: 0,
  missionsInProgress: 0,
  missionsCompleted: 0,
  earningsTotal: 0,
};

/**
 * GET /api/dashboard/transporter/[id]
 *
 * View-model unique pour le dashboard transporteur.
 * Retourne en une seule requête :
 *  - profileStatus : 'APPROVED' | 'PENDING' | 'REJECTED' | 'MISSING'
 *  - kpi           : compteurs de missions + gains
 *  - trajetCount   : nombre de trajets actifs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { id } = await params;

  // Non-admin ne peut lire que ses propres données
  if (auth.payload.role !== 'ADMIN' && auth.payload.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1. Statut du profil / candidature transporteur
  let profileStatus: 'APPROVED' | 'PENDING' | 'REJECTED' | 'MISSING' = 'MISSING';
  try {
    const application = await db.transporterApplication.findFirst({
      where: { userId: id },
      select: { status: true },
      orderBy: { createdAt: 'desc' },
    });

    if (application) {
      if (application.status === 'APPROVED') profileStatus = 'APPROVED';
      else if (application.status === 'REJECTED') profileStatus = 'REJECTED';
      else profileStatus = 'PENDING';
    }
  } catch (error) {
    console.error('[dashboard/transporter] profile fetch error:', error);
    // On laisse profileStatus = 'MISSING' mais on ne bloque pas la réponse
  }

  // 2. KPI missions (uniquement si profil approuvé)
  let kpi = emptyKpi;
  if (profileStatus === 'APPROVED') {
    try {
      const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT * FROM "KpiTransporter" WHERE "transporteurId" = $1 LIMIT 1',
        id,
      );
      if (rows[0]) {
        kpi = {
          missionsTotal: Number(rows[0].missionsTotal ?? 0),
          missionsActive: Number(rows[0].missionsActive ?? 0),
          missionsAssigned: Number(rows[0].missionsAssigned ?? 0),
          missionsInProgress: Number(rows[0].missionsInProgress ?? 0),
          missionsCompleted: Number(rows[0].missionsCompleted ?? 0),
          earningsTotal: Number(rows[0].earningsTotal ?? 0),
        };
      }
    } catch (error) {
      if (!isMissingKpiTableError(error)) {
        console.error('[dashboard/transporter] kpi fetch error:', error);
      }
      // kpi reste vide — pas bloquant
    }
  }

  // 3. Nombre de trajets actifs
  let trajetCount = 0;
  if (profileStatus === 'APPROVED') {
    try {
      trajetCount = await db.trajet.count({ where: { transporteurId: id } });
    } catch (error) {
      console.error('[dashboard/transporter] trajet count error:', error);
    }
  }

  return NextResponse.json({
    profileStatus,
    kpi,
    trajetCount,
  });
}
