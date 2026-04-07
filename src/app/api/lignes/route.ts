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
      where.villeDepart = villeDepart;
      where.villeArrivee = villeArrivee;
    } else if (villeDepart) {
      where.villeDepart = villeDepart;
    } else if (villeArrivee) {
      where.villeArrivee = villeArrivee;
    }

    const lignes = await db.ligne.findMany({
      where,
      orderBy: [{ villeDepart: 'asc' }, { villeArrivee: 'asc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json(
      lignes.map((ligne) => ({
        ...ligne,
        tarifPoids: ligne.tarifPetit,
        tarifKm: ligne.tarifMoyen,
      }))
    );
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
    const { villeDepart, villeArrivee, tarifPetit, tarifMoyen, tarifGros, tarifPoids, tarifKm } = body;

    const depart = String(villeDepart || '').trim();
    const arrivee = String(villeArrivee || '').trim();

    if (!depart || !arrivee) {
      return NextResponse.json({ error: 'villeDepart et villeArrivee sont obligatoires' }, { status: 400 });
    }

    if (depart === arrivee) {
      return NextResponse.json({ error: 'villeDepart et villeArrivee doivent être différentes' }, { status: 400 });
    }

    const parsedTarifPoids = Number(tarifPoids ?? tarifPetit);
    const parsedTarifKm = Number(tarifKm ?? tarifMoyen);
    const parsedTarifLegacy = Number(tarifGros);

    if (!Number.isFinite(parsedTarifPoids) || parsedTarifPoids < 0) {
      return NextResponse.json({ error: 'Tarif poids invalide' }, { status: 400 });
    }

    if (!Number.isFinite(parsedTarifKm) || parsedTarifKm < 0) {
      return NextResponse.json({ error: 'Tarif km invalide' }, { status: 400 });
    }

    const existing = await db.ligne.findFirst({
      where: {
        villeDepart: depart,
        villeArrivee: arrivee,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Cette ligne existe déjà pour ce sens', existingId: existing.id },
        { status: 409 }
      );
    }

    const ligne = await db.ligne.create({
      data: {
        villeDepart: depart,
        villeArrivee: arrivee,
        tarifPetit: parsedTarifPoids,
        tarifMoyen: parsedTarifKm,
        tarifGros: Number.isFinite(parsedTarifLegacy) ? parsedTarifLegacy : parsedTarifPoids,
      },
    });

    return NextResponse.json({
      ...ligne,
      tarifPoids: ligne.tarifPetit,
      tarifKm: ligne.tarifMoyen,
    });
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
    const { id, tarifPetit, tarifMoyen, tarifGros, tarifPoids, tarifKm, isActive } = body;

    const nextTarifPoids = tarifPoids ?? tarifPetit;
    const nextTarifKm = tarifKm ?? tarifMoyen;

    const ligne = await db.ligne.update({
      where: { id },
      data: {
        tarifPetit: nextTarifPoids !== undefined ? parseFloat(nextTarifPoids) : undefined,
        tarifMoyen: nextTarifKm !== undefined ? parseFloat(nextTarifKm) : undefined,
        tarifGros: tarifGros !== undefined ? parseFloat(tarifGros) : undefined,
        isActive,
      },
    });

    return NextResponse.json({
      ...ligne,
      tarifPoids: ligne.tarifPetit,
      tarifKm: ligne.tarifMoyen,
    });
  } catch (error) {
    console.error('Error updating ligne:', error);
    return NextResponse.json({ error: 'Failed to update ligne' }, { status: 500 });
  }
}
