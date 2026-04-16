import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';
import { assertMissionTransition, ALL_MISSION_STATUSES } from '@/lib/missionStateMachine';
import { transitionMission } from '@/lib/mission-parcel-sync';

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

    if (auth.payload.role === 'TRANSPORTER' && currentMission.transporteurId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate status value (whitelist)
    if (!ALL_MISSION_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Statut invalide: ${status}` }, { status: 400 });
    }

    // Enforce state machine transition
    try {
      assertMissionTransition(currentMission.status, status);
    } catch {
      return NextResponse.json(
        { error: `Transition interdite : ${currentMission.status} → ${status}` },
        { status: 409 }
      );
    }

    // Update mission + colis atomiquement avec guard de concurrence.
    // transitionMission() utilise updateMany(where: { id, status: currentStatus })
    // → si 0 rows affected = modification concurrente détectée → 409.
    const syncResult = await transitionMission({
      missionId: id,
      expectedCurrentStatus: currentMission.status,
      newStatus: status,
      notes: notes ?? undefined,
    });

    if (!syncResult.updated) {
      return NextResponse.json(
        { error: syncResult.reason, code: 'CONCURRENT_MODIFICATION' },
        { status: 409 }
      );
    }

    // Side-effect hors transaction (non-critique, échec silencieux)
    if (syncResult.colisId) {
      const parcel = await db.colis.findUnique({
        where: { id: syncResult.colisId },
        select: { clientId: true },
      });
      if (parcel?.clientId) {
        evaluateImplicitProEligibility(parcel.clientId).catch((e) =>
          console.error('[implicit-pro] mission transition evaluation failed:', e)
        );
      }
    }

    const mission = await db.mission.findUnique({ where: { id } });
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
