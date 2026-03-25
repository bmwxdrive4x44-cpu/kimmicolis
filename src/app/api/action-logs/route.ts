import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * GET /api/action-logs?entityId=...&entityType=...&limit=50
 * Returns action logs for anti-fraud audit.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const entityId    = searchParams.get('entityId');
    const entityType  = searchParams.get('entityType');
    const userId      = searchParams.get('userId');
    const limit       = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const where: Record<string, unknown> = {};
    if (entityId)   where.entityId   = entityId;
    if (entityType) where.entityType = entityType;
    if (userId)     where.userId     = userId;

    const logs = await db.actionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching action logs:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/action-logs
 * Create a manual action log entry.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { userId, entityType, entityId, action, details, ipAddress } = body;

    if (!entityType || !entityId || !action) {
      return NextResponse.json({ error: 'entityType, entityId, action requis' }, { status: 400 });
    }

    const log = await db.actionLog.create({
      data: { userId, entityType, entityId, action, details: details ? JSON.stringify(details) : null, ipAddress },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('Error creating action log:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
