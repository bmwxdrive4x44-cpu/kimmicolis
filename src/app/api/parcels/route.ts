import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateTrackingNumber } from '@/lib/constants';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { requireRole, verifyJWT } from '@/lib/rbac';
import { generateQRCodeImage } from '@/lib/qrcode';
import { calculateDynamicParcelPricing, estimateSafeDistanceKmByWilayas } from '@/lib/pricing';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';
import { getImplicitLoyaltyConfig } from '@/lib/loyalty-config';
import { createHash, randomBytes } from 'crypto';
import { findActiveLineByCities } from '@/lib/logistics';
import { generateWithdrawalPin, calculateQRExpiration } from '@/lib/qr-security';
import { checkRelayTrialQuota } from '@/lib/relais-trial';

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '').replace(/[^+\d]/g, '');
}

function normalizeOptionalEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function hashWithdrawalCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateWithdrawalCode(length: 4 | 6 = 6): string {
  const min = length === 4 ? 1000 : 100000;
  const max = length === 4 ? 9999 : 999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

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

function trajetSupportsParcel(
  trajet: { villeDepart: string; villeArrivee: string; villesEtapes?: unknown },
  parcel: { villeDepart: string; villeArrivee: string }
) {
  const itinerary = [trajet.villeDepart, ...parseVillesEtapes(trajet.villesEtapes), trajet.villeArrivee];
  const depIndex = itinerary.indexOf(parcel.villeDepart);
  const arrIndex = itinerary.indexOf(parcel.villeArrivee);
  return depIndex >= 0 && arrIndex > depIndex;
}

function isRelayVisibleToExternal(relay: { status?: string | null; operationalStatus?: string | null } | null | undefined) {
  return Boolean(relay && relay.status === 'APPROVED' && relay.operationalStatus !== 'SUSPENDU');
}

function sanitizeRelayForExternal<T>(relay: T & { status?: string | null; operationalStatus?: string | null } | null | undefined) {
  if (!relay) return null;
  return isRelayVisibleToExternal(relay) ? relay : null;
}

function sanitizeParcelRelaysForExternal<T extends { relaisDepart?: any; relaisArrivee?: any }>(parcel: T): T {
  return {
    ...parcel,
    relaisDepart: sanitizeRelayForExternal(parcel.relaisDepart),
    relaisArrivee: sanitizeRelayForExternal(parcel.relaisArrivee),
  };
}

async function getPricingConfig() {
  const keys = [
    'pricingAdminFee',
    'pricingRatePerKg',
    'pricingRatePerKm',
    'pricingRelayDepartureRate',
    'pricingRelayArrivalRate',
    'pricingRelayPrintFee',
    'pricingRoundTo',
    'platformCommission',
  ];

  const settings = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const getNumber = (key: string, fallback: number) => {
    const value = Number(map.get(key));
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    adminFee: getNumber('pricingAdminFee', 50),
    ratePerKg: getNumber('pricingRatePerKg', 120),
    ratePerKm: getNumber('pricingRatePerKm', 2.5),
    relayDepartureRate: getNumber('pricingRelayDepartureRate', 0.1),
    relayArrivalRate: getNumber('pricingRelayArrivalRate', 0.1),
    relayPrintFee: getNumber('pricingRelayPrintFee', 30),
    roundTo: getNumber('pricingRoundTo', 10),
    platformCommissionRate: getNumber('platformCommission', 10) / 100,
  };
}

// GET all parcels
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const available = searchParams.get('available'); // "true" = show available for transport
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');
  const tracking = searchParams.get('tracking');

  try {
    // Public tracking lookup: limited data only
    if (tracking && !clientId && !status && available !== 'true') {
      const parcels = await db.colis.findMany({
        where: { trackingNumber: tracking },
        select: {
          id: true,
          trackingNumber: true,
          villeDepart: true,
          villeArrivee: true,
          weight: true,
          status: true,
          createdAt: true,
          relaisDepart: {
            select: { commerceName: true, status: true, operationalStatus: true },
          },
          relaisArrivee: {
            select: { commerceName: true, status: true, operationalStatus: true },
          },
          trackingHistory: {
            select: { status: true, notes: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(parcels.map((parcel) => sanitizeParcelRelaysForExternal(parcel)));
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
      where.status = { in: ['DEPOSITED_RELAY', 'WAITING_PICKUP', 'READY_FOR_DEPOSIT', 'RECU_RELAIS', 'PAID_RELAY'] };
      // Only parcels without an active mission
      where.missions = { none: { status: { in: ['ASSIGNE', 'PICKED_UP'] } } };
      where.lineId = { not: null };
      where.relaisDepart = { is: { status: 'APPROVED', operationalStatus: 'ACTIF' } };
      where.relaisArrivee = { is: { status: 'APPROVED', operationalStatus: 'ACTIF' } };
    }
    if (tracking) {
      where.trackingNumber = tracking;
    }

    let parcels: any[] = [];
    try {
      parcels = await db.colis.findMany({
        where,
        include: {
          line: true,
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
      }) as any[];
    } catch (queryError) {
      console.warn('[api/parcels] full query failed, using compatibility fallback:', queryError);
      parcels = await db.colis.findMany({
        where,
        select: {
          id: true,
          trackingNumber: true,
          clientId: true,
          relaisDepartId: true,
          relaisArriveeId: true,
          villeDepart: true,
          villeArrivee: true,
          weight: true,
          description: true,
          status: true,
          prixClient: true,
          createdAt: true,
          dateLimit: true,
          qrCodeImage: true,
          recipientFirstName: true,
          recipientLastName: true,
          recipientPhone: true,
          recipientEmail: true,
          relaisDepart: {
            select: {
              id: true,
              commerceName: true,
              address: true,
              ville: true,
              status: true,
              operationalStatus: true,
              user: { select: { name: true, phone: true } },
            },
          },
          relaisArrivee: {
            select: {
              id: true,
              commerceName: true,
              address: true,
              ville: true,
              status: true,
              operationalStatus: true,
              user: { select: { name: true, phone: true } },
            },
          },
          trackingHistory: {
            select: {
              id: true,
              status: true,
              notes: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }) as any[];
    }

    const parcelsForExternalRoles = payload.role === 'CLIENT' || payload.role === 'TRANSPORTER'
      ? parcels.map((parcel) => sanitizeParcelRelaysForExternal(parcel))
      : parcels;

    if (available === 'true' && payload.role === 'TRANSPORTER') {
      const futureTrajets = await db.trajet.findMany({
        where: {
          transporteurId: payload.id,
          status: 'PROGRAMME',
          dateDepart: { gte: new Date() },
        },
        select: { lineId: true, villeDepart: true, villeArrivee: true, villesEtapes: true },
      });

      return NextResponse.json(
        parcelsForExternalRoles.filter((parcel) =>
          futureTrajets.some((trajet) => {
            if (parcel.lineId && trajet.lineId && parcel.lineId !== trajet.lineId) {
              return false;
            }

            return trajetSupportsParcel(trajet, parcel);
          })
        )
      );
    }

    return NextResponse.json(parcelsForExternalRoles);
  } catch (error) {
    console.error('Error fetching parcels:', error);

    // Keep a stable array shape for client-scoped list requests.
    if (available === 'true' || Boolean(clientId)) {
      return NextResponse.json([]);
    }

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

  let errorStep = 'INIT';
  try {
    errorStep = 'PARSE_BODY';
    const body = await request.json();
    const {
      clientId,
      senderFirstName,
      senderLastName,
      senderPhone,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      recipientEmail,
      labelPrintMode,
      withdrawalCode,
      relaisDepartId,
      relaisArriveeId,
      villeDepart,
      villeArrivee,
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

    const normalizedRecipientEmail = normalizeOptionalEmail(recipientEmail);
    if (normalizedRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipientEmail)) {
      return NextResponse.json(
        { error: 'Email destinataire invalide' },
        { status: 400 }
      );
    }

    const parsedWeight = Number(weight ?? 0);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      return NextResponse.json(
        { error: 'Le poids du colis est obligatoire et doit être supérieur à 0 kg' },
        { status: 400 }
      );
    }

    errorStep = 'RELAIS_VALIDATE';
    // Check if relais are operational (with compatibility fallback for older schemas)
    let relaisDepart: any;
    let relaisArrivee: any;
    try {
      [relaisDepart, relaisArrivee] = await Promise.all([
        db.relais.findUnique({ where: { id: relaisDepartId }, select: { ville: true, status: true, operationalStatus: true, suspensionReason: true } }),
        db.relais.findUnique({ where: { id: relaisArriveeId }, select: { ville: true, status: true, operationalStatus: true, suspensionReason: true } }),
      ]);
    } catch (relayQueryError) {
      console.warn('[api/parcels] relay operational select failed, retrying with minimal select:', relayQueryError);
      [relaisDepart, relaisArrivee] = await Promise.all([
        db.relais.findUnique({ where: { id: relaisDepartId }, select: { ville: true, status: true } }),
        db.relais.findUnique({ where: { id: relaisArriveeId }, select: { ville: true, status: true } }),
      ]);
    }

    if (!relaisDepart || relaisDepart.status !== 'APPROVED' || relaisDepart.operationalStatus === 'SUSPENDU') {
      return NextResponse.json(
        { 
          error: 'Relais de départ suspendu', 
          details: relaisDepart?.suspensionReason || 'Raison non spécifiée'
        },
        { status: 400 }
      );
    }

    if (!relaisArrivee || relaisArrivee.status !== 'APPROVED' || relaisArrivee.operationalStatus === 'SUSPENDU') {
      return NextResponse.json(
        { 
          error: 'Relais d\'arrivée suspendu', 
          details: relaisArrivee?.suspensionReason || 'Raison non spécifiée'
        },
        { status: 400 }
      );
    }

    errorStep = 'TRIAL_QUOTA';
    let trialQuota: { limited: boolean; maxPerDay?: number } = { limited: false };
    try {
      trialQuota = await checkRelayTrialQuota({
        relaisId: relaisDepartId,
        additionalParcels: 1,
      });
    } catch (trialQuotaError) {
      console.warn('[api/parcels] relay trial quota check failed, bypassing quota gate:', trialQuotaError);
    }
    if (trialQuota.limited) {
      return NextResponse.json(
        {
          error: 'Relais en période d\'essai: quota quotidien atteint',
          details: `Maximum ${trialQuota.maxPerDay} colis/jour pendant l'essai`,
        },
        { status: 400 }
      );
    }

    if (relaisDepart.ville !== villeDepart || relaisArrivee.ville !== villeArrivee) {
      return NextResponse.json(
        { error: 'Les relais sélectionnés ne correspondent pas aux villes choisies' },
        { status: 400 }
      );
    }

    errorStep = 'ACTIVE_LINE';
    const activeLine = await findActiveLineByCities(villeDepart, villeArrivee);
    if (!activeLine) {
      return NextResponse.json(
        { error: 'Aucune ligne active n\'est disponible pour cet itinéraire' },
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

    const normalizedLabelPrintMode = String(labelPrintMode || 'HOME').toUpperCase();
    if (!['HOME', 'RELAY'].includes(normalizedLabelPrintMode)) {
      return NextResponse.json(
        { error: 'Mode impression invalide (HOME ou RELAY)' },
        { status: 400 }
      );
    }

    errorStep = 'PRICING';
    // Calculate prices: distance auto-estimated from departure/arrival wilayas
    const estimatedDistanceKm = estimateSafeDistanceKmByWilayas(villeDepart, villeArrivee);
    const pricingConfig = await getPricingConfig();
    const dynamic = calculateDynamicParcelPricing({
      weightKg: parsedWeight,
      distanceKm: estimatedDistanceKm,
      adminFee: pricingConfig.adminFee,
      ratePerKg: pricingConfig.ratePerKg,
      ratePerKm: pricingConfig.ratePerKm,
      formatMultiplier: 1,
      relayDepartureCommissionRate: pricingConfig.relayDepartureRate,
      relayArrivalCommissionRate: pricingConfig.relayArrivalRate,
      platformMarginRate: pricingConfig.platformCommissionRate,
      roundTo: pricingConfig.roundTo,
    });

    const relayPrintFee = normalizedLabelPrintMode === 'RELAY' ? pricingConfig.relayPrintFee : 0;
    const baseClientPriceWithPrint = dynamic.clientPrice + relayPrintFee;
    let eligibility = { eligible: false };
    let loyaltyConfig = { discountRate: 0 };
    try {
      eligibility = await evaluateImplicitProEligibility(clientId);
      loyaltyConfig = await getImplicitLoyaltyConfig();
    } catch (loyaltyError) {
      console.warn('[api/parcels] implicit-pro eligibility unavailable, continuing without discount:', loyaltyError);
    }
    const implicitDiscountRate = eligibility.eligible ? loyaltyConfig.discountRate : 0;
    const implicitDiscountAmount = Math.round(baseClientPriceWithPrint * implicitDiscountRate);
    const prixClient = baseClientPriceWithPrint - implicitDiscountAmount;
    const netTransporteur = dynamic.netTransporteur;
    const relayFee = dynamic.relayCommissionTotal + relayPrintFee;
    const platformFee = dynamic.platformMargin;
    const pricingBreakdown: Record<string, unknown> = {
      model: 'dynamic',
      ...dynamic,
      estimatedDistanceKm,
      labelPrintMode: normalizedLabelPrintMode,
      relayPrintFee,
      baseClientPrice: dynamic.clientPrice,
      baseClientPriceWithPrint,
      implicitProEligible: eligibility.eligible,
      implicitProDiscountRate: implicitDiscountRate,
      implicitProDiscountAmount: implicitDiscountAmount,
      finalClientPrice: prixClient,
    };

    errorStep = 'CREATE_PREPARE';
    // Generate tracking number and secure QR token
    const trackingNumber = generateTrackingNumber();
    const qrToken = randomBytes(24).toString('hex');
    const withdrawalPin = generateWithdrawalPin(); // 🔒 NEW: 4-digit PIN for security
    const qrExpiresAt = calculateQRExpiration(24); // 🔒 NEW: QR expires in 24 hours
    const expectedDeliveryAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const placeholderQrPayload = JSON.stringify({ token: qrToken });

    const minimalCreateData = {
      trackingNumber,
      clientId,
      lineId: activeLine.id,
      senderFirstName: senderFirstName.trim(),
      senderLastName: senderLastName.trim(),
      senderPhone: normalizedSenderPhone,
      recipientFirstName: recipientFirstName.trim(),
      recipientLastName: recipientLastName.trim(),
      recipientPhone: normalizedRecipientPhone,
      relaisDepartId,
      relaisArriveeId,
      villeDepart,
      villeArrivee,
      weight: parsedWeight,
      description,
      prixClient,
      commissionPlateforme: platformFee,
      commissionRelais: relayFee,
      netTransporteur,
      qrCode: placeholderQrPayload,
      status: 'CREATED',
      dateLimit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const baseCreateData = {
      ...minimalCreateData,
      recipientEmail: normalizedRecipientEmail,
      withdrawalCodeHash: hashWithdrawalCode(effectiveWithdrawalCode),
    };

    const createSelect = {
      id: true,
      trackingNumber: true,
      clientId: true,
      lineId: true,
      relaisDepartId: true,
      relaisArriveeId: true,
      villeDepart: true,
      villeArrivee: true,
      status: true,
      prixClient: true,
      dateLimit: true,
      qrCode: true,
      qrCodeImage: true,
      createdAt: true,
    };

    errorStep = 'CREATE_COLIS';
    let createdColis;
    try {
      createdColis = await db.colis.create({
        data: {
          ...baseCreateData,
          qrToken,
          withdrawalPin,
          qrExpiresAt,
          custody: 'CLIENT',
          expectedDeliveryAt,
        },
        select: createSelect,
      });
    } catch (createError) {
      console.warn('[api/parcels] full create failed, retrying with compatibility payload:', createError);
      try {
        createdColis = await db.colis.create({
          data: baseCreateData,
          select: createSelect,
        });
      } catch (compatCreateError) {
        console.warn('[api/parcels] compatibility create failed, retrying with minimal payload:', compatCreateError);
        createdColis = await db.colis.create({
          data: minimalCreateData,
          select: createSelect,
        });
      }
    }

    errorStep = 'QR_GENERATE';
    const secureQrPayload = JSON.stringify({
      parcelId: createdColis.id,
      token: qrToken,
      tracking: trackingNumber,
      pin: withdrawalPin, // Include PIN in QR payload
      expiresAt: qrExpiresAt.toISOString(),
    });
    const qrCodeImage = await generateQRCodeImage(secureQrPayload);

    errorStep = 'UPDATE_COLIS_QR';
    let colis;
    try {
      colis = await db.colis.update({
        where: { id: createdColis.id },
        data: {
          qrCode: secureQrPayload,
          qrCodeImage,
        },
        select: createSelect,
      });
    } catch (updateError) {
      console.warn('[api/parcels] update QR payload failed, keeping initial parcel payload:', updateError);
      colis = createdColis;
    }

    // Create tracking history
    errorStep = 'TRACKING_CREATE';
    try {
      await db.trackingHistory.create({
        data: {
          colisId: colis.id,
          status: 'CREATED',
          location: villeDepart,
          userId: payload.id,
          notes: `Colis créé (impression ${normalizedLabelPrintMode === 'RELAY' ? 'au relais' : 'à domicile'}) et placé dans la file d'attente de la ligne ${activeLine.villeDepart} → ${activeLine.villeArrivee}`,
        },
      });
    } catch (trackingError) {
      console.warn('[api/parcels] tracking history create failed (non-blocking):', trackingError);
    }

    errorStep = 'POST_ELIGIBILITY_REFRESH';
    try {
      await evaluateImplicitProEligibility(clientId);
    } catch (eligibilityError) {
      console.error('[implicit-pro] post-create evaluation failed:', eligibilityError);
    }

    errorStep = 'RESPONSE';
    return NextResponse.json({
      ...colis,
      withdrawalCode: effectiveWithdrawalCode,
      labelPrintMode: normalizedLabelPrintMode,
      relayPrintFee,
      pricingBreakdown,
    });
  } catch (error) {
    const prismaCode = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : null;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating parcel:', { step: errorStep, prismaCode, message, error });
    return NextResponse.json(
      {
        error: 'Failed to create parcel',
        step: errorStep,
        code: prismaCode,
      },
      { status: 500 }
    );
  }
}
