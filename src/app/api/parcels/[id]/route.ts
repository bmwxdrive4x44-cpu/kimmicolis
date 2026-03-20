import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET single parcel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const parcel = await db.colis.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        relaisDepart: { include: { user: { select: { name: true, phone: true } } } },
        relaisArrivee: { include: { user: { select: { name: true, phone: true } } } },
        missions: { include: { transporteur: { select: { id: true, name: true, phone: true } } } },
        trackingHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    return NextResponse.json(parcel);
  } catch (error) {
    console.error('Error fetching parcel:', error);
    return NextResponse.json({ error: 'Failed to fetch parcel' }, { status: 500 });
  }
}

// PUT update parcel status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, location, notes } = body;

    const parcel = await db.colis.update({
      where: { id },
      data: {
        status,
        deliveredAt: status === 'LIVRE' ? new Date() : null,
      },
    });

    // Add tracking history
    if (status) {
      await db.trackingHistory.create({
        data: {
          colisId: id,
          status,
          location,
          notes,
        },
      });
    }

    return NextResponse.json(parcel);
  } catch (error) {
    console.error('Error updating parcel:', error);
    return NextResponse.json({ error: 'Failed to update parcel' }, { status: 500 });
  }
}
