import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { describeBlockedIdentity, findBlockedRelayIdentity } from '@/lib/banned-identities';
import { getClientIpFromHeaders } from '@/lib/request-ip';

function pickPrimaryRelais<
  T extends {
    status?: string | null;
    operationalStatus?: string | null;
    commerceName?: string | null;
    address?: string | null;
    ville?: string | null;
    commerceDocuments?: string | null;
    updatedAt?: Date | string | null;
    createdAt?: Date | string | null;
  }
>(
  relais: T[]
): T | null {
  if (!Array.isArray(relais) || relais.length === 0) return null;

  const hasDocuments = (value?: string | null) => {
    try {
      const docs = JSON.parse(value || '[]');
      return Array.isArray(docs) && docs.length > 0;
    } catch {
      return false;
    }
  };

  const isComplete = (item: T) => {
    return Boolean(
      item.commerceName?.trim() &&
      item.address?.trim() &&
      item.ville?.trim() &&
      hasDocuments(item.commerceDocuments)
    );
  };

  const score = (item: T) => {
    const completenessScore = isComplete(item) ? 1 : 0;
    const statusScore = item.status === 'APPROVED' ? 3 : item.status === 'PENDING' ? 2 : 1;
    const operationalScore = item.operationalStatus === 'ACTIF' ? 1 : 0;
    const updated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
    const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    return { completenessScore, statusScore, operationalScore, updated, created };
  };

  return [...relais].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sb.completenessScore !== sa.completenessScore) return sb.completenessScore - sa.completenessScore;
    if (sb.statusScore !== sa.statusScore) return sb.statusScore - sa.statusScore;
    if (sb.operationalScore !== sa.operationalScore) return sb.operationalScore - sa.operationalScore;
    if (sb.updated !== sa.updated) return sb.updated - sa.updated;
    return sb.created - sa.created;
  })[0];
}

// GET all relais or filter by userId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const ville = searchParams.get('ville');
    const userId = searchParams.get('userId');

    const isPublicApprovedLookup = status === 'APPROVED' && !userId;

    if (isPublicApprovedLookup) {
      const where: Record<string, unknown> = { status: 'APPROVED', operationalStatus: 'ACTIF' };
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
          operationalStatus: true,
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
        _count: {
          select: {
            parcelsDepart: true,
            parcelsArrivee: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if ((userId || auth.payload.role === 'RELAIS') && relais.length > 1) {
      const primaryRelais = pickPrimaryRelais(relais);
      if (primaryRelais) {
        return NextResponse.json([primaryRelais]);
      }
    }

    return NextResponse.json(relais);
  } catch (error) {
    console.error('Error fetching relais:', error);
    return NextResponse.json({ error: 'Failed to fetch relais' }, { status: 500 });
  }
}

// POST create relais registration
export async function POST(request: NextRequest) {
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.moderate);
  if (rateCheck.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  try {
    const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { userId, commerceName, address, ville, latitude, longitude, photos, commerceDocuments, commerceRegisterNumber } = body;
    const rcNumber = normalizeCommerceRegisterNumber(String(commerceRegisterNumber || ''));
    const serializedCommerceDocuments = Array.isArray(commerceDocuments)
      ? JSON.stringify(commerceDocuments)
      : null;
    const clientIp = getClientIpFromHeaders(request.headers);

    if (!userId || !commerceName || !address || !ville || !rcNumber) {
      return NextResponse.json({
        error: 'Missing required fields (numéro RC obligatoire)',
        code: 'MISSING_REQUIRED_FIELDS',
        fields: ['userId', 'commerceName', 'address', 'ville', 'commerceRegisterNumber'],
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

    if (auth.payload.role === 'RELAIS' && userId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      }, { status: 404 });
    }

    const blockedIdentity = await findBlockedRelayIdentity({
      email: targetUser?.email,
      siret: rcNumber,
      ip: clientIp,
    });

    if (blockedIdentity) {
      return NextResponse.json({
        error: 'Blocked identity',
        code: 'BANNED_IDENTITY',
        blockedType: blockedIdentity.type,
        details: describeBlockedIdentity(blockedIdentity),
      }, { status: 403 });
    }

    // Prevent duplicate relay applications across different accounts using the same RC/SIRET.
    const existingRelaisWithSameRc = await db.relais.findFirst({
      where: {
        userId: { not: userId },
        status: { in: ['PENDING', 'APPROVED'] },
        user: {
          siret: rcNumber,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingRelaisWithSameRc) {
      return NextResponse.json(
        {
          error: 'Un dossier relais existe déjà avec ce numéro RC/SIRET',
          code: 'DUPLICATE_RELAIS_RC',
          details: {
            existingRelaisId: existingRelaisWithSameRc.id,
            existingStatus: existingRelaisWithSameRc.status,
          },
        },
        { status: 409 }
      );
    }

    // Prevent collisions with active transporter applications using the same RC/SIRET.
    const existingTransporterWithSameRc = await db.transporterApplication.findFirst({
      where: {
        userId: { not: userId },
        status: { in: ['PENDING', 'APPROVED'] },
        user: {
          siret: rcNumber,
        },
      },
      select: {
        id: true,
        status: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingTransporterWithSameRc) {
      return NextResponse.json(
        {
          error: 'Ce numéro RC/SIRET est déjà utilisé par un transporteur actif',
          code: 'DUPLICATE_TRANSPORTER_RC',
          details: {
            existingTransporterApplicationId: existingTransporterWithSameRc.id,
            existingStatus: existingTransporterWithSameRc.status,
          },
        },
        { status: 409 }
      );
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
          // Keep approved dossiers approved; only non-approved dossiers go back to review.
          status: existingRelais.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
        },
      });

      await db.$executeRaw`
        UPDATE "Relais"
        SET "commerceDocuments" = ${serializedCommerceDocuments}
        WHERE "userId" = ${userId}
      `;

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

    await db.$executeRaw`
      UPDATE "Relais"
      SET "commerceDocuments" = ${serializedCommerceDocuments}
      WHERE "userId" = ${userId}
    `;

    return NextResponse.json(relais);
  } catch (error) {
    console.error('Error creating relais:', error);
    const details = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create relais', details }, { status: 500 });
  }
}
