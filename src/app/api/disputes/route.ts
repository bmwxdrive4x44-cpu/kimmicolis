import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

const VALID_REASONS = ['LOST', 'DAMAGED', 'DELAYED', 'WRONG_ADDRESS', 'OTHER'] as const;
const VALID_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as const;

type DisputeDelegate = {
  findMany(args: Record<string, unknown>): Promise<any[]>;
  findFirst(args: Record<string, unknown>): Promise<any | null>;
  findUnique(args: Record<string, unknown>): Promise<any | null>;
  create(args: Record<string, unknown>): Promise<any>;
  update(args: Record<string, unknown>): Promise<any>;
};

const disputeDb = db as typeof db & { dispute: DisputeDelegate };

/**
 * GET /api/disputes
 * CLIENT: sees own disputes | ADMIN: sees all
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'RELAIS', 'TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const colisId = searchParams.get('colisId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};

    if (auth.payload.role !== 'ADMIN') {
      where.openedById = auth.payload.id;
    }
    if (colisId) where.colisId = colisId;
    if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      where.status = status;
    }

    const disputes = await disputeDb.dispute.findMany({
      where,
      include: {
        colis: {
          select: {
            trackingNumber: true,
            villeDepart: true,
            villeArrivee: true,
            status: true,
            weight: true,
            prixClient: true,
          },
        },
        openedBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(disputes);
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}

/**
 * POST /api/disputes
 * Open a new dispute for a colis (CLIENT only — must own the colis)
 */
export async function POST(request: NextRequest) {
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.moderate);
  if (rateCheck.limited) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  const auth = await requireRole(request, ['CLIENT', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisId, reason, description } = body;

    if (!colisId || !reason || !description?.trim()) {
      return NextResponse.json(
        { error: 'colisId, reason, et description sont obligatoires' },
        { status: 400 }
      );
    }

    if (!VALID_REASONS.includes(reason as typeof VALID_REASONS[number])) {
      return NextResponse.json(
        { error: `reason doit être l'un de: ${VALID_REASONS.join(', ')}` },
        { status: 400 }
      );
    }

    const colis = await db.colis.findUnique({ where: { id: colisId } });
    if (!colis) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    if (auth.payload.role !== 'ADMIN' && colis.clientId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Block opening dispute on CREATED or ANNULE parcels
    const blockStatuses = ['CREATED', 'ANNULE'];
    if (blockStatuses.includes(colis.status)) {
      return NextResponse.json(
        { error: `Impossible d'ouvrir un litige sur un colis en statut ${colis.status}` },
        { status: 400 }
      );
    }

    const existing = await disputeDb.dispute.findFirst({
      where: { colisId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Un litige est déjà ouvert pour ce colis' },
        { status: 409 }
      );
    }

    const dispute = await disputeDb.dispute.create({
      data: {
        colisId,
        openedById: auth.payload.id,
        reason,
        description: description.trim(),
      },
    });

    // Update colis status to EN_DISPUTE
    await db.colis.update({
      where: { id: colisId },
      data: { status: 'EN_DISPUTE', updatedAt: new Date() },
    });

    await Promise.all([
      db.trackingHistory.create({
        data: {
          colisId,
          status: 'EN_DISPUTE',
          notes: `Litige ouvert: ${reason} — ${description.trim().substring(0, 100)}`,
        },
      }),
      db.notification.create({
        data: {
          userId: colis.clientId,
          title: 'Litige enregistré',
          message: `Votre litige pour le colis ${colis.trackingNumber} (motif: ${reason}) a été enregistré et est en cours de traitement.`,
          type: 'IN_APP',
        },
      }),
      db.actionLog.create({
        data: {
          userId: auth.payload.id,
          entityType: 'COLIS',
          entityId: colisId,
          action: 'DISPUTE_OPEN',
          details: JSON.stringify({ disputeId: dispute.id, reason }),
          ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
        },
      }),
    ]);

    return NextResponse.json(dispute, { status: 201 });
  } catch (error) {
    console.error('Error creating dispute:', error);
    return NextResponse.json({ error: 'Failed to create dispute' }, { status: 500 });
  }
}

/**
 * PUT /api/disputes
 * Update dispute status — ADMIN only
 */
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { disputeId, status, resolution } = body;

    if (!disputeId || !status) {
      return NextResponse.json({ error: 'disputeId et status sont obligatoires' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const existing = await disputeDb.dispute.findUnique({
      where: { id: disputeId },
      include: { colis: { select: { id: true, trackingNumber: true, clientId: true, status: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Litige non trouvé' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { status };
    if (resolution?.trim()) updateData.resolution = resolution.trim();
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedById = auth.payload.id;
    }

    const updated = await disputeDb.dispute.update({ where: { id: disputeId }, data: updateData });

    // On resolution/closure: restore colis to last known non-dispute status
    if ((status === 'RESOLVED' || status === 'CLOSED') && existing.colis?.status === 'EN_DISPUTE') {
      const lastTracking = await db.trackingHistory.findFirst({
        where: { colisId: existing.colisId, status: { not: 'EN_DISPUTE' } },
        orderBy: { createdAt: 'desc' },
      });
      const restoreStatus = lastTracking?.status ?? 'PAID';

      await db.colis.update({
        where: { id: existing.colisId },
        data: { status: restoreStatus, updatedAt: new Date() },
      });

      await db.notification.create({
        data: {
          userId: existing.colis.clientId,
          title: status === 'RESOLVED' ? 'Litige résolu' : 'Litige clôturé',
          message: `Votre litige pour le colis ${existing.colis.trackingNumber} a été ${status === 'RESOLVED' ? 'résolu' : 'clôturé'}.${resolution ? ` Résolution: ${resolution}` : ''}`,
          type: 'IN_APP',
        },
      });
    }

    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'COLIS',
        entityId: existing.colisId,
        action: 'DISPUTE_UPDATE',
        details: JSON.stringify({ disputeId, status, resolution }),
        ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating dispute:', error);
    return NextResponse.json({ error: 'Failed to update dispute' }, { status: 500 });
  }
}
