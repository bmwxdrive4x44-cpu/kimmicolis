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
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({
      platformCommission: 10,
      commissionPetit: 100,
      commissionMoyen: 200,
      commissionGros: 300,
    });
  }
}

// PUT update platform settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { platformCommission, commissionPetit, commissionMoyen, commissionGros } = body;

    // Update each setting
    const updates: Promise<{ id: string; key: string; value: string; updatedAt: Date }>[] = [];
    
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

    await Promise.all(updates);

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        platformCommission,
        commissionPetit,
        commissionMoyen,
        commissionGros,
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
