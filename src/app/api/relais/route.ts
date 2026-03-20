import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all relais
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const ville = searchParams.get('ville');

    let where: any = {};
    if (status) where.status = status;
    if (ville) where.ville = ville;

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
    const body = await request.json();
    const { userId, commerceName, address, ville, latitude, longitude, photos } = body;

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
