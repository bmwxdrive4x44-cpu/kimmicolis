import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateTrackingNumber, generateQRData } from '@/lib/constants';
import { requireRole } from '@/lib/rbac';
import { generateQRCodeImage, buildQRCodePayload } from '@/lib/qrcode';
import {
  calculateDynamicParcelPricing,
  estimateSafeDistanceKmByWilayas,
  getProBatchDiscountRate,
  PRO_DISCOUNT_TIERS,
} from '@/lib/pricing';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';
import { findActiveLineByCities } from '@/lib/logistics';
import { createHash } from 'crypto';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

const MAX_BULK = 50;

function normalizePhone(v: string) {
  return v.replace(/\s+/g, '').replace(/[^+\d]/g, '');
}

function generateWithdrawalCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

async function getPricingConfig() {
  const keys = ['pricingAdminFee', 'pricingRatePerKg', 'pricingRatePerKm', 'pricingRelayDepartureRate', 'pricingRelayArrivalRate', 'pricingRoundTo'];
  const settings = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const getN = (k: string, f: number) => { const v = Number(map.get(k)); return Number.isFinite(v) ? v : f; };
  return {
    adminFee: getN('pricingAdminFee', 50),
    ratePerKg: getN('pricingRatePerKg', 50),
    ratePerKm: getN('pricingRatePerKm', 2.5),
    relayDepartureRate: getN('pricingRelayDepartureRate', 0.1),
    relayArrivalRate: getN('pricingRelayArrivalRate', 0.1),
    roundTo: getN('pricingRoundTo', 10),
  };
}

