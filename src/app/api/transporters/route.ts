import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all transporter applications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const applications = await db.transporterApplication.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error('Error fetching transporter applications:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}

// POST create transporter application
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, fullName, phone, vehicle, license, experience, regions, description } = body;

    if (!userId || !fullName || !phone || !vehicle || !license) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if already applied
    const existing = await db.transporterApplication.findUnique({ where: { userId } });
    if (existing) {
      return NextResponse.json({ error: 'Application already submitted' }, { status: 400 });
    }

    const application = await db.transporterApplication.create({
      data: {
        userId,
        fullName,
        phone,
        vehicle,
        license,
        experience: experience || 0,
        regions: JSON.stringify(regions || []),
        description: description || null,
        status: 'PENDING',
      },
    });

    return NextResponse.json(application);
  } catch (error) {
    console.error('Error creating transporter application:', error);
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
  }
}
