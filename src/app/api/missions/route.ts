import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { createNotificationDedup } from '@/lib/notifications';

function parseVillesEtapes(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];

  const raw = value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // fallback CSV
  }

  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function trajetSupportsParcel(trajet: {
  villeDepart: string;
  villeArrivee: string;
  villesEtapes?: unknown;
}, parcel: {
  villeDepart: string;
  villeArrivee: string;
}) {
  const itinerary = [trajet.villeDepart, ...parseVillesEtapes(trajet.villesEtapes), trajet.villeArrivee];
  const depIndex = itinerary.indexOf(parcel.villeDepart);
  const arrIndex = itinerary.indexOf(parcel.villeArrivee);
  return depIndex >= 0 && arrIndex > depIndex;
}

// GET missions
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const transporteurId = searchParams.get('transporteurId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (transporteurId) where.transporteurId = transporteurId;
    if (status) where.status = status;

    const missions = await db.mission.findMany({
      where,
      include: {
        colis: {
          include: {
            client: { select: { name: true, phone: true } },
            relaisDepart: { select: { commerceName: true, ville: true, address: true } },
            relaisArrivee: { select: { commerceName: true, ville: true, address: true } },
          },
        },
        transporteur: { select: { name: true, phone: true } },
        trajet: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(missions);
  } catch (error) {
    console.error('Error fetching missions:', error);
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 });
  }
}

// POST create / accept mission
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisId, transporteurId, trajetId } = body;

    if (!colisId || !transporteurId) {
      return NextResponse.json({ error: 'colisId and transporteurId are required' }, { status: 400 });
    }

    // Verify parcel is in DEPOSITED_RELAY status (strict workflow)
    const parcel = await db.colis.findUnique({ where: { id: colisId } });
    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }
    // Accept both new and legacy statuses for backward compatibility
    const acceptableStatuses = ['DEPOSITED_RELAY', 'WAITING_PICKUP', 'READY_FOR_DEPOSIT', 'RECU_RELAIS', 'PAID_RELAY', 'PAID'];
    if (!acceptableStatuses.includes(parcel.status)) {
      return NextResponse.json(
        { error: `Impossible d'assigner un transporteur à un colis avec le statut: ${parcel.status}` },
        { status: 400 }
      );
    }

    let trajet: {
      id: string;
      transporteurId: string;
      lineId: string | null;
      villeDepart: string;
      villeArrivee: string;
      villesEtapes: string | null;
      status: string;
      placesColis: number;
      placesUtilisees: number;
      dateDepart: Date;
    } | null = null;

    if (trajetId) {
      trajet = await db.trajet.findUnique({
        where: { id: trajetId },
        select: {
          id: true,
          transporteurId: true,
          lineId: true,
          villeDepart: true,
          villeArrivee: true,
          villesEtapes: true,
          status: true,
          placesColis: true,
          placesUtilisees: true,
          dateDepart: true,
        },
      });

      if (!trajet) {
        return NextResponse.json({ error: 'Trajet introuvable' }, { status: 404 });
      }

      if (trajet.transporteurId !== transporteurId) {
        return NextResponse.json({ error: 'Le trajet sélectionné n’appartient pas à ce transporteur' }, { status: 400 });
      }

      if (trajet.status !== 'PROGRAMME' || trajet.dateDepart < new Date()) {
        return NextResponse.json({ error: 'Le trajet sélectionné n’est plus disponible' }, { status: 400 });
      }

      if (trajet.placesUtilisees >= trajet.placesColis) {
        return NextResponse.json({ error: 'Le trajet sélectionné est complet' }, { status: 400 });
      }

      if (parcel.lineId && trajet.lineId && parcel.lineId !== trajet.lineId) {
        return NextResponse.json({ error: 'Le trajet sélectionné ne correspond pas à la ligne du colis' }, { status: 400 });
      }

      if (!trajetSupportsParcel(trajet, parcel)) {
        return NextResponse.json({ error: 'Le trajet sélectionné ne couvre pas l’itinéraire du colis' }, { status: 400 });
      }
    }

    // Create mission
    const mission = await db.mission.create({
      data: {
        colisId,
        transporteurId,
        trajetId,
        status: 'ASSIGNE',
      },
    });

    // Update parcel status to WAITING_PICKUP (assigned to transporter but not yet collected)
    await db.colis.update({
      where: { id: colisId },
      data: { status: 'WAITING_PICKUP' },
    });

    // Add tracking history
    await db.trackingHistory.create({
      data: {
        colisId,
        status: 'WAITING_PICKUP',
        notes: 'Transporteur assigné au colis — en attente de collecte au relais',
      },
    });

    // Update trajet capacity if provided
    if (trajetId) {
      await db.trajet.update({
        where: { id: trajetId },
        data: { placesUtilisees: { increment: 1 } },
      });
    }

    // Notify client
    await createNotificationDedup({
      userId: parcel.clientId,
      title: 'Transporteur assigné',
      message: `Un transporteur a été assigné à votre colis ${parcel.trackingNumber}`,
      type: 'IN_APP',
    });

    return NextResponse.json(mission);
  } catch (error) {
    console.error('Error creating mission:', error);
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
  }
}
