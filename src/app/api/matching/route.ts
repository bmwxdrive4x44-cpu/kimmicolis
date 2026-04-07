import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoAssignUnmatchedColis, getRankedTrajetsForRoute, matchColisToTrajets } from '@/services/matchingService';
import { autoAssignWithPreferences } from '@/services/intelligent-matching-service';
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

    const rankedTrajets = await getRankedTrajetsForRoute({
      villeDepart: departure,
      villeArrivee: arrival,
    });

    return NextResponse.json(rankedTrajets);
  } catch (error) {
    console.error('Error matching trajets:', error);
    return NextResponse.json({ error: 'Failed to match trajets' }, { status: 500 });
  }
}

// POST /api/matching
// Déclenche le matching automatique d'un colis : trouve le meilleur trajet,
// crée la mission, décrémente la capacité et met à jour le statut du colis.
// Options:
// - usePreferences: boolean - Utiliser intelligent matching avec préférences transporteur
// - autoAssignUnmatched: boolean - Mode batch pour les colis non assignés
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'ENSEIGNE', 'RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { colisId, autoAssignUnmatched = false, usePreferences = false, limit = 50 } = body;

    if (autoAssignUnmatched === true) {
      if (auth.payload.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }

      const result = await autoAssignUnmatchedColis(Number(limit));
      return NextResponse.json({
        success: true,
        message: 'Traitement automatique des colis non assignés terminé',
        ...result,
      });
    }

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
    if ((auth.payload.role === 'CLIENT' || auth.payload.role === 'ENSEIGNE') && colis.clientId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Utiliser intelligent matching si demandé
    if (usePreferences) {
      const result = await autoAssignWithPreferences(colisId);
      if (result.success) {
        const mission = await db.mission.findFirst({
          where: { colisId },
        });
        return NextResponse.json(
          {
            success: true,
            message: 'Matché avec préférences du transporteur',
            mission,
            score: result.score,
          },
          { status: 201 }
        );
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 422 }
        );
      }
    }

    // Matching classique
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
