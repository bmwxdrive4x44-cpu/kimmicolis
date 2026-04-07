import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';

/**
 * POST /api/loyalty/evaluate/admin-batch
 * Recalcule l'éligibilité implicite pour tous les clients actifs.
 * Sécurisé par session ADMIN (pas de CRON_SECRET côté client).
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(1000, Number(body?.limit ?? 500)));

  const clients = await db.user.findMany({
    where: { role: 'CLIENT', isActive: true },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  let processed = 0;
  let failed = 0;

  for (const client of clients) {
    try {
      await evaluateImplicitProEligibility(client.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error('[admin-batch] client failed', client.id, error);
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    failed,
    total: clients.length,
    timestamp: new Date().toISOString(),
  });
}
