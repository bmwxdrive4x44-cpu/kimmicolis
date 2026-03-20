import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
        placesColis: { gt: db.trajet.fields.placesUtilisees },
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

    // Score and rank matches
    const scoredMatches = matchingTrajets.map((trajet) => {
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

    return NextResponse.json(scoredMatches);
  } catch (error) {
    console.error('Error matching trajets:', error);
    return NextResponse.json({ error: 'Failed to match trajets' }, { status: 500 });
  }
}
