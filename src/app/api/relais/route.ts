import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

// GET all relais or filter by userId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const ville = searchParams.get('ville');
    const userId = searchParams.get('userId');

    const isPublicApprovedLookup = status === 'APPROVED' && !userId;

    if (isPublicApprovedLookup) {
      const where: Record<string, unknown> = { status: 'APPROVED' };
      if (ville) where.ville = ville;

      const relais = await db.relais.findMany({
        where,
        select: {
          id: true,
          commerceName: true,
          address: true,
          ville: true,
          openTime: true,
          closeTime: true,
          latitude: true,
          longitude: true,
          commissionPetit: true,
          commissionMoyen: true,
          commissionGros: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(relais);
    }

    const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
    if (!auth.success) return auth.response;

    let where: any = {};
    if (status) where.status = status;
    if (ville) where.ville = ville;
    if (userId) {
      if (auth.payload.role !== 'ADMIN' && userId !== auth.payload.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.userId = userId;
    } else if (auth.payload.role === 'RELAIS') {
      where.userId = auth.payload.id;
    }

    const relais = await db.relais.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(relais);
  } catch (error) {
    console.error('Error fetching relais:', error);
    return NextResponse.json({ error: 'Failed to fetch relais' }, { status: 500 });
  }
}

// POST create relais registration
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { userId, commerceName, address, ville, latitude, longitude, photos, commerceRegisterNumber } = body;
    const rcNumber = String(commerceRegisterNumber || '').trim();

    if (!userId || !commerceName || !address || !ville || !rcNumber) {
      return NextResponse.json({ error: 'Missing required fields (numéro RC obligatoire)' }, { status: 400 });
    }

    if (auth.payload.role === 'RELAIS' && userId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existingRelais = await db.relais.findUnique({
      where: { userId },
    });

    if (existingRelais) {
      await db.user.update({
        where: { id: userId },
        data: { siret: rcNumber },
      });

      const relais = await db.relais.update({
        where: { userId },
        data: {
          commerceName,
          address,
          ville,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          photos: photos ? JSON.stringify(photos) : null,
          status: 'PENDING',
        },
      });

      return NextResponse.json(relais);
    }

    await db.user.update({
      where: { id: userId },
      data: { siret: rcNumber },
    });

    const relais = await db.relais.create({
      data: {
        userId,
        commerceName,
        address,
        ville,
        latitude,
        longitude,
        photos: photos ? JSON.stringify(photos) : null,
        status: 'PENDING',
      },
    });

    return NextResponse.json(relais);
  } catch (error) {
    console.error('Error creating relais:', error);
    return NextResponse.json({ error: 'Failed to create relais' }, { status: 500 });
  }
}
