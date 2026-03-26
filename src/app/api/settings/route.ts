import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
      pricingRoundTo: parseFloat(settingsObj.pricingRoundTo || '10'),
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
      pricingRoundTo: 10,
    });
  }
}

// PUT update platform settings
export async function PUT(request: NextRequest) {
  try {
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
      pricingRoundTo,
    } = body;

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

    if (pricingRoundTo !== undefined) {
      updates.push(
        db.setting.upsert({
          where: { key: 'pricingRoundTo' },
          update: { value: String(pricingRoundTo) },
          create: { key: 'pricingRoundTo', value: String(pricingRoundTo) },
        })
      );
    }

    await Promise.all(updates);

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
        pricingRoundTo,
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
