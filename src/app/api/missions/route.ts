import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all missions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transporteurId = searchParams.get('transporteurId');
    const status = searchParams.get('status');

    let where: any = {};
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

// POST create/accept mission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { colisId, transporteurId, trajetId } = body;

    // Create mission
    const mission = await db.mission.create({
      data: {
        colisId,
        transporteurId,
        trajetId,
        status: 'ASSIGNE',
      },
    });

    // Update parcel status
    await db.colis.update({
      where: { id: colisId },
      data: { status: 'EN_TRANSPORT' },
    });

    // Add tracking history
    await db.trackingHistory.create({
      data: {
        colisId,
        status: 'EN_TRANSPORT',
        notes: 'Colis pris en charge par le transporteur',
      },
    });

    // Update trajet capacity if provided
    if (trajetId) {
      await db.trajet.update({
        where: { id: trajetId },
        data: { placesUtilisees: { increment: 1 } },
      });
    }

    return NextResponse.json(mission);
  } catch (error) {
    console.error('Error creating mission:', error);
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
  }
}

// PUT complete mission
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    const mission = await db.mission.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'LIVRE' ? new Date() : null,
      },
    });

    // Update parcel status
    if (status === 'LIVRE') {
      await db.colis.update({
        where: { id: mission.colisId },
        data: {
          status: 'ARRIVE_RELAIS_DESTINATION',
        },
      });

      await db.trackingHistory.create({
        data: {
          colisId: mission.colisId,
          status: 'ARRIVE_RELAIS_DESTINATION',
          notes: 'Colis arrivé au relais de destination',
        },
      });
    }

    return NextResponse.json(mission);
  } catch (error) {
    console.error('Error updating mission:', error);
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 });
  }
}
