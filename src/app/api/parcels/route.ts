import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateTrackingNumber, generateQRData, PLATFORM_COMMISSION, DEFAULT_RELAY_COMMISSION } from '@/lib/constants';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { verifyJWT } from '@/lib/rbac';

// GET all parcels
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const tracking = searchParams.get('tracking');

    let where: any = {};

    if (clientId) {
      where.clientId = clientId;
    }
    if (status) {
      where.status = status;
    }
    if (tracking) {
      where.trackingNumber = tracking;
    }

    const parcels = await db.colis.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
        relaisDepart: {
          include: { user: { select: { name: true, phone: true } } },
        },
        relaisArrivee: {
          include: { user: { select: { name: true, phone: true } } },
        },
        missions: {
          include: {
            transporteur: { select: { id: true, name: true, phone: true } },
          },
        },
        trackingHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(parcels);
  } catch (error) {
    console.error('Error fetching parcels:', error);
    return NextResponse.json({ error: 'Failed to fetch parcels' }, { status: 500 });
  }
}

// POST create parcel
export async function POST(request: NextRequest) {
  // Rate limit: 30 requests per minute per user
  const { payload } = await verifyJWT(request);
  const rateLimitResult = await checkRateLimit(
    request,
    RATE_LIMIT_PRESETS.moderate,
    payload?.id
  );

  if (rateLimitResult.limited) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please slow down.',
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const {
      clientId,
      relaisDepartId,
      relaisArriveeId,
      villeDepart,
      villeArrivee,
      format,
      weight,
      description,
    } = body;

    // Get line tariff
    const ligne = await db.ligne.findFirst({
      where: {
        OR: [
          { villeDepart, villeArrivee },
          { villeDepart: villeArrivee, villeArrivee: villeDepart },
        ],
      },
    });

    // Calculate prices
    let baseTariff = 400;
    if (ligne) {
      baseTariff = format === 'PETIT' ? ligne.tarifPetit : format === 'MOYEN' ? ligne.tarifMoyen : ligne.tarifGros;
    }

    const platformFee = baseTariff * PLATFORM_COMMISSION;
    const relayFee = DEFAULT_RELAY_COMMISSION[format as keyof typeof DEFAULT_RELAY_COMMISSION] || 100;
    const prixClient = baseTariff + platformFee + relayFee;
    const netTransporteur = baseTariff - platformFee - relayFee;

    // Generate tracking number and QR code
    const trackingNumber = generateTrackingNumber();
    const qrCode = generateQRData(trackingNumber);

    // Create parcel
    const colis = await db.colis.create({
      data: {
        trackingNumber,
        clientId,
        relaisDepartId,
        relaisArriveeId,
        villeDepart,
        villeArrivee,
        format,
        weight,
        description,
        prixClient,
        commissionPlateforme: platformFee,
        commissionRelais: relayFee,
        netTransporteur,
        qrCode,
        status: 'CREATED',
        dateLimit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Create tracking history
    await db.trackingHistory.create({
      data: {
        colisId: colis.id,
        status: 'CREATED',
        location: villeDepart,
        notes: 'Colis créé',
      },
    });

    return NextResponse.json(colis);
  } catch (error) {
    console.error('Error creating parcel:', error);
    return NextResponse.json({ error: 'Failed to create parcel' }, { status: 500 });
  }
}
