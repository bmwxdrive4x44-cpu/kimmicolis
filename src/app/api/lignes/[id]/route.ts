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

    return NextResponse.json({
      ...ligne,
      tarifPoids: ligne.tarifPetit,
      tarifKm: ligne.tarifMoyen,
    });
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
      tarifPoids,
      tarifKm,
      tarifGros, 
      isActive 
    } = body;

    const current = await db.ligne.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'Ligne not found' }, { status: 404 });
    }

    const nextDepart = villeDepart !== undefined ? String(villeDepart).trim() : current.villeDepart;
    const nextArrivee = villeArrivee !== undefined ? String(villeArrivee).trim() : current.villeArrivee;

    if (nextDepart === nextArrivee) {
      return NextResponse.json({ error: 'villeDepart et villeArrivee doivent être différentes' }, { status: 400 });
    }

    const duplicate = await db.ligne.findFirst({
      where: {
        id: { not: id },
        OR: [
          { villeDepart: nextDepart, villeArrivee: nextArrivee },
          { villeDepart: nextArrivee, villeArrivee: nextDepart },
        ],
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'Une ligne identique existe déjà (même paire de villes)' },
        { status: 409 }
      );
    }

    const nextTarifPoids = tarifPoids ?? tarifPetit;
    const nextTarifKm = tarifKm ?? tarifMoyen;

    const updateData: any = {};
    if (villeDepart !== undefined) updateData.villeDepart = nextDepart;
    if (villeArrivee !== undefined) updateData.villeArrivee = nextArrivee;
    if (nextTarifPoids !== undefined) updateData.tarifPetit = Number(nextTarifPoids);
    if (nextTarifKm !== undefined) updateData.tarifMoyen = Number(nextTarifKm);
    if (tarifGros !== undefined) updateData.tarifGros = tarifGros;
    if (isActive !== undefined) updateData.isActive = isActive;

    const ligne = await db.ligne.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...ligne,
      tarifPoids: ligne.tarifPetit,
      tarifKm: ligne.tarifMoyen,
    });
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
