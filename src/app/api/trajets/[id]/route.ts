import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trajet = await db.trajet.findUnique({
      where: { id },
      include: {
        transporteur: true,
        missions: {
          include: {
            colis: {
              include: {
                client: true,
                relaisDepart: true,
                relaisArrivee: true,
              },
            },
          },
        },
      },
    });

    if (!trajet) {
      return NextResponse.json({ error: 'Trajet not found' }, { status: 404 });
    }

    return NextResponse.json(trajet);
  } catch (error) {
    console.error('Fetch trajet error:', error);
    return NextResponse.json({ error: 'Failed to fetch trajet' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, placesUtilisees } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (placesUtilisees !== undefined) updateData.placesUtilisees = placesUtilisees;

    const trajet = await db.trajet.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(trajet);
  } catch (error) {
    console.error('Update trajet error:', error);
    return NextResponse.json({ error: 'Failed to update trajet' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if there are active missions
    const missions = await db.mission.findMany({
      where: { trajetId: id },
    });

    if (missions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete trajet with active missions' },
        { status: 400 }
      );
    }

    await db.trajet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete trajet error:', error);
    return NextResponse.json({ error: 'Failed to delete trajet' }, { status: 500 });
  }
}
