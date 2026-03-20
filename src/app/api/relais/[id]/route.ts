import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET single relais
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return NextResponse.json(relais);
  } catch (error) {
    console.error('Error fetching relais:', error);
    return NextResponse.json({ error: 'Failed to fetch relais' }, { status: 500 });
  }
}

// PUT update relais (status, commissions, or info)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Extract all possible fields
    const { 
      status, 
      commissionPetit, 
      commissionMoyen, 
      commissionGros,
      commerceName,
      address,
      ville,
      latitude,
      longitude,
      photos,
    } = body;

    // Build data object with only provided fields
    const data: any = {};
    
    if (status !== undefined) data.status = status;
    if (commissionPetit !== undefined) data.commissionPetit = commissionPetit;
    if (commissionMoyen !== undefined) data.commissionMoyen = commissionMoyen;
    if (commissionGros !== undefined) data.commissionGros = commissionGros;
    if (commerceName !== undefined) data.commerceName = commerceName;
    if (address !== undefined) data.address = address;
    if (ville !== undefined) data.ville = ville;
    if (latitude !== undefined) data.latitude = latitude;
    if (longitude !== undefined) data.longitude = longitude;
    if (photos !== undefined) data.photos = photos;

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
    const { id } = await params;
    
    await db.relais.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting relais:', error);
    return NextResponse.json({ error: 'Failed to delete relais' }, { status: 500 });
  }
}
