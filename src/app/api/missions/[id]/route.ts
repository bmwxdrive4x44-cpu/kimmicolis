import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';

// GET single mission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['TRANSPORTER', 'RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    
    const mission = await db.mission.findUnique({
      where: { id },
      include: {
        colis: {
          include: {
            client: { select: { id: true, name: true, email: true, phone: true } },
            relaisDepart: { select: { commerceName: true, ville: true, address: true } },
            relaisArrivee: { select: { commerceName: true, ville: true, address: true } },
          },
        },
        transporteur: { select: { id: true, name: true, phone: true, email: true } },
        trajet: true,
      },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    return NextResponse.json(mission);
  } catch (error) {
    console.error('Error fetching mission:', error);
    return NextResponse.json({ error: 'Failed to fetch mission' }, { status: 500 });
  }
}

// PUT update mission status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body;

    // Get current mission
    const currentMission = await db.mission.findUnique({
      where: { id },
    });

    if (!currentMission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Update mission
    const mission = await db.mission.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'LIVRE' ? new Date() : null,
      },
    });

    // Update parcel status based on mission status
    if (status === 'EN_COURS') {
      await db.colis.update({
        where: { id: mission.colisId },
        data: { status: 'EN_TRANSPORT' },
      });

      await db.trackingHistory.create({
        data: {
          colisId: mission.colisId,
          status: 'EN_TRANSPORT',
          notes: notes || 'Transport en cours',
        },
      });

      const parcel = await db.colis.findUnique({ where: { id: mission.colisId }, select: { clientId: true } });
      if (parcel?.clientId) {
        try {
          await evaluateImplicitProEligibility(parcel.clientId);
        } catch (eligibilityError) {
          console.error('[implicit-pro] mission EN_COURS evaluation failed:', eligibilityError);
        }
      }
    }

    if (status === 'LIVRE') {
      await db.colis.update({
        where: { id: mission.colisId },
        data: { status: 'ARRIVE_RELAIS_DESTINATION' },
      });

      await db.trackingHistory.create({
        data: {
          colisId: mission.colisId,
          status: 'ARRIVE_RELAIS_DESTINATION',
          notes: notes || 'Colis arrivé au relais de destination',
        },
      });

      const parcel = await db.colis.findUnique({ where: { id: mission.colisId }, select: { clientId: true } });
      if (parcel?.clientId) {
        try {
          await evaluateImplicitProEligibility(parcel.clientId);
        } catch (eligibilityError) {
          console.error('[implicit-pro] mission LIVRE evaluation failed:', eligibilityError);
        }
      }
    }

    return NextResponse.json(mission);
  } catch (error) {
    console.error('Error updating mission:', error);
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 });
  }
}

// DELETE mission
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    
    await db.mission.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting mission:', error);
    return NextResponse.json({ error: 'Failed to delete mission' }, { status: 500 });
  }
}
