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
import { sendEmail } from '@/lib/email';
import { checkRelayTrialQuota } from '@/lib/relais-trial';

function hashWithdrawalCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateWithdrawalCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeOptionalEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

async function getPricingConfig() {
  const keys = [
    'pricingAdminFee', 'pricingRatePerKg', 'pricingRatePerKm',
    'pricingRelayDepartureRate', 'pricingRelayArrivalRate', 'pricingRoundTo', 'platformCommission',
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
    platformCommissionRate: n('platformCommission', 10) / 100,
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
      recipientEmail,
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
    const normalizedRecipientEmail = normalizeOptionalEmail(recipientEmail);
    if (normalizedRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipientEmail)) {
      return NextResponse.json({ error: 'Email destinataire invalide' }, { status: 400 });
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

    const trialQuota = await checkRelayTrialQuota({
      relaisId: relaisDepartId,
      additionalParcels: 1,
    });
    if (trialQuota.limited) {
      return NextResponse.json(
        {
          error: 'Relais en période d\'essai: quota quotidien atteint',
          details: `Maximum ${trialQuota.maxPerDay} colis/jour pendant l'essai (${trialQuota.daysRemaining} jour(s) restant(s))`,
        },
        { status: 400 }
      );
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
      platformMarginRate: pricingConfig.platformCommissionRate,
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


    // Récupérer infos relais arrivée pour l'email
    const relaisArriveeInfo = await db.relais.findUnique({
      where: { id: relaisArriveeId },
      select: { commerceName: true, address: true, ville: true },
    });

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
        recipientEmail: normalizedRecipientEmail,
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

    // Envoi email au destinataire avec code de retrait et adresse relais
    if (normalizedRecipientEmail && relaisArriveeInfo) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#065f46;">Votre colis SwiftColis est prêt à être retiré</h2>
          <p>Bonjour ${recipientFirstName} ${recipientLastName},</p>
          <p>Un colis à votre nom a été créé sur SwiftColis.</p>
          <p><strong>Code de retrait&nbsp;:</strong> <span style="font-size:1.5em;letter-spacing:2px;color:#2563eb;">${withdrawalCode}</span></p>
          <p><strong>Relais d'arrivée&nbsp;:</strong><br/>
            ${relaisArriveeInfo.commerceName ? `<b>${relaisArriveeInfo.commerceName}</b><br/>` : ''}
            ${relaisArriveeInfo.address ? `${relaisArriveeInfo.address}<br/>` : ''}
            ${relaisArriveeInfo.ville ? relaisArriveeInfo.ville : ''}
          </p>
          <ul style="margin:16px 0 24px 0;padding-left:20px;">
            <li>Présentez ce code au relais pour retirer votre colis.</li>
            <li>N'oubliez pas une pièce d'identité valide (CNI, passeport, permis...)</li>
            <li>Si le colis contient un objet réglementé, munissez-vous du permis ou document requis.</li>
          </ul>
          <p style="color:#64748b;font-size:13px;">Ne partagez jamais ce code avec un inconnu. Pour toute question, contactez le support SwiftColis.</p>
        </div>
      `;
      try {
        await sendEmail({
          to: normalizedRecipientEmail,
          subject: `Votre code de retrait SwiftColis: ${withdrawalCode}`,
          html,
        });
      } catch (e) {
        console.error('[quick-create] Erreur envoi email code retrait:', e);
      }
    }

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
