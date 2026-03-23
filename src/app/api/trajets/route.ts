import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function parseVillesEtapes(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
      if (typeof parsed === 'string') {
        return parsed.split(',').map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      // Not JSON, fallback to CSV
    }

    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function normalizeTrajet<T extends { villesEtapes?: unknown }>(trajet: T): T & { villesEtapes: string[] } {
  return {
    ...trajet,
    villesEtapes: parseVillesEtapes(trajet.villesEtapes),
  };
}

function serializeVillesEtapes(value: unknown): string | null {
  const normalized = parseVillesEtapes(value);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

// GET all trajets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transporteurId = searchParams.get('transporteurId');
    const status = searchParams.get('status');

    let where: any = {};
    if (transporteurId) where.transporteurId = transporteurId;
    if (status) where.status = status;

    const trajets = await db.trajet.findMany({
      where,
      include: {
        transporteur: { select: { id: true, name: true, phone: true, email: true } },
        missions: {
          include: {
            colis: {
              include: {
                client: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { dateDepart: 'asc' },
    });

    return NextResponse.json(trajets.map(normalizeTrajet));
  } catch (error) {
    console.error('Error fetching trajets:', error);
    return NextResponse.json({ error: 'Failed to fetch trajets' }, { status: 500 });
  }
}

// POST create trajet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transporteurId, villeDepart, villeArrivee, villesEtapes, dateDepart, placesColis } = body;

    const trajet = await db.trajet.create({
      data: {
        transporteurId,
        villeDepart,
        villeArrivee,
        villesEtapes: serializeVillesEtapes(villesEtapes),
        dateDepart: new Date(dateDepart),
        placesColis: placesColis || 10,
        status: 'PROGRAMME',
      },
    });

    return NextResponse.json(normalizeTrajet(trajet));
  } catch (error) {
    console.error('Error creating trajet:', error);
    return NextResponse.json({ error: 'Failed to create trajet' }, { status: 500 });
  }
}
