import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PLATFORM_COMMISSION, DEFAULT_RELAY_COMMISSION } from '@/lib/constants';

/**
 * POST /api/parcels/calculate-price
 * Calculate the price for a parcel based on route and format.
 * Used by the client dashboard before creating a parcel.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { villeDepart, villeArrivee, format } = body;

    if (!villeDepart || !villeArrivee || !format) {
      return NextResponse.json(
        { error: 'Missing required fields: villeDepart, villeArrivee, format' },
        { status: 400 }
      );
    }

    // Find the tariff for this route
    const ligne = await db.ligne.findFirst({
      where: {
        OR: [
          { villeDepart, villeArrivee },
          { villeDepart: villeArrivee, villeArrivee: villeDepart },
        ],
        isActive: true,
      },
    });

    let baseTariff = 400; // default
    if (ligne) {
      baseTariff =
        format === 'PETIT'
          ? ligne.tarifPetit
          : format === 'MOYEN'
          ? ligne.tarifMoyen
          : ligne.tarifGros;
    }

    const platformFee = baseTariff * PLATFORM_COMMISSION;
    const relayFee =
      DEFAULT_RELAY_COMMISSION[format as keyof typeof DEFAULT_RELAY_COMMISSION] || 100;
    const prixClient = baseTariff + platformFee + relayFee;
    const netTransporteur = baseTariff - platformFee - relayFee;

    return NextResponse.json({
      baseTariff,
      platformFee,
      relayFee,
      prixClient,
      netTransporteur,
      ligneId: ligne?.id ?? null,
      hasLine: !!ligne,
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    return NextResponse.json({ error: 'Failed to calculate price' }, { status: 500 });
  }
}
