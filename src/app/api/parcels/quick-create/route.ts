/**
 * POST /api/parcels/quick-create
 * Simplified parcel creation for ENSEIGNE users.
 * Auto-resolves relays from city names, estimates price, returns colis + paymentUrl.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { generateTrackingNumber, generateQRData } from '@/lib/constants';
import { generateQRCodeImage, buildQRCodePayload } from '@/lib/qrcode';
import { calculateDynamicParcelPricing, estimateSafeDistanceKmByWilayas } from '@/lib/pricing';
import { findActiveLineByCities } from '@/lib/logistics';
import { createHash } from 'crypto';

function hashWithdrawalCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateWithdrawalCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getPricingConfig() {
  const keys = [
    'pricingAdminFee', 'pricingRatePerKg', 'pricingRatePerKm',
    'pricingRelayDepartureRate', 'pricingRelayArrivalRate', 'pricingRoundTo',
  ];
  const settings = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const n = (key: string, fallback: number) => {
    const v = Number(map.get(key));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    adminFee: n('pricingAdminFee', 50),
    ratePerKg: n('pricingRatePerKg', 120),
    ratePerKm: n('pricingRatePerKm', 2.5),
    relayDepartureRate: n('pricingRelayDepartureRate', 0.1),
    relayArrivalRate: n('pricingRelayArrivalRate', 0.1),
    roundTo: n('pricingRoundTo', 10),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ENSEIGNE', 'CLIENT', 'ADMIN']);
  if (!auth.success) return auth.response;
  const { payload } = auth;

  try {
    const body = await request.json();
    const {
      // Recipient
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      // Route
      villeDepart,
      villeArrivee,
      // Optional relay override
      relaisDepartId: explicitRelaisDepartId,
      relaisArriveeId: explicitRelaisArriveeId,
      // Parcel details
      weight = 1,
      description,
      // Delivery mode (for future use, currently relay-only)
      deliveryType = 'relay',
    } = body;

    // Basic validation
    if (!recipientFirstName?.trim() || !recipientLastName?.trim() || !recipientPhone?.trim()) {
      return NextResponse.json({ error: 'Informations destinataire incomplètes (prénom, nom, téléphone)' }, { status: 400 });
    }
    if (!villeDepart?.trim() || !villeArrivee?.trim()) {
      return NextResponse.json({ error: 'Villes de départ et arrivée obligatoires' }, { status: 400 });
    }

    const parsedWeight = Number(weight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      return NextResponse.json({ error: 'Poids invalide (doit être > 0 kg)' }, { status: 400 });
    }

    // Resolve sender info from enseigne profile
    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: { name: true, firstName: true, lastName: true, phone: true, enseigne: { select: { operationalCity: true } } },
    });
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    const senderFirstName = user.firstName || user.name?.split(' ')[0] || 'Expéditeur';
    const senderLastName = user.lastName || user.name?.split(' ').slice(1).join(' ') || 'Enseigne';
    const senderPhone = user.phone || '0000000000';

    // Auto-resolve relays
    let relaisDepartId = explicitRelaisDepartId;
    let relaisArriveeId = explicitRelaisArriveeId;

    if (!relaisDepartId) {
      const relay = await db.relais.findFirst({
        where: { ville: villeDepart, status: 'APPROVED', operationalStatus: 'ACTIF' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!relay) {
        return NextResponse.json({ error: `Aucun relais actif disponible à ${villeDepart}` }, { status: 400 });
      }
      relaisDepartId = relay.id;
    }

    if (!relaisArriveeId) {
      const relay = await db.relais.findFirst({
        where: { ville: villeArrivee, status: 'APPROVED', operationalStatus: 'ACTIF' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!relay) {
        return NextResponse.json({ error: `Aucun relais actif disponible à ${villeArrivee}` }, { status: 400 });
      }
      relaisArriveeId = relay.id;
    }

    // Verify relays operational
    const [relaisDepart, relaisArrivee] = await Promise.all([
      db.relais.findUnique({ where: { id: relaisDepartId }, select: { ville: true, status: true, operationalStatus: true } }),
      db.relais.findUnique({ where: { id: relaisArriveeId }, select: { ville: true, status: true, operationalStatus: true } }),
    ]);

    if (!relaisDepart || relaisDepart.status !== 'APPROVED' || relaisDepart.operationalStatus === 'SUSPENDU') {
      return NextResponse.json({ error: 'Relais de départ indisponible' }, { status: 400 });
    }
    if (!relaisArrivee || relaisArrivee.status !== 'APPROVED' || relaisArrivee.operationalStatus === 'SUSPENDU') {
      return NextResponse.json({ error: 'Relais d\'arrivée indisponible' }, { status: 400 });
    }

    // Find active line
    const activeLine = await findActiveLineByCities(villeDepart, villeArrivee);
    if (!activeLine) {
      return NextResponse.json({ error: `Aucune ligne active pour ${villeDepart} → ${villeArrivee}` }, { status: 400 });
    }

    // Calculate price
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
      platformMarginRate: 0,
      roundTo: pricingConfig.roundTo,
    });

    // Generate tracking + QR
    const trackingNumber = generateTrackingNumber();
    const requestOrigin = new URL(request.url).origin;
    const qrCode = generateQRData(trackingNumber, requestOrigin);
    const qrPayload = buildQRCodePayload(trackingNumber, requestOrigin);
    const qrCodeImage = await generateQRCodeImage(qrPayload);
    const withdrawalCode = generateWithdrawalCode();

    // Phone cleanup
    const cleanPhone = (p: string) => p.replace(/\s+/g, '').replace(/[^+\d]/g, '');

    // Create colis
    const colis = await db.colis.create({
      data: {
        trackingNumber,
        clientId: payload.id,
        lineId: activeLine.id,
        senderFirstName: senderFirstName.trim(),
        senderLastName: senderLastName.trim(),
        senderPhone: cleanPhone(senderPhone),
        recipientFirstName: recipientFirstName.trim(),
        recipientLastName: recipientLastName.trim(),
        recipientPhone: cleanPhone(recipientPhone),
        withdrawalCodeHash: hashWithdrawalCode(withdrawalCode),
        relaisDepartId,
        relaisArriveeId,
        villeDepart,
        villeArrivee,
        weight: parsedWeight,
        description: description?.trim() || null,
        prixClient: dynamic.clientPrice,
        commissionPlateforme: dynamic.platformMargin,
        commissionRelais: dynamic.relayCommissionTotal,
        netTransporteur: dynamic.netTransporteur,
        qrCode,
        qrCodeImage,
        status: 'CREATED',
        dateLimit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Tracking history
    await db.trackingHistory.create({
      data: {
        colisId: colis.id,
        status: 'CREATED',
        notes: `Colis créé via création rapide — ${deliveryType === 'home' ? 'livraison domicile' : 'relais'}`,
      },
    });

    return NextResponse.json({
      success: true,
      colis: {
        id: colis.id,
        trackingNumber: colis.trackingNumber,
        prixClient: colis.prixClient,
        villeDepart: colis.villeDepart,
        villeArrivee: colis.villeArrivee,
        status: colis.status,
      },
      withdrawalCode,
    });
  } catch (error) {
    console.error('[quick-create] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de la création du colis' }, { status: 500 });
  }
}
