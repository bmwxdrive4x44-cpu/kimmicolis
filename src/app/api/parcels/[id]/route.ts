import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

// GET single parcel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['CLIENT', 'RELAIS', 'TRANSPORTER', 'ADMIN']);
    if (!auth.success) return auth.response;

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

    if (auth.payload.role === 'CLIENT' && parcel.clientId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    const auth = await requireRole(request, ['CLIENT', 'RELAIS', 'TRANSPORTER', 'ADMIN']);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { status, location, notes } = body;

    const existingParcel = await db.colis.findUnique({
      where: { id },
      select: { clientId: true },
    });

    if (!existingParcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    if (auth.payload.role === 'CLIENT') {
      const allowedStatuses = ['PAID'];
      if (existingParcel.clientId !== auth.payload.id || !allowedStatuses.includes(status)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

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
