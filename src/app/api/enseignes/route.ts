import crypto from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { normalizeRole } from '@/lib/roles';
import { normalizeCommerceRegisterNumber } from '@/lib/validators';

type EnseigneRecord = {
  id: string;
  userId: string;
  businessName: string;
  legalName: string | null;
  website: string | null;
  logoUrl: string | null;
  monthlyVolume: number;
  billingEmail: string | null;
  operationalCity: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function findEnseigneByUserId(userId: string): Promise<EnseigneRecord | null> {
  try {
    const rows = await db.$queryRaw<EnseigneRecord[]>`
      SELECT
        "id", "userId", "businessName", "legalName", "website", "logoUrl",
        "monthlyVolume", "billingEmail", "operationalCity", "createdAt", "updatedAt"
      FROM "Enseigne"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;

    return rows[0] ?? null;
  } catch (error) {
    console.error('[api/enseignes] read failed', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionRole = normalizeRole(session.user.role);
  if (!['ENSEIGNE', 'ADMIN'].includes(sessionRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get('userId');

  const userId = sessionRole === 'ADMIN' && requestedUserId
    ? requestedUserId
    : session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const enseigne = await findEnseigneByUserId(userId);

  const [totalParcels, deliveredParcels, activeParcels, totalRevenue] = await Promise.all([
    db.colis.count({ where: { clientId: userId } }),
    db.colis.count({ where: { clientId: userId, status: 'LIVRE' } }),
    db.colis.count({
      where: {
        clientId: userId,
        status: { in: ['READY_FOR_DEPOSIT', 'PAID', 'DEPOSITED_RELAY', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION'] },
      },
    }),
    db.colis.aggregate({
      where: { clientId: userId, status: { in: ['READY_FOR_DEPOSIT', 'PAID', 'DEPOSITED_RELAY', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION', 'LIVRE'] } },
      _sum: { prixClient: true },
    }),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    enseigne: enseigne ?? null,
    metrics: {
      totalParcels,
      deliveredParcels,
      activeParcels,
      totalRevenue: totalRevenue._sum.prixClient ?? 0,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionRole = normalizeRole(session.user.role);
  if (!['ENSEIGNE', 'ADMIN'].includes(sessionRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    userId: rawUserId,
    businessName,
    legalName,
    website,
    logoUrl,
    monthlyVolume,
    billingEmail,
    operationalCity,
  } = body || {};

  const targetUserId = sessionRole === 'ADMIN' && typeof rawUserId === 'string' && rawUserId.trim()
    ? rawUserId.trim()
    : session.user.id;

  const normalizedBusinessName = String(businessName || '').trim();
  const normalizedLegalName = String(legalName || '').trim();
  const normalizedWebsite = String(website || '').trim();
  const normalizedLogoUrl = String(logoUrl || '').trim();
  const normalizedBillingEmail = String(billingEmail || '').trim().toLowerCase();
  const normalizedOperationalCity = String(operationalCity || '').trim();
  const parsedMonthlyVolume = Number.parseInt(String(monthlyVolume ?? 0), 10);

  if (!normalizedBusinessName || normalizedBusinessName.length < 2) {
    return NextResponse.json({ error: 'Nom commercial invalide (minimum 2 caracteres)' }, { status: 400 });
  }

  if (normalizedWebsite && !isValidUrl(normalizedWebsite)) {
    return NextResponse.json({ error: 'Site web invalide (http/https requis)' }, { status: 400 });
  }

  if (normalizedLogoUrl && !isValidUrl(normalizedLogoUrl)) {
    return NextResponse.json({ error: 'URL du logo invalide (http/https requis)' }, { status: 400 });
  }

  if (normalizedBillingEmail && !isValidEmail(normalizedBillingEmail)) {
    return NextResponse.json({ error: 'Email de facturation invalide' }, { status: 400 });
  }

  if (!Number.isFinite(parsedMonthlyVolume) || parsedMonthlyVolume < 0 || parsedMonthlyVolume > 1000000) {
    return NextResponse.json({ error: 'Volume mensuel invalide' }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true, siret: true } });
  if (!user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const normalizedSiret = normalizeCommerceRegisterNumber(String(user.siret || ''));

  if (normalizedSiret) {
    const existingEnseigneWithSameRc = await db.enseigne.findFirst({
      where: {
        userId: { not: targetUserId },
        user: {
          siret: normalizedSiret,
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

    if (existingEnseigneWithSameRc) {
      return NextResponse.json(
        {
          error: 'Un profil enseigne existe deja avec ce numero RC/SIRET',
          code: 'DUPLICATE_ENSEIGNE_RC',
          details: {
            existingEnseigneId: existingEnseigneWithSameRc.id,
          },
        },
        { status: 409 }
      );
    }
  }

  try {
    await db.$executeRaw`
      INSERT INTO "Enseigne" (
        "id", "userId", "businessName", "legalName", "website", "logoUrl",
        "monthlyVolume", "billingEmail", "operationalCity", "createdAt", "updatedAt"
      ) VALUES (
        ${crypto.randomUUID()}, ${targetUserId}, ${normalizedBusinessName}, ${normalizedLegalName || null},
        ${normalizedWebsite || null}, ${normalizedLogoUrl || null}, ${parsedMonthlyVolume},
        ${normalizedBillingEmail || null}, ${normalizedOperationalCity || null}, NOW(), NOW()
      )
      ON CONFLICT ("userId")
      DO UPDATE SET
        "businessName" = EXCLUDED."businessName",
        "legalName" = EXCLUDED."legalName",
        "website" = EXCLUDED."website",
        "logoUrl" = EXCLUDED."logoUrl",
        "monthlyVolume" = EXCLUDED."monthlyVolume",
        "billingEmail" = EXCLUDED."billingEmail",
        "operationalCity" = EXCLUDED."operationalCity",
        "updatedAt" = NOW()
    `;

    const enseigne = await findEnseigneByUserId(targetUserId);

    return NextResponse.json({ success: true, enseigne });
  } catch (error) {
    console.error('[api/enseignes] save failed', error);
    return NextResponse.json(
      { error: 'Impossible d enregistrer le profil enseigne. Verifiez que la migration ENSEIGNE est bien appliquee.' },
      { status: 500 }
    );
  }
}
