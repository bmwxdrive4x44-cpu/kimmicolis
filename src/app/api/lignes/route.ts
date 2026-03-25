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
      orderBy: [{ updatedAt: 'desc' }],
    });

    // Déduplication défensive (paire canonique A↔B), garde la ligne la plus récente.
    const uniqueByPair = new Map<string, (typeof lignes)[number]>();
    for (const ligne of lignes) {
      const [a, b] = [ligne.villeDepart, ligne.villeArrivee].sort();
      const key = `${a}__${b}`;
      if (!uniqueByPair.has(key)) {
        uniqueByPair.set(key, ligne);
      }
    }

    const deduped = Array.from(uniqueByPair.values()).sort((x, y) => {
      if (x.villeDepart === y.villeDepart) {
        return x.villeArrivee.localeCompare(y.villeArrivee);
      }
      return x.villeDepart.localeCompare(y.villeDepart);
    });

    return NextResponse.json(deduped);
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

    const depart = String(villeDepart || '').trim();
    const arrivee = String(villeArrivee || '').trim();

    if (!depart || !arrivee) {
      return NextResponse.json({ error: 'villeDepart et villeArrivee sont obligatoires' }, { status: 400 });
    }

    if (depart === arrivee) {
      return NextResponse.json({ error: 'villeDepart et villeArrivee doivent être différentes' }, { status: 400 });
    }

    const existing = await db.ligne.findFirst({
      where: {
        OR: [
          { villeDepart: depart, villeArrivee: arrivee },
          { villeDepart: arrivee, villeArrivee: depart },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Cette ligne (ou sa version inverse) existe déjà', existingId: existing.id },
        { status: 409 }
      );
    }

    const ligne = await db.ligne.create({
      data: {
        villeDepart: depart,
        villeArrivee: arrivee,
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
