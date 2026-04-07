import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import {
  LOYALTY_DEFAULTS,
  LOYALTY_LIMITS,
  clearImplicitLoyaltyConfigCache,
  sanitizeLoyaltyConfig,
} from '@/lib/loyalty-config';

// GET platform settings
export async function GET() {
  try {
    // Get all settings from database
    const settings = await db.setting.findMany();
    
    // Convert to object
    const settingsObj: Record<string, string> = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });

    // Return with defaults if not set
    return NextResponse.json({
      platformCommission: parseFloat(settingsObj.platformCommission || '10'),
      commissionPetit: parseFloat(settingsObj.commissionPetit || '100'),
      commissionMoyen: parseFloat(settingsObj.commissionMoyen || '200'),
      commissionGros: parseFloat(settingsObj.commissionGros || '300'),
      pricingAdminFee: parseFloat(settingsObj.pricingAdminFee || '50'),
      pricingRatePerKg: parseFloat(settingsObj.pricingRatePerKg || '120'),
      pricingRatePerKm: parseFloat(settingsObj.pricingRatePerKm || '2.5'),
      pricingRelayDepartureRate: parseFloat(settingsObj.pricingRelayDepartureRate || '0.1'),
      pricingRelayArrivalRate: parseFloat(settingsObj.pricingRelayArrivalRate || '0.1'),
      pricingRelayPrintFee: parseFloat(settingsObj.pricingRelayPrintFee || '30'),
      pricingRoundTo: parseFloat(settingsObj.pricingRoundTo || '10'),
      loyaltyImplicitDiscountRate: parseFloat(settingsObj.loyaltyImplicitDiscountRate || String(LOYALTY_DEFAULTS.discountRate)),
      loyaltyImplicitMinParcels: parseFloat(settingsObj.loyaltyImplicitMinParcels || String(LOYALTY_DEFAULTS.minParcels)),
      loyaltyImplicitWindowDays: parseFloat(settingsObj.loyaltyImplicitWindowDays || String(LOYALTY_DEFAULTS.windowDays)),
      loyaltyImplicitStickyDays: parseFloat(settingsObj.loyaltyImplicitStickyDays || String(LOYALTY_DEFAULTS.stickyDays)),
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({
      platformCommission: 10,
      commissionPetit: 100,
      commissionMoyen: 200,
      commissionGros: 300,
      pricingAdminFee: 50,
      pricingRatePerKg: 120,
      pricingRatePerKm: 2.5,
      pricingRelayDepartureRate: 0.1,
      pricingRelayArrivalRate: 0.1,
      pricingRelayPrintFee: 30,
      pricingRoundTo: 10,
      loyaltyImplicitDiscountRate: LOYALTY_DEFAULTS.discountRate,
      loyaltyImplicitMinParcels: LOYALTY_DEFAULTS.minParcels,
      loyaltyImplicitWindowDays: LOYALTY_DEFAULTS.windowDays,
      loyaltyImplicitStickyDays: LOYALTY_DEFAULTS.stickyDays,
    });
  }
}

