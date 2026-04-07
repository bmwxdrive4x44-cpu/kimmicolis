import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

type EnseignePreset = {
  id: string;
  label: string;
  villeDepart: string;
  villeArrivee: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  createdAt: string;
};

const PRESETS_LIMIT = 20;

function presetKey(userId: string) {
  return `enseigne:presets:${userId}`;
}

async function readPresets(userId: string): Promise<EnseignePreset[]> {
  const setting = await db.setting.findUnique({ where: { key: presetKey(userId) } });
  if (!setting?.value) return [];
  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePresets(userId: string, presets: EnseignePreset[]) {
  const value = JSON.stringify(presets.slice(0, PRESETS_LIMIT));
  await db.setting.upsert({
    where: { key: presetKey(userId) },
    update: { value },
    create: { key: presetKey(userId), value },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ENSEIGNE', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get('userId');
  const userId = auth.payload.role === 'ADMIN' && requestedUserId ? requestedUserId : auth.payload.id;

  const presets = await readPresets(userId);
  return NextResponse.json({ presets });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ENSEIGNE', 'ADMIN']);
  if (!auth.success) return auth.response;

  const body = await request.json();
  const {
    userId: rawUserId,
    id,
    label,
    villeDepart,
    villeArrivee,
    relaisDepartId,
    relaisArriveeId,
  } = body || {};

  const userId = auth.payload.role === 'ADMIN' && typeof rawUserId === 'string' && rawUserId
    ? rawUserId
    : auth.payload.id;

  if (!label || !villeDepart || !villeArrivee || !relaisDepartId || !relaisArriveeId) {
    return NextResponse.json({ error: 'Preset incomplet' }, { status: 400 });
  }

  const presets = await readPresets(userId);
  const presetId = typeof id === 'string' && id.trim() ? id.trim() : `${userId}-${Date.now()}`;

  const next: EnseignePreset = {
    id: presetId,
    label: String(label).trim(),
    villeDepart: String(villeDepart).trim(),
    villeArrivee: String(villeArrivee).trim(),
    relaisDepartId: String(relaisDepartId).trim(),
    relaisArriveeId: String(relaisArriveeId).trim(),
    createdAt: new Date().toISOString(),
  };

  const withoutCurrent = presets.filter((p) => p.id !== presetId);
  const updated = [next, ...withoutCurrent].slice(0, PRESETS_LIMIT);

  await writePresets(userId, updated);
  return NextResponse.json({ presets: updated });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ['ENSEIGNE', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const requestedUserId = searchParams.get('userId');

  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const userId = auth.payload.role === 'ADMIN' && requestedUserId ? requestedUserId : auth.payload.id;
  const presets = await readPresets(userId);
  const updated = presets.filter((p) => p.id !== id);
  await writePresets(userId, updated);

  return NextResponse.json({ presets: updated });
}
