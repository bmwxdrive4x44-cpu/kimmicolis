import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { matchColisToTrajets } from '@/services/matchingService';
import { requireRole } from '@/lib/rbac';

// GET matching trajets for a parcel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const colisId = searchParams.get('colisId');
    const villeDepart = searchParams.get('villeDepart');
    const villeArrivee = searchParams.get('villeArrivee');

    if (!colisId && (!villeDepart || !villeArrivee)) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let departure = villeDepart;
    let arrival = villeArrivee;

    // Get parcel details if colisId provided
    if (colisId) {
      const parcel = await db.colis.findUnique({
        where: { id: colisId },
        select: { villeDepart: true, villeArrivee: true },
      });
      if (parcel) {
        departure = parcel.villeDepart;
        arrival = parcel.villeArrivee;
      }
    }

    if (!departure || !arrival) {
      return NextResponse.json([]);
    }

    // Find matching trajets
    const matchingTrajets = await db.trajet.findMany({
      where: {
        status: 'PROGRAMME',
        dateDepart: { gte: new Date() },
        OR: [
          // Direct route
          {
            AND: [
              { villeDepart: departure },
              { villeArrivee: arrival },
            ],
          },
          // Departure matches, arrival is on route
          {
            AND: [
              { villeDepart: departure },
              { villesEtapes: { contains: arrival } },
            ],
          },
          // Departure is on route, arrival matches
          {
            AND: [
              { villesEtapes: { contains: departure } },
              { villeArrivee: arrival },
            ],
          },
          // Both are on route
          {
            villesEtapes: { contains: departure },
          },
        ],
      },
      include: {
        transporteur: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { dateDepart: 'asc' },
    });

    // Score and rank matches, filtering out full trajets
    const scoredMatches = matchingTrajets
      .filter((trajet) => trajet.placesColis > trajet.placesUtilisees)
      .map((trajet) => {
        let score = 0;
        
        // Direct route gets highest score
        if (trajet.villeDepart === departure && trajet.villeArrivee === arrival) {
          score = 100;
        }
        // Departure matches
        else if (trajet.villeDepart === departure) {
          score = 80;
        }
        // Arrival matches
        else if (trajet.villeArrivee === arrival) {
          score = 70;
        }
        // Both on route
        else {
          score = 50;
        }

        // Bonus for available capacity
        const availableCapacity = trajet.placesColis - trajet.placesUtilisees;
        score += Math.min(availableCapacity * 2, 20);

        return { ...trajet, score };
      });

    // Sort by score
    scoredMatches.sort((a, b) => b.score - a.score);

    // Expose capaciteRestante on each result
    const enriched = scoredMatches.map((t) => ({
      ...t,
      capaciteRestante: t.placesColis - t.placesUtilisees,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Error matching trajets:', error);
    return NextResponse.json({ error: 'Failed to match trajets' }, { status: 500 });
  }
}

// POST /api/matching
// Déclenche le matching automatique d'un colis : trouve le meilleur trajet,
// crée la mission, décrémente la capacité et met à jour le statut du colis.
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisId } = body;

    if (!colisId) {
      return NextResponse.json({ error: 'colisId est requis' }, { status: 400 });
    }

    // Charger le colis
    const colis = await db.colis.findUnique({
      where: { id: colisId },
      select: { id: true, villeDepart: true, villeArrivee: true, clientId: true, status: true },
    });

    if (!colis) {
      return NextResponse.json({ error: 'Colis non trouvé' }, { status: 404 });
    }

    // Guard: un CLIENT ne peut matcher que ses propres colis
    if (auth.payload.role === 'CLIENT' && colis.clientId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await matchColisToTrajets(colis);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json(result.match, { status: 201 });
  } catch (error) {
    console.error('Error auto-matching colis:', error);
    return NextResponse.json({ error: 'Erreur lors du matching automatique' }, { status: 500 });
  }
}
