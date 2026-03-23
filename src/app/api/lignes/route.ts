import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { Prisma } from '@prisma/client';

// GET all lignes (PUBLIC)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const villeDepart = searchParams.get('villeDepart');
    const villeArrivee = searchParams.get('villeArrivee');

    const where: Prisma.LigneWhereInput = {};
    if (villeDepart && villeArrivee) {
      where.OR = [
        { villeDepart, villeArrivee },
        { villeDepart: villeArrivee, villeArrivee: villeDepart },
      ];
    } else if (villeDepart) {
      where.villeDepart = villeDepart;
    } else if (villeArrivee) {
      where.villeArrivee = villeArrivee;
    }

    const lignes = await db.ligne.findMany({
      where,
      orderBy: [{ villeDepart: 'asc' }, { villeArrivee: 'asc' }],
    });
    return NextResponse.json(lignes);
  } catch (error) {
    console.error('Error fetching lignes:', error);
    return NextResponse.json({ error: 'Failed to fetch lignes' }, { status: 500 });
  }
}

// POST create ligne (ADMIN ONLY)
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { villeDepart, villeArrivee, tarifPetit, tarifMoyen, tarifGros } = body;

    const ligne = await db.ligne.create({
      data: {
        villeDepart,
        villeArrivee,
        tarifPetit: parseFloat(tarifPetit),
        tarifMoyen: parseFloat(tarifMoyen),
        tarifGros: parseFloat(tarifGros),
      },
    });

    return NextResponse.json(ligne);
  } catch (error) {
    console.error('Error creating ligne:', error);
    return NextResponse.json({ error: 'Failed to create ligne' }, { status: 500 });
  }
}

// PUT update ligne (ADMIN ONLY)
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, tarifPetit, tarifMoyen, tarifGros, isActive } = body;

    const ligne = await db.ligne.update({
      where: { id },
      data: {
        tarifPetit: tarifPetit !== undefined ? parseFloat(tarifPetit) : undefined,
        tarifMoyen: tarifMoyen !== undefined ? parseFloat(tarifMoyen) : undefined,
        tarifGros: tarifGros !== undefined ? parseFloat(tarifGros) : undefined,
        isActive,
      },
    });

    return NextResponse.json(ligne);
  } catch (error) {
    console.error('Error updating ligne:', error);
    return NextResponse.json({ error: 'Failed to update ligne' }, { status: 500 });
  }
}
