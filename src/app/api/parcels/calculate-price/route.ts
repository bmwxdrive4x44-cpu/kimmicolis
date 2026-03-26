import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateDynamicParcelPricing, estimateDistanceKmByWilayas } from '@/lib/pricing';

/**
 * POST /api/parcels/calculate-price
 * Calculate the price for a parcel based on route and weight.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { villeDepart, villeArrivee, weight } = body;

    if (!villeDepart || !villeArrivee || weight === undefined || weight === null) {
      return NextResponse.json(
        { error: 'Missing required fields: villeDepart, villeArrivee, weight' },
        { status: 400 }
      );
    }

    const parsedWeight = Number(weight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      return NextResponse.json({ error: 'weight must be a positive number' }, { status: 400 });
    }

    const settings = await db.setting.findMany({
      where: {
        key: {
          in: [
            'pricingAdminFee',
            'pricingRatePerKg',
            'pricingRatePerKm',
            'pricingRelayDepartureRate',
            'pricingRelayArrivalRate',
            'pricingRoundTo',
          ],
        },
      },
    });

    const config = new Map(settings.map((setting) => [setting.key, setting.value]));
    const getNumber = (key: string, fallback: number) => {
      const value = Number(config.get(key));
      return Number.isFinite(value) ? value : fallback;
    };

    const estimatedDistanceKm = estimateDistanceKmByWilayas(villeDepart, villeArrivee);
    const pricing = calculateDynamicParcelPricing({
      weightKg: parsedWeight,
      distanceKm: estimatedDistanceKm,
      adminFee: getNumber('pricingAdminFee', 50),
      ratePerKg: getNumber('pricingRatePerKg', 120),
      ratePerKm: getNumber('pricingRatePerKm', 2.5),
      relayDepartureCommissionRate: getNumber('pricingRelayDepartureRate', 0.1),
      relayArrivalCommissionRate: getNumber('pricingRelayArrivalRate', 0.1),
      roundTo: getNumber('pricingRoundTo', 10),
    });

    return NextResponse.json({
      ...pricing,
      estimatedDistanceKm,
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    return NextResponse.json({ error: 'Failed to calculate price' }, { status: 500 });
  }
}
