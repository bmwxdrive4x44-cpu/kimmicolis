import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET single ligne
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const ligne = await db.ligne.findUnique({
      where: { id },
    });

    if (!ligne) {
      return NextResponse.json({ error: 'Ligne not found' }, { status: 404 });
    }

    return NextResponse.json(ligne);
  } catch (error) {
    console.error('Error fetching ligne:', error);
    return NextResponse.json({ error: 'Failed to fetch ligne' }, { status: 500 });
  }
}

// PUT update ligne
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { 
      villeDepart, 
      villeArrivee, 
      tarifPetit, 
      tarifMoyen, 
      tarifGros, 
      isActive 
    } = body;

    const updateData: any = {};
    if (villeDepart !== undefined) updateData.villeDepart = villeDepart;
    if (villeArrivee !== undefined) updateData.villeArrivee = villeArrivee;
    if (tarifPetit !== undefined) updateData.tarifPetit = tarifPetit;
    if (tarifMoyen !== undefined) updateData.tarifMoyen = tarifMoyen;
    if (tarifGros !== undefined) updateData.tarifGros = tarifGros;
    if (isActive !== undefined) updateData.isActive = isActive;

    const ligne = await db.ligne.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(ligne);
  } catch (error) {
    console.error('Error updating ligne:', error);
    return NextResponse.json({ 
      error: 'Failed to update ligne',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE ligne
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db.ligne.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ligne:', error);
    return NextResponse.json({ error: 'Failed to delete ligne' }, { status: 500 });
  }
}
