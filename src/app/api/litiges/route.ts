import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

const VALID_REASONS = ['LOST', 'DAMAGED', 'DELAYED', 'WRONG_ADDRESS', 'OTHER'];

// POST /api/litiges — ouvre un litige sur un colis (marque EN_DISPUTE)
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT']);
  if (!auth.success) return auth.response;
  const { payload } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (_e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const colisId = typeof body.colisId === 'string' ? body.colisId : undefined;
  const reason = typeof body.reason === 'string' ? body.reason : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;

  if (!colisId || typeof colisId !== 'string') {
    return NextResponse.json({ error: 'colisId requis' }, { status: 400 });
  }
  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Motif invalide' }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return NextResponse.json({ error: 'Description trop courte' }, { status: 400 });
  }

  // Verify ownership
  const colis = await db.colis.findUnique({ where: { id: colisId }, select: { id: true, clientId: true, status: true } });
  if (!colis) return NextResponse.json({ error: 'Colis introuvable' }, { status: 404 });
  if (colis.clientId !== payload.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const DISPUTABLE_STATUSES = ['PAID', 'DEPOSITED_RELAY', 'RECU_RELAIS', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION'];
  if (!DISPUTABLE_STATUSES.includes(colis.status)) {
    return NextResponse.json({ error: 'Ce colis ne peut pas faire l\'objet d\'un litige dans son état actuel' }, { status: 422 });
  }

  await db.colis.update({
    where: { id: colisId },
    data: { status: 'EN_DISPUTE' },
  });

  return NextResponse.json({ success: true, message: 'Litige ouvert. Notre équipe vous contactera.' }, { status: 201 });
}

// GET /api/litiges — liste les colis EN_DISPUTE du client connecté
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'ADMIN']);
  if (!auth.success) return auth.response;
  const { payload } = auth;

  const where = payload.role === 'ADMIN'
    ? { status: 'EN_DISPUTE' }
    : { clientId: payload.id, status: 'EN_DISPUTE' };

  const colis = await db.colis.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, trackingNumber: true, villeDepart: true, villeArrivee: true, status: true, updatedAt: true },
  });

  return NextResponse.json(colis);
}
