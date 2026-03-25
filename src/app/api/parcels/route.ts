import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateTrackingNumber, generateQRData, PLATFORM_COMMISSION, DEFAULT_RELAY_COMMISSION } from '@/lib/constants';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { requireRole, verifyJWT } from '@/lib/rbac';
import { generateQRCodeImage, buildQRCodePayload } from '@/lib/qrcode';
import { createHash } from 'crypto';

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '').replace(/[^+\d]/g, '');
}

function hashWithdrawalCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateWithdrawalCode(length: 4 | 6 = 6): string {
  const min = length === 4 ? 1000 : 100000;
  const max = length === 4 ? 9999 : 999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

// GET all parcels
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const tracking = searchParams.get('tracking');
    const available = searchParams.get('available'); // "true" = show available for transport

    // Public tracking lookup: limited data only
    if (tracking && !clientId && !status && available !== 'true') {
      const parcels = await db.colis.findMany({
        where: { trackingNumber: tracking },
        select: {
          id: true,
          trackingNumber: true,
          villeDepart: true,
          villeArrivee: true,
          format: true,
          status: true,
          createdAt: true,
          relaisDepart: {
            select: { commerceName: true },
          },
          relaisArrivee: {
            select: { commerceName: true },
          },
          trackingHistory: {
            select: { status: true, notes: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(parcels);
    }

    const auth = await requireRole(request, ['CLIENT', 'RELAIS', 'TRANSPORTER', 'ADMIN']);
    if (!auth.success) return auth.response;
    const { payload } = auth;

    const where: Record<string, unknown> = {};

    if (clientId) {
      if (payload.role === 'CLIENT' && clientId !== payload.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.clientId = clientId;
    } else if (payload.role === 'CLIENT') {
      where.clientId = payload.id;
    }
    if (status) {
      where.status = status;
    } else if (available === 'true') {
      // Show parcels available for transport: deposited at relay (new + legacy statuses)
      where.status = { in: ['DEPOSITED_RELAY', 'RECU_RELAIS', 'PAID_RELAY'] };
      // Only parcels without an active mission
      where.missions = { none: { status: { in: ['ASSIGNE', 'PICKED_UP'] } } };
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
  const auth = await requireRole(request, ['CLIENT', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { payload } = auth;

  // Rate limit: 30 requests per minute per user
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
      senderFirstName,
      senderLastName,
      senderPhone,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      withdrawalCode,
      relaisDepartId,
      relaisArriveeId,
      villeDepart,
      villeArrivee,
      format,
      weight,
      description,
    } = body;

    if (payload.role === 'CLIENT' && clientId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (
      !senderFirstName?.trim() ||
      !senderLastName?.trim() ||
      !senderPhone?.trim() ||
      !recipientFirstName?.trim() ||
      !recipientLastName?.trim() ||
      !recipientPhone?.trim()
    ) {
      return NextResponse.json(
        { error: 'Informations expéditeur/destinataire incomplètes' },
        { status: 400 }
      );
    }

    const normalizedSenderPhone = normalizePhone(senderPhone);
    const normalizedRecipientPhone = normalizePhone(recipientPhone);
    if (normalizedSenderPhone.length < 8 || normalizedRecipientPhone.length < 8) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide' },
        { status: 400 }
      );
    }

    // Check if relais are operational
    const [relaisDepart, relaisArrivee] = await Promise.all([
      db.relais.findUnique({ where: { id: relaisDepartId }, select: { operationalStatus: true, suspensionReason: true } }),
      db.relais.findUnique({ where: { id: relaisArriveeId }, select: { operationalStatus: true, suspensionReason: true } }),
    ]);

    if (!relaisDepart || relaisDepart.operationalStatus === 'SUSPENDU') {
      return NextResponse.json(
        { 
          error: 'Relais de départ suspendu', 
          details: relaisDepart?.suspensionReason || 'Raison non spécifiée'
        },
        { status: 400 }
      );
    }

    if (!relaisArrivee || relaisArrivee.operationalStatus === 'SUSPENDU') {
      return NextResponse.json(
        { 
          error: 'Relais d\'arrivée suspendu', 
          details: relaisArrivee?.suspensionReason || 'Raison non spécifiée'
        },
        { status: 400 }
      );
    }

    const effectiveWithdrawalCode = String(withdrawalCode ?? generateWithdrawalCode(6));
    if (!/^\d{4}$|^\d{6}$/.test(effectiveWithdrawalCode)) {
      return NextResponse.json(
        { error: 'Le code de retrait doit contenir 4 ou 6 chiffres' },
        { status: 400 }
      );
    }

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
    const qrPayload = buildQRCodePayload(trackingNumber);
    const qrCodeImage = await generateQRCodeImage(qrPayload);

    // Create parcel
    const colis = await db.colis.create({
      data: {
        trackingNumber,
        clientId,
        senderFirstName: senderFirstName.trim(),
        senderLastName: senderLastName.trim(),
        senderPhone: normalizedSenderPhone,
        recipientFirstName: recipientFirstName.trim(),
        recipientLastName: recipientLastName.trim(),
        recipientPhone: normalizedRecipientPhone,
        withdrawalCodeHash: hashWithdrawalCode(effectiveWithdrawalCode),
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
        qrCodeImage,
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

    return NextResponse.json({
      ...colis,
      withdrawalCode: effectiveWithdrawalCode,
    });
  } catch (error) {
    console.error('Error creating parcel:', error);
    return NextResponse.json({ error: 'Failed to create parcel' }, { status: 500 });
  }
}
