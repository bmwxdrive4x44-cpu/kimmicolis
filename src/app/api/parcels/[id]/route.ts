import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';
import { calculateDynamicParcelPricing, estimateSafeDistanceKmByWilayas } from '@/lib/pricing';

async function getPricingConfig() {
  const keys = [
    'pricingAdminFee',
    'pricingRatePerKg',
    'pricingRatePerKm',
    'pricingRelayDepartureRate',
    'pricingRelayArrivalRate',
    'pricingRoundTo',
    'platformCommission',
  ];

  const settings = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const getN = (k: string, d: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) ? v : d;
  };

  return {
    adminFee: getN('pricingAdminFee', 50),
    ratePerKg: getN('pricingRatePerKg', 120),
    ratePerKm: getN('pricingRatePerKm', 2.5),
    relayDepartureRate: getN('pricingRelayDepartureRate', 0.1),
    relayArrivalRate: getN('pricingRelayArrivalRate', 0.1),
    roundTo: getN('pricingRoundTo', 10),
    platformCommissionRate: getN('platformCommission', 10) / 100,
  };
}

// GET single parcel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['CLIENT', 'RELAIS', 'TRANSPORTER', 'ADMIN']);
    if (!auth.success) return auth.response;

    const { id } = await params;
    
    const parcel = await db.colis.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        relaisDepart: { include: { user: { select: { name: true, phone: true } } } },
        relaisArrivee: { include: { user: { select: { name: true, phone: true } } } },
        missions: { include: { transporteur: { select: { id: true, name: true, phone: true } } } },
        trackingHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    if (auth.payload.role === 'CLIENT' && parcel.clientId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(parcel);
  } catch (error) {
    console.error('Error fetching parcel:', error);
    return NextResponse.json({ error: 'Failed to fetch parcel' }, { status: 500 });
  }
}

// PUT update parcel status (ADMIN exception only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { status, location, notes } = body;

    const existingParcel = await db.colis.findUnique({
      where: { id },
      select: { clientId: true },
    });

    if (!existingParcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    const parcel = await db.colis.update({
      where: { id },
      data: {
        status,
        deliveredAt: status === 'LIVRE' ? new Date() : null,
      },
    });

    // Add tracking history
    if (status) {
      await db.trackingHistory.create({
        data: {
          colisId: id,
          status,
          location,
          notes,
          userId: auth.payload.id,
        },
      });

      try {
        await evaluateImplicitProEligibility(existingParcel.clientId);
      } catch (eligibilityError) {
        console.error('[implicit-pro] parcel status evaluation failed:', eligibilityError);
      }
    }

    return NextResponse.json(parcel);
  } catch (error) {
    console.error('Error updating parcel:', error);
    return NextResponse.json({ error: 'Failed to update parcel' }, { status: 500 });
  }
}

// PATCH update parcel details (allowed only before payment)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['CLIENT', 'ENSEIGNE', 'ADMIN']);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const body = await request.json();

    const existingParcel = await db.colis.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        status: true,
        weight: true,
        villeDepart: true,
        villeArrivee: true,
      },
    });

    if (!existingParcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    if ((auth.payload.role === 'CLIENT' || auth.payload.role === 'ENSEIGNE') && existingParcel.clientId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const editableStatuses = new Set(['CREATED', 'PENDING_PAYMENT']);
    if (!editableStatuses.has(existingParcel.status)) {
      return NextResponse.json(
        { error: 'Ce colis ne peut plus être modifié après paiement.' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.recipientFirstName !== undefined) {
      const value = String(body.recipientFirstName).trim();
      if (!value) return NextResponse.json({ error: 'recipientFirstName invalide' }, { status: 400 });
      updates.recipientFirstName = value;
    }

    if (body.recipientLastName !== undefined) {
      const value = String(body.recipientLastName).trim();
      if (!value) return NextResponse.json({ error: 'recipientLastName invalide' }, { status: 400 });
      updates.recipientLastName = value;
    }

    if (body.recipientPhone !== undefined) {
      const value = String(body.recipientPhone).replace(/\s+/g, '').trim();
      if (!/^\+?[0-9]{8,15}$/.test(value)) {
        return NextResponse.json({ error: 'recipientPhone invalide' }, { status: 400 });
      }
      updates.recipientPhone = value;
    }

    if (body.recipientEmail !== undefined) {
      const value = String(body.recipientEmail ?? '').trim().toLowerCase();
      if (value.length === 0) {
        updates.recipientEmail = null;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return NextResponse.json({ error: 'recipientEmail invalide' }, { status: 400 });
      } else {
        updates.recipientEmail = value;
      }
    }

    if (body.weight !== undefined) {
      const value = Number(body.weight);
      if (!Number.isFinite(value) || value <= 0) {
        return NextResponse.json({ error: 'weight invalide' }, { status: 400 });
      }
      updates.weight = value;

      const pricing = await getPricingConfig();
      const distanceKm = estimateSafeDistanceKmByWilayas(existingParcel.villeDepart, existingParcel.villeArrivee);
      const dynamic = calculateDynamicParcelPricing({
        weightKg: value,
        distanceKm,
        adminFee: pricing.adminFee,
        ratePerKg: pricing.ratePerKg,
        ratePerKm: pricing.ratePerKm,
        relayDepartureCommissionRate: pricing.relayDepartureRate,
        relayArrivalCommissionRate: pricing.relayArrivalRate,
        platformMarginRate: pricing.platformCommissionRate,
        roundTo: pricing.roundTo,
      });

      updates.prixClient = dynamic.clientPrice;
      updates.commissionPlateforme = dynamic.platformMargin;
      updates.commissionRelais = dynamic.relayCommissionTotal;
      updates.netTransporteur = dynamic.netTransporteur;
    }

    if (body.description !== undefined) {
      const raw = String(body.description ?? '').trim();
      updates.description = raw.length > 0 ? raw : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à modifier' }, { status: 400 });
    }

    const parcel = await db.colis.update({
      where: { id },
      data: updates,
    });

    await db.trackingHistory.create({
      data: {
        colisId: id,
        status: existingParcel.status,
        userId: auth.payload.id,
        notes: body.weight !== undefined
          ? `Données colis modifiées avant paiement (poids/tarif mis à jour)`
          : 'Données colis modifiées avant paiement',
      },
    });

    return NextResponse.json(parcel);
  } catch (error) {
    console.error('Error patching parcel:', error);
    return NextResponse.json({ error: 'Failed to patch parcel' }, { status: 500 });
  }
}

// DELETE definitive delete parcel while unpaid
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['CLIENT', 'ENSEIGNE', 'ADMIN']);
    if (!auth.success) return auth.response;

    const { id } = await params;

    const existingParcel = await db.colis.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        status: true,
      },
    });

    if (!existingParcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    if ((auth.payload.role === 'CLIENT' || auth.payload.role === 'ENSEIGNE') && existingParcel.clientId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const deletableStatuses = new Set(['CREATED', 'PENDING_PAYMENT']);
    if (!deletableStatuses.has(existingParcel.status)) {
      return NextResponse.json(
        { error: 'Ce colis est déjà payé ou en cours de traitement: suppression impossible.' },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.trackingHistory.deleteMany({ where: { colisId: id } });
      await tx.relaisCash.deleteMany({ where: { colisId: id } });
      await tx.dispute.deleteMany({ where: { colisId: id } });
      await tx.payment.deleteMany({ where: { colisId: id } });
      await tx.mission.deleteMany({ where: { colisId: id } });
      await tx.colis.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting parcel:', error);
    return NextResponse.json({ error: 'Failed to delete parcel' }, { status: 500 });
  }
}
