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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trajet = await db.trajet.findUnique({
      where: { id },
      include: {
        transporteur: true,
        missions: {
          include: {
            colis: {
              include: {
                client: true,
                relaisDepart: true,
                relaisArrivee: true,
              },
            },
          },
        },
      },
    });

    if (!trajet) {
      return NextResponse.json({ error: 'Trajet not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeTrajet(trajet));
  } catch (error) {
    console.error('Fetch trajet error:', error);
    return NextResponse.json({ error: 'Failed to fetch trajet' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, placesUtilisees, villesEtapes } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (placesUtilisees !== undefined) updateData.placesUtilisees = placesUtilisees;
    if (villesEtapes !== undefined) updateData.villesEtapes = serializeVillesEtapes(villesEtapes);

    const trajet = await db.trajet.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(normalizeTrajet(trajet));
  } catch (error) {
    console.error('Update trajet error:', error);
    return NextResponse.json({ error: 'Failed to update trajet' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if there are active missions
    const missions = await db.mission.findMany({
      where: { trajetId: id },
    });

    if (missions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete trajet with active missions' },
        { status: 400 }
      );
    }

    await db.trajet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete trajet error:', error);
    return NextResponse.json({ error: 'Failed to delete trajet' }, { status: 500 });
  }
}