// PUT update platform settings
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['ADMIN']);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const {
      platformCommission,
      commissionPetit,
      commissionMoyen,
      commissionGros,
      pricingAdminFee,
      pricingRatePerKg,
      pricingRatePerKm,
      pricingRelayDepartureRate,
      pricingRelayArrivalRate,
      pricingRelayPrintFee,
      pricingRoundTo,
      loyaltyImplicitDiscountRate,
      loyaltyImplicitMinParcels,
      loyaltyImplicitWindowDays,
      loyaltyImplicitStickyDays,
    } = body;

    const hasLoyaltyPayload = [
      loyaltyImplicitDiscountRate,
      loyaltyImplicitMinParcels,
      loyaltyImplicitWindowDays,
      loyaltyImplicitStickyDays,
    ].some((v) => v !== undefined);

    const sanitizedLoyalty = hasLoyaltyPayload
      ? sanitizeLoyaltyConfig({
          discountRate: loyaltyImplicitDiscountRate,
          minParcels: loyaltyImplicitMinParcels,
          windowDays: loyaltyImplicitWindowDays,
          stickyDays: loyaltyImplicitStickyDays,
        })
      : null;

    if (loyaltyImplicitDiscountRate !== undefined && Number(loyaltyImplicitDiscountRate) !== sanitizedLoyalty?.discountRate) {
      return NextResponse.json({ error: `loyaltyImplicitDiscountRate hors borne [${LOYALTY_LIMITS.discountRate.min}, ${LOYALTY_LIMITS.discountRate.max}]` }, { status: 400 });
    }
    if (loyaltyImplicitMinParcels !== undefined && Number(loyaltyImplicitMinParcels) !== sanitizedLoyalty?.minParcels) {
      return NextResponse.json({ error: `loyaltyImplicitMinParcels hors borne [${LOYALTY_LIMITS.minParcels.min}, ${LOYALTY_LIMITS.minParcels.max}]` }, { status: 400 });
    }
    if (loyaltyImplicitWindowDays !== undefined && Number(loyaltyImplicitWindowDays) !== sanitizedLoyalty?.windowDays) {
      return NextResponse.json({ error: `loyaltyImplicitWindowDays hors borne [${LOYALTY_LIMITS.windowDays.min}, ${LOYALTY_LIMITS.windowDays.max}]` }, { status: 400 });
    }
    if (loyaltyImplicitStickyDays !== undefined && Number(loyaltyImplicitStickyDays) !== sanitizedLoyalty?.stickyDays) {
      return NextResponse.json({ error: `loyaltyImplicitStickyDays hors borne [${LOYALTY_LIMITS.stickyDays.min}, ${LOYALTY_LIMITS.stickyDays.max}]` }, { status: 400 });
    }

    const loyaltyKeys = [
      'loyaltyImplicitDiscountRate',
      'loyaltyImplicitMinParcels',
      'loyaltyImplicitWindowDays',
      'loyaltyImplicitStickyDays',
    ];
    const loyaltyBefore = await db.setting.findMany({ where: { key: { in: loyaltyKeys } } });
    const beforeMap = new Map(loyaltyBefore.map((s) => [s.key, s.value]));

    // Update each setting
    const updates: Promise<unknown>[] = [];
    
    if (platformCommission !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'platformCommission' },
          update: { value: String(platformCommission) },
          create: { key: 'platformCommission', value: String(platformCommission) },
        })
      );
    }
    
    if (commissionPetit !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'commissionPetit' },
          update: { value: String(commissionPetit) },
          create: { key: 'commissionPetit', value: String(commissionPetit) },
        })
      );
    }
    
    if (commissionMoyen !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'commissionMoyen' },
          update: { value: String(commissionMoyen) },
          create: { key: 'commissionMoyen', value: String(commissionMoyen) },
        })
      );
    }
    
    if (commissionGros !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'commissionGros' },
          update: { value: String(commissionGros) },
          create: { key: 'commissionGros', value: String(commissionGros) },
        })
      );
    }

    if (pricingAdminFee !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'pricingAdminFee' },
          update: { value: String(pricingAdminFee) },
          create: { key: 'pricingAdminFee', value: String(pricingAdminFee) },
        })
      );
    }

    if (pricingRatePerKg !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'pricingRatePerKg' },
          update: { value: String(pricingRatePerKg) },
          create: { key: 'pricingRatePerKg', value: String(pricingRatePerKg) },
        })
      );
    }

    if (pricingRatePerKm !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'pricingRatePerKm' },
          update: { value: String(pricingRatePerKm) },
          create: { key: 'pricingRatePerKm', value: String(pricingRatePerKm) },
        })
      );
    }

    if (pricingRelayDepartureRate !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'pricingRelayDepartureRate' },
          update: { value: String(pricingRelayDepartureRate) },
          create: { key: 'pricingRelayDepartureRate', value: String(pricingRelayDepartureRate) },
        })
      );
    }

    if (pricingRelayArrivalRate !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'pricingRelayArrivalRate' },
          update: { value: String(pricingRelayArrivalRate) },
          create: { key: 'pricingRelayArrivalRate', value: String(pricingRelayArrivalRate) },
        })
      );
    }

    if (pricingRelayPrintFee !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'pricingRelayPrintFee' },
          update: { value: String(pricingRelayPrintFee) },
          create: { key: 'pricingRelayPrintFee', value: String(pricingRelayPrintFee) },
        })
      );
    }

    if (pricingRoundTo !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'pricingRoundTo' },
          update: { value: String(pricingRoundTo) },
          create: { key: 'pricingRoundTo', value: String(pricingRoundTo) },
        })
      );
    }

    if (sanitizedLoyalty) {
      updates.push(
        db.setting.upsert({
          where: { key: 'loyaltyImplicitDiscountRate' },
          update: { value: String(sanitizedLoyalty.discountRate) },
          create: { key: 'loyaltyImplicitDiscountRate', value: String(sanitizedLoyalty.discountRate) },
        })
      );
      updates.push(
        db.setting.upsert({
          where: { key: 'loyaltyImplicitMinParcels' },
          update: { value: String(sanitizedLoyalty.minParcels) },
          create: { key: 'loyaltyImplicitMinParcels', value: String(sanitizedLoyalty.minParcels) },
        })
      );
      updates.push(
        db.setting.upsert({
          where: { key: 'loyaltyImplicitWindowDays' },
          update: { value: String(sanitizedLoyalty.windowDays) },
          create: { key: 'loyaltyImplicitWindowDays', value: String(sanitizedLoyalty.windowDays) },
        })
      );
      updates.push(
        db.setting.upsert({
          where: { key: 'loyaltyImplicitStickyDays' },
          update: { value: String(sanitizedLoyalty.stickyDays) },
          create: { key: 'loyaltyImplicitStickyDays', value: String(sanitizedLoyalty.stickyDays) },
        })
      );
    }

    await Promise.all(updates);
    clearImplicitLoyaltyConfigCache();

    if (sanitizedLoyalty) {
      const afterMap = new Map<string, string>([
        ['loyaltyImplicitDiscountRate', String(sanitizedLoyalty.discountRate)],
        ['loyaltyImplicitMinParcels', String(sanitizedLoyalty.minParcels)],
        ['loyaltyImplicitWindowDays', String(sanitizedLoyalty.windowDays)],
        ['loyaltyImplicitStickyDays', String(sanitizedLoyalty.stickyDays)],
      ]);

      const changes = loyaltyKeys
        .map((key) => ({ key, before: beforeMap.get(key), after: afterMap.get(key) }))
        .filter((entry) => entry.before !== entry.after);

      if (changes.length > 0) {
        await db.actionLog.create({
          data: {
            userId: auth.payload.id,
            entityType: 'SETTING',
            entityId: 'LOYALTY_IMPLICIT',
            action: 'LOYALTY_CONFIG_UPDATED',
            details: JSON.stringify({ changes }),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        platformCommission,
        commissionPetit,
        commissionMoyen,
        commissionGros,
        pricingAdminFee,
        pricingRatePerKg,
        pricingRatePerKm,
        pricingRelayDepartureRate,
        pricingRelayArrivalRate,
        pricingRelayPrintFee,
        pricingRoundTo,
        loyaltyImplicitDiscountRate: sanitizedLoyalty?.discountRate,
        loyaltyImplicitMinParcels: sanitizedLoyalty?.minParcels,
        loyaltyImplicitWindowDays: sanitizedLoyalty?.windowDays,
        loyaltyImplicitStickyDays: sanitizedLoyalty?.stickyDays,
      },
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ 
      error: 'Failed to save settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
