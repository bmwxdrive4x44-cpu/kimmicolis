import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, hasAccess, verifyJWT } from '@/lib/rbac';

// GET single relais (PUBLIC)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
    if (!auth.success) return auth.response;

    const { id } = await params;
    
    const relais = await db.relais.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!relais) {
      return NextResponse.json({ error: 'Relais not found' }, { status: 404 });
    }

    if (auth.payload.role === 'RELAIS' && relais.userId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(relais);
  } catch (error) {
    console.error('Error fetching relais:', error);
    return NextResponse.json({ error: 'Failed to fetch relais' }, { status: 500 });
  }
}

// PUT update relais - ADMIN for status, SELF for info (ADMIN ONLY for status)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { payload } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    
    // Extract all possible fields
    const { 
      status, 
      operationalStatus,
      suspensionReason,
      commissionPetit, 
      commissionMoyen, 
      commissionGros,
      commerceName,
      address,
      ville,
      openTime,
      closeTime,
      latitude,
      longitude,
      photos,
    } = body;

    const existingRelais = await db.relais.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingRelais) {
      return NextResponse.json({ error: 'Relais not found' }, { status: 404 });
    }

    const isAdmin = payload.role === 'ADMIN';
    const isOwner = existingRelais.userId === payload.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // STATUS CHANGE REQUIRES ADMIN
    if (status !== undefined && !isAdmin) {
      return NextResponse.json({
        error: 'Forbidden: only admins can change relay status',
      }, { status: 403 });
    }

    // OPERATIONAL STATUS CHANGE REQUIRES ADMIN
    if (operationalStatus !== undefined && !isAdmin) {
      return NextResponse.json({
        error: 'Forbidden: only admins can change relay operational status',
      }, { status: 403 });
    }

    if (!isAdmin && (commissionPetit !== undefined || commissionMoyen !== undefined || commissionGros !== undefined)) {
      return NextResponse.json({
        error: 'Forbidden: only admins can change relay commissions',
      }, { status: 403 });
    }

    // Build data object with only provided fields
    const data: any = {};
    
    if (status !== undefined) data.status = status;
    if (operationalStatus !== undefined) {
      data.operationalStatus = operationalStatus;
      // When suspending, record the suspension time
      if (operationalStatus === 'SUSPENDU') {
        data.suspendedAt = new Date();
      } else if (operationalStatus === 'ACTIF') {
        data.suspendedAt = null;
      }
    }
    if (suspensionReason !== undefined) data.suspensionReason = suspensionReason;
    if (commissionPetit !== undefined) data.commissionPetit = commissionPetit;
    if (commissionMoyen !== undefined) data.commissionMoyen = commissionMoyen;
    if (commissionGros !== undefined) data.commissionGros = commissionGros;
    if (commerceName !== undefined) data.commerceName = commerceName;
    if (address !== undefined) data.address = address;
    if (ville !== undefined) data.ville = ville;
    if (openTime !== undefined) data.openTime = openTime;
    if (closeTime !== undefined) data.closeTime = closeTime;
    if (latitude !== undefined) data.latitude = latitude;
    if (longitude !== undefined) data.longitude = longitude;
    if (photos !== undefined) data.photos = photos;

    // If admin changes approval status, keep all records of the same user aligned.
    // This protects against legacy duplicate rows that might exist in some environments.
    if (isAdmin && status !== undefined) {
      await db.relais.updateMany({
        where: { userId: existingRelais.userId },
        data: { status },
      });
    }

    const relais = await db.relais.update({
      where: { id },
      data,
    });

    return NextResponse.json(relais);
  } catch (error) {
    console.error('Error updating relais:', error);
    return NextResponse.json({ 
      error: 'Failed to update relais',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE relais
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.success) return auth.response;

    const { id } = await params;
    
    const relais = await db.relais.findUnique({
      where: { id },
      select: { 
        id: true,
        commerceName: true,
        parcelsDepart: { select: { id: true } },
        parcelsArrivee: { select: { id: true } },
      },
    });

    if (!relais) {
      return NextResponse.json({ error: 'Relais not found' }, { status: 404 });
    }

    // Check if relay has associated parcels
    const associatedParcels = relais.parcelsDepart.length + relais.parcelsArrivee.length;
    if (associatedParcels > 0) {
      return NextResponse.json({ 
        error: `Cannot delete relay with associated parcels`,
        code: 'RELAIS_HAS_PARCELS',
        details: `${relais.commerceName} has ${associatedParcels} parcels. Delete or reassign parcels first.`
      }, { status: 409 });
    }

    // Delete cash transactions and pickups
    await db.relaisCash.deleteMany({
      where: { relaisId: id },
    });

    await db.cashPickup.deleteMany({
      where: { relaisId: id },
    });

    // Delete related records
    await db.relaisSanction.deleteMany({
      where: { relaisId: id },
    });

    await db.relaisAudit.deleteMany({
      where: { relaisId: id },
    });

    // Finally delete the relais
    await db.relais.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Relais deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting relais:', error);
    return NextResponse.json({ 
      error: 'Failed to delete relais',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
