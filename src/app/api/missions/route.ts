import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { createNotificationDedup } from '@/lib/notifications';

// GET missions
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const transporteurId = searchParams.get('transporteurId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (transporteurId) where.transporteurId = transporteurId;
    if (status) where.status = status;

    const missions = await db.mission.findMany({
      where,
      include: {
        colis: {
          include: {
            client: { select: { name: true, phone: true } },
            relaisDepart: { select: { commerceName: true, ville: true, address: true } },
            relaisArrivee: { select: { commerceName: true, ville: true, address: true } },
          },
        },
        transporteur: { select: { name: true, phone: true } },
        trajet: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(missions);
  } catch (error) {
    console.error('Error fetching missions:', error);
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 });
  }
}

// POST create / accept mission
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisId, transporteurId, trajetId } = body;

    if (!colisId || !transporteurId) {
      return NextResponse.json({ error: 'colisId and transporteurId are required' }, { status: 400 });
    }

    // Verify parcel is in DEPOSITED_RELAY status (strict workflow)
    const parcel = await db.colis.findUnique({ where: { id: colisId } });
    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }
    // Accept both new and legacy statuses for backward compatibility
    const acceptableStatuses = ['DEPOSITED_RELAY', 'RECU_RELAIS', 'PAID_RELAY', 'PAID'];
    if (!acceptableStatuses.includes(parcel.status)) {
      return NextResponse.json(
        { error: `Impossible d'assigner un transporteur à un colis avec le statut: ${parcel.status}` },
        { status: 400 }
      );
    }

    // Create mission
    const mission = await db.mission.create({
      data: {
        colisId,
        transporteurId,
        trajetId,
        status: 'ASSIGNE',
      },
    });

    // Update parcel status to ASSIGNED
    await db.colis.update({
      where: { id: colisId },
      data: { status: 'ASSIGNED' },
    });

    // Add tracking history
    await db.trackingHistory.create({
      data: {
        colisId,
        status: 'ASSIGNED',
        notes: 'Transporteur assigné au colis',
      },
    });

    // Update trajet capacity if provided
    if (trajetId) {
      await db.trajet.update({
        where: { id: trajetId },
        data: { placesUtilisees: { increment: 1 } },
      });
    }

    // Notify client
    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Transporteur assigné',
      message: `Un transporteur a été assigné à votre colis ${parcel.trackingNumber}`,
      type: 'IN_APP',
    });

    return NextResponse.json(mission);
  } catch (error) {
    console.error('Error creating mission:', error);
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
  }
}
