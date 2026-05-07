import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

const SEO_ID = 'main-seo-settings';

const SeoSettingsSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(320),
  canonical: z.string().url(),
  robots: z.string().min(1).max(100),
});

type SeoRow = { id: string; title: string; description: string; canonical: string; robots: string; updatedAt: Date; createdAt: Date };

async function ensureSeoSettingsTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SeoSettings" (
      "id" TEXT NOT NULL DEFAULT 'main-seo-settings',
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "canonical" TEXT NOT NULL,
      "robots" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SeoSettings_pkey" PRIMARY KEY ("id")
    )
  `);
}

/**
 * GET /api/admin/seo-settings
 * Retourne les paramètres SEO principaux stockés en base.
 * Utilise $queryRaw pour être compatible avec l'instance PrismaClient en mémoire (hot-reload).
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    await ensureSeoSettingsTable();

    const rows = await db.$queryRaw<SeoRow[]>`
      SELECT id, title, description, canonical, robots, "updatedAt", "createdAt"
      FROM "SeoSettings"
      WHERE id = ${SEO_ID}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return NextResponse.json(null, { status: 200 });
    }
    return NextResponse.json(rows[0], { status: 200 });
  } catch (err) {
    console.error('[GET /api/admin/seo-settings]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/seo-settings
 * Enregistre (upsert) les paramètres SEO principaux en base.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SeoSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { title, description, canonical, robots } = parsed.data;

  try {
    await ensureSeoSettingsTable();

    const rows = await db.$queryRaw<SeoRow[]>`
      INSERT INTO "SeoSettings" (id, title, description, canonical, robots, "updatedAt", "createdAt")
      VALUES (${SEO_ID}, ${title}, ${description}, ${canonical}, ${robots}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            canonical = EXCLUDED.canonical,
            robots = EXCLUDED.robots,
            "updatedAt" = NOW()
      RETURNING id, title, description, canonical, robots, "updatedAt", "createdAt"
    `;
    return NextResponse.json(rows[0], { status: 200 });
  } catch (err) {
    console.error('[POST /api/admin/seo-settings]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

