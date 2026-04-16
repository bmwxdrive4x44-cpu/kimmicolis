import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

type RoleParam = 'transporter' | 'enseigne' | 'relais';

function asRoleParam(value: string): RoleParam | null {
  if (value === 'transporter' || value === 'enseigne' || value === 'relais') return value;
  return null;
}

function isMissingKpiTableError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return code === 'P2010' || code === 'P2021' || message.includes('relation "kpitransporter" does not exist') || message.includes('relation "kpienseigne" does not exist') || message.includes('relation "kpirelais" does not exist');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ role: string; id: string }> },
) {
  const auth = await requireRole(request, ['ADMIN', 'TRANSPORTER', 'ENSEIGNE', 'RELAIS']);
  if (!auth.success) return auth.response;

  const { role: rawRole, id } = await params;
  const role = asRoleParam(String(rawRole || '').toLowerCase());
  if (!role) {
    return NextResponse.json({ error: 'Role KPI invalide' }, { status: 400 });
  }

  const actorRole = String(auth.payload.role || '').toUpperCase();
  const actorId = auth.payload.id;

  if (actorRole !== 'ADMIN') {
    if (role === 'transporter' && (actorRole !== 'TRANSPORTER' || actorId !== id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (role === 'enseigne' && (actorRole !== 'ENSEIGNE' || actorId !== id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (role === 'relais') {
      if (actorRole !== 'RELAIS') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const ownedRelais = await db.relais.findUnique({ where: { id }, select: { userId: true } });
      if (!ownedRelais || ownedRelais.userId !== actorId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  if (role === 'transporter') {
    try {
      const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT * FROM "KpiTransporter" WHERE "transporteurId" = $1 LIMIT 1',
        id,
      );
      return NextResponse.json(rows[0] ?? {
        transporteurId: id,
        missionsTotal: 0,
        missionsActive: 0,
        missionsAssigned: 0,
        missionsInProgress: 0,
        missionsCompleted: 0,
        earningsTotal: 0,
      });
    } catch (error) {
      if (!isMissingKpiTableError(error)) throw error;
      return NextResponse.json({
        transporteurId: id,
        missionsTotal: 0,
        missionsActive: 0,
        missionsAssigned: 0,
        missionsInProgress: 0,
        missionsCompleted: 0,
        earningsTotal: 0,
      });
    }
  }

  if (role === 'enseigne') {
    try {
      const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT * FROM "KpiEnseigne" WHERE "enseigneId" = $1 LIMIT 1',
        id,
      );
      return NextResponse.json(rows[0] ?? {
        enseigneId: id,
        parcelsTotal: 0,
        parcelsDelivered: 0,
        pendingPayment: 0,
        readyForDeposit: 0,
        inTransit: 0,
        arrivedRelay: 0,
        revenueDelivered: 0,
        revenueCommitted: 0,
      });
    } catch (error) {
      if (!isMissingKpiTableError(error)) throw error;
      return NextResponse.json({
        enseigneId: id,
        parcelsTotal: 0,
        parcelsDelivered: 0,
        pendingPayment: 0,
        readyForDeposit: 0,
        inTransit: 0,
        arrivedRelay: 0,
        revenueDelivered: 0,
        revenueCommitted: 0,
      });
    }
  }

  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT * FROM "KpiRelais" WHERE "relaisId" = $1 LIMIT 1',
      id,
    );
    return NextResponse.json(rows[0] ?? {
      relaisId: id,
      pendingActions: 0,
      stockDeparture: 0,
      stockArrival: 0,
      handoversCompleted: 0,
      cashOnHand: 0,
      commissionsTotal: 0,
    });
  } catch (error) {
    if (!isMissingKpiTableError(error)) throw error;
    return NextResponse.json({
      relaisId: id,
      pendingActions: 0,
      stockDeparture: 0,
      stockArrival: 0,
      handoversCompleted: 0,
      cashOnHand: 0,
      commissionsTotal: 0,
    });
  }
}