/**
 * POST /api/parcels/bulk
 * Pro clients only. Creates multiple parcels in a single batch with degressive pricing.
 *
 * Body:
 * {
 *   clientId: string,
 *   relaisDepartId: string,
 *   relaisArriveeId: string,
 *   villeDepart: string,
 *   villeArrivee: string,
 *   parcels: Array<{
 *     senderFirstName, senderLastName, senderPhone,
 *     recipientFirstName, recipientLastName, recipientPhone,
 *     weight: number,
 *     description?: string,
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'ENSEIGNE', 'ADMIN']);
  if (!auth.success) return auth.response;
  const { payload } = auth;
  const requestOrigin = new URL(request.url).origin;

  // Rate limit
  const rl = await checkRateLimit(request, RATE_LIMIT_PRESETS.strict, payload.id);
  if (rl.limited) {
    return NextResponse.json({ error: 'Too many requests', retryAfter: rl.retryAfter }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { clientId, relaisDepartId, relaisArriveeId, villeDepart, villeArrivee, parcels } = body;

    if ((payload.role === 'CLIENT' || payload.role === 'ENSEIGNE') && clientId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await db.user.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const eligibility = await evaluateImplicitProEligibility(clientId);
    if (!eligibility.eligible && payload.role !== 'ADMIN' && payload.role !== 'ENSEIGNE') {
      return NextResponse.json(
        {
          error: `Expedition en lot reservee aux clients eligibles (${eligibility.threshold} colis minimum sur ${eligibility.windowDays} jours)`,
          eligibility,
        },
        { status: 403 }
      );
    }

    if (!Array.isArray(parcels) || parcels.length === 0) {
      return NextResponse.json({ error: 'La liste des colis est vide' }, { status: 400 });
    }
    if (parcels.length > MAX_BULK) {
      return NextResponse.json({ error: `Maximum ${MAX_BULK} colis par envoi` }, { status: 400 });
    }

    // Validate shared routing
    if (!relaisDepartId || !relaisArriveeId || !villeDepart || !villeArrivee) {
      return NextResponse.json({ error: 'Itinéraire et relais obligatoires' }, { status: 400 });
    }

    const [relaisDepart, relaisArrivee] = await Promise.all([
      db.relais.findUnique({ where: { id: relaisDepartId }, select: { ville: true, status: true, operationalStatus: true, suspensionReason: true } }),
      db.relais.findUnique({ where: { id: relaisArriveeId }, select: { ville: true, status: true, operationalStatus: true, suspensionReason: true } }),
    ]);

    if (!relaisDepart || relaisDepart.status !== 'APPROVED' || relaisDepart.operationalStatus === 'SUSPENDU') {
      return NextResponse.json({ error: 'Relais de départ indisponible', details: relaisDepart?.suspensionReason }, { status: 400 });
    }
    if (!relaisArrivee || relaisArrivee.status !== 'APPROVED' || relaisArrivee.operationalStatus === 'SUSPENDU') {
      return NextResponse.json({ error: 'Relais d\'arrivée indisponible', details: relaisArrivee?.suspensionReason }, { status: 400 });
    }
    if (relaisDepart.ville !== villeDepart || relaisArrivee.ville !== villeArrivee) {
      return NextResponse.json({ error: 'Relais ne correspondent pas aux villes' }, { status: 400 });
    }

    const activeLine = await findActiveLineByCities(villeDepart, villeArrivee);
    if (!activeLine) {
      return NextResponse.json({ error: 'Aucune ligne active pour cet itinéraire' }, { status: 400 });
    }

    // Validate each parcel row
    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];
      const index = i + 1;
      if (!p.senderFirstName?.trim() || !p.senderLastName?.trim() || !p.senderPhone?.trim()) {
        return NextResponse.json({ error: `Colis #${index} : informations expéditeur incomplètes` }, { status: 400 });
      }
      if (!p.recipientFirstName?.trim() || !p.recipientLastName?.trim() || !p.recipientPhone?.trim()) {
        return NextResponse.json({ error: `Colis #${index} : informations destinataire incomplètes` }, { status: 400 });
      }
      const w = Number(p.weight ?? 0);
      if (!Number.isFinite(w) || w <= 0) {
        return NextResponse.json({ error: `Colis #${index} : poids invalide` }, { status: 400 });
      }
    }

    // Pricing
    const pricingConfig = await getPricingConfig();
    const estimatedDistanceKm = estimateSafeDistanceKmByWilayas(villeDepart, villeArrivee);
    const discountRate = getProBatchDiscountRate(parcels.length);

    // Build parcel data
    const pricedParcels = parcels.map((p: any) => {
      const parsedWeight = Number(p.weight);
      const dynamic = calculateDynamicParcelPricing({
        weightKg: parsedWeight,
        distanceKm: estimatedDistanceKm,
        adminFee: pricingConfig.adminFee,
        ratePerKg: pricingConfig.ratePerKg,
        ratePerKm: pricingConfig.ratePerKm,
        formatMultiplier: 1,
        relayDepartureCommissionRate: pricingConfig.relayDepartureRate,
        relayArrivalCommissionRate: pricingConfig.relayArrivalRate,
        platformMarginRate: 0,
        roundTo: pricingConfig.roundTo,
      });

      const baseClientPrice = dynamic.clientPrice;
      const discount = Math.round(baseClientPrice * discountRate);
      const finalClientPrice = baseClientPrice - discount;

      const withdrawalCode = generateWithdrawalCode();
      const trackingNumber = generateTrackingNumber();
      const qrCode = generateQRData(trackingNumber, requestOrigin);

      return {
        raw: p,
        parsedWeight,
        dynamic,
        baseClientPrice,
        discountRate,
        discount,
        finalClientPrice,
        withdrawalCode,
        trackingNumber,
        qrCode,
      };
    });

    // Generate QR images
    const withImages = await Promise.all(
      pricedParcels.map(async (item) => {
        const qrPayload = buildQRCodePayload(item.trackingNumber, requestOrigin);
        const qrCodeImage = await generateQRCodeImage(qrPayload);
        return { ...item, qrCodeImage };
      })
    );

    // Create all parcels in a transaction
    const created = await db.$transaction(
      withImages.map((item) =>
        db.colis.create({
          data: {
            trackingNumber: item.trackingNumber,
            clientId,
            lineId: activeLine.id,
            senderFirstName: item.raw.senderFirstName.trim(),
            senderLastName: item.raw.senderLastName.trim(),
            senderPhone: normalizePhone(item.raw.senderPhone),
            recipientFirstName: item.raw.recipientFirstName.trim(),
            recipientLastName: item.raw.recipientLastName.trim(),
            recipientPhone: normalizePhone(item.raw.recipientPhone),
            withdrawalCodeHash: hashCode(item.withdrawalCode),
            relaisDepartId,
            relaisArriveeId,
            villeDepart,
            villeArrivee,
            weight: item.parsedWeight,
            description: item.raw.description?.trim() || null,
            prixClient: item.finalClientPrice,
            commissionPlateforme: item.dynamic.platformMargin,
            commissionRelais: item.dynamic.relayCommissionTotal,
            netTransporteur: item.dynamic.netTransporteur,
            qrCode: item.qrCode,
            qrCodeImage: item.qrCodeImage,
            isPriority: true,
            status: 'CREATED',
            dateLimit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      )
    );

    // Create tracking history for all parcels
    await db.trackingHistory.createMany({
      data: created.map((colis) => ({
        colisId: colis.id,
        status: 'CREATED',
        location: villeDepart,
        notes: `Colis PRO créé en lot (${parcels.length} colis) · remise ${Math.round(discountRate * 100)}%`,
      })),
    });

    try {
      await evaluateImplicitProEligibility(clientId);
    } catch (eligibilityError) {
      console.error('[implicit-pro] post-bulk evaluation failed:', eligibilityError);
    }

    // Return results
    const results = created.map((colis, i) => ({
      ...colis,
      withdrawalCode: withImages[i].withdrawalCode,
      baseClientPrice: withImages[i].baseClientPrice,
      discountRate,
      discount: withImages[i].discount,
    }));

    return NextResponse.json({
      success: true,
      count: created.length,
      discountRate,
      discountPercent: Math.round(discountRate * 100),
      activeTier: PRO_DISCOUNT_TIERS.find(
        (t) => parcels.length >= t.minCount && parcels.length <= t.maxCount
      ) ?? null,
      parcels: results,
    });
  } catch (error) {
    console.error('Error creating bulk parcels:', error);
    return NextResponse.json({ error: 'Failed to create parcels' }, { status: 500 });
  }
}
