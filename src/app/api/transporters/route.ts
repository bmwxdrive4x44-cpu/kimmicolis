import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { db } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { requireRole } from '@/lib/rbac';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

// GET all transporter applications
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const where: Prisma.TransporterApplicationWhereInput = {};
    if (status) where.status = status;
    if (userId) {
      if (auth.payload.role !== 'ADMIN' && userId !== auth.payload.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.userId = userId;
    } else if (auth.payload.role === 'TRANSPORTER') {
      where.userId = auth.payload.id;
    }

    const applications = await db.transporterApplication.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, siret: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error('Error fetching transporter applications:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to fetch applications') }, { status: 500 });
  }
}

// POST create transporter application
export async function POST(request: NextRequest) {
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.moderate);
  if (rateCheck.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  try {
    const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { userId, fullName, phone, vehicle, license, commerceRegisterNumber, experience, regions, description, documents } = body;
    const rcNumber = normalizeCommerceRegisterNumber(String(commerceRegisterNumber || ''));
    const serializedDocuments = Array.isArray(documents)
      ? JSON.stringify(documents)
      : typeof documents === 'string'
        ? documents
        : null;

    if (!userId || !fullName || !phone || !vehicle || !license || !rcNumber) {
      return NextResponse.json({
        error: 'Missing required fields (numéro RC obligatoire)',
        code: 'MISSING_REQUIRED_FIELDS',
        fields: ['userId', 'fullName', 'phone', 'vehicle', 'license', 'commerceRegisterNumber'],
      }, { status: 400 });
    }

    if (!isAlgerianCommerceRegisterNumber(rcNumber)) {
      return NextResponse.json({
        error: 'Invalid commerce register number format',
        code: 'INVALID_COMMERCE_REGISTER_NUMBER',
        field: 'commerceRegisterNumber',
        details: 'Format RC algérien invalide (ex: RC-16/1234567B21)',
      }, { status: 400 });
    }

    if (auth.payload.role === 'TRANSPORTER' && userId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      }, { status: 404 });
    }

    // Check if RC number already used by another active transporter
    const existingTransporterWithSameRc = await db.transporterApplication.findFirst({
      where: {
        userId: { not: userId },
        status: { in: ['PENDING', 'APPROVED'] },
        user: { siret: rcNumber },
      },
    });
    if (existingTransporterWithSameRc) {
      return NextResponse.json({
        error: 'Ce numéro RC est déjà utilisé par un autre transporteur actif.',
        code: 'DUPLICATE_TRANSPORTER_RC',
        field: 'commerceRegisterNumber',
      }, { status: 409 });
    }

    const existingRelaisWithSameRc = await db.relais.findFirst({
      where: {
        userId: { not: userId },
        status: { in: ['PENDING', 'APPROVED'] },
        user: { siret: rcNumber },
      },
      select: { id: true, status: true },
    });

    if (existingRelaisWithSameRc) {
      return NextResponse.json({
        error: 'Ce numéro RC est déjà utilisé par un relais actif.',
        code: 'DUPLICATE_RELAIS_RC',
        field: 'commerceRegisterNumber',
      }, { status: 409 });
    }

    // Check if already applied
    const existing = await db.transporterApplication.findUnique({ where: { userId } });
    if (existing) {
      return NextResponse.json({
        error: 'Application already submitted',
        code: 'APPLICATION_ALREADY_SUBMITTED',
      }, { status: 409 });
    }

    const application = await db.transporterApplication.create({
      data: {
        userId,
        fullName,
        phone,
        vehicle,
        license,
        experience: experience || 0,
        regions: Array.isArray(regions) ? JSON.stringify(regions) : typeof regions === 'string' ? regions : '[]',
        description: description || null,
        status: 'PENDING',
      },
    });

    await db.$executeRaw`
      UPDATE "TransporterApplication"
      SET "documents" = ${serializedDocuments}
      WHERE "id" = ${application.id}
    `;

    await db.user.update({
      where: { id: userId },
      data: { siret: rcNumber },
    });

    return NextResponse.json(application);
  } catch (error) {
    console.error('Error creating transporter application:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to create application') }, { status: 500 });
  }
}
