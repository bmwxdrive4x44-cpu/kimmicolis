import { db } from '@/lib/db';
import { normalizeCommerceRegisterNumber } from '@/lib/validators';
import { normalizeIp } from '@/lib/request-ip';

const BANNED_RELAY_IDENTITIES_KEY = 'security.bannedRelayIdentities';

export type BannedIdentityType = 'EMAIL' | 'SIRET' | 'IP';

export type BannedIdentityRecord = {
  type: BannedIdentityType;
  value: string;
  sourceRelaisId: string | null;
  sourceUserId: string | null;
  reason: string;
  bannedAt: string;
};

type DbLike = {
  setting: {
    findUnique: typeof db.setting.findUnique;
    upsert: typeof db.setting.upsert;
  };
};

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

function normalizeSiret(value: string | null | undefined): string | null {
  const normalized = normalizeCommerceRegisterNumber(String(value || ''));
  return normalized || null;
}

function parseStoredRecords(raw: string | null | undefined): BannedIdentityRecord[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is BannedIdentityRecord => {
      return Boolean(
        entry &&
        typeof entry === 'object' &&
        ['EMAIL', 'SIRET', 'IP'].includes((entry as BannedIdentityRecord).type) &&
        typeof (entry as BannedIdentityRecord).value === 'string'
      );
    });
  } catch {
    return [];
  }
}

async function readBannedIdentityRecords(dbLike: DbLike = db): Promise<BannedIdentityRecord[]> {
  try {
    const setting = await dbLike.setting.findUnique({
      where: { key: BANNED_RELAY_IDENTITIES_KEY },
      select: { value: true },
    });

    return parseStoredRecords(setting?.value);
  } catch (error) {
    // This anti-fraud helper must not block authentication if DB is transiently unavailable.
    console.warn('[banned-identities] read skipped:', error);
    return [];
  }
}

async function writeBannedIdentityRecords(records: BannedIdentityRecord[], dbLike: DbLike = db) {
  await dbLike.setting.upsert({
    where: { key: BANNED_RELAY_IDENTITIES_KEY },
    update: { value: JSON.stringify(records) },
    create: { key: BANNED_RELAY_IDENTITIES_KEY, value: JSON.stringify(records) },
  });
}

export async function findBlockedRelayIdentity(
  identities: { email?: string | null; siret?: string | null; ip?: string | null },
  dbLike: DbLike = db
): Promise<BannedIdentityRecord | null> {
  const candidates = new Map<BannedIdentityType, string>();

  const email = normalizeEmail(identities.email);
  const siret = normalizeSiret(identities.siret);
  const ip = normalizeIp(identities.ip);

  if (email) candidates.set('EMAIL', email);
  if (siret) candidates.set('SIRET', siret);
  if (ip) candidates.set('IP', ip);

  if (candidates.size === 0) return null;

  const blockedRecords = await readBannedIdentityRecords(dbLike);
  return blockedRecords.find((record) => candidates.get(record.type) === record.value) ?? null;
}

export async function banRelayIdentities(
  identities: {
    email?: string | null;
    siret?: string | null;
    ip?: string | null;
    sourceRelaisId?: string | null;
    sourceUserId?: string | null;
    reason: string;
  },
  dbLike: DbLike = db
) {
  const existing = await readBannedIdentityRecords(dbLike);
  const merged = new Map<string, BannedIdentityRecord>(
    existing.map((record) => [`${record.type}:${record.value}`, record])
  );

  const candidates: Array<{ type: BannedIdentityType; value: string | null }> = [
    { type: 'EMAIL', value: normalizeEmail(identities.email) },
    { type: 'SIRET', value: normalizeSiret(identities.siret) },
    { type: 'IP', value: normalizeIp(identities.ip) },
  ];

  let added = 0;

  for (const candidate of candidates) {
    if (!candidate.value) continue;

    const key = `${candidate.type}:${candidate.value}`;
    if (merged.has(key)) continue;

    merged.set(key, {
      type: candidate.type,
      value: candidate.value,
      sourceRelaisId: identities.sourceRelaisId ?? null,
      sourceUserId: identities.sourceUserId ?? null,
      reason: identities.reason,
      bannedAt: new Date().toISOString(),
    });
    added += 1;
  }

  if (added > 0) {
    await writeBannedIdentityRecords(Array.from(merged.values()), dbLike);
  }

  return { added, total: merged.size };
}

export function describeBlockedIdentity(record: BannedIdentityRecord): string {
  switch (record.type) {
    case 'EMAIL':
      return 'Cette adresse email est bannie suite à la suspension d un point relais.';
    case 'SIRET':
      return 'Ce numéro RC/SIRET est banni suite à la suspension d un point relais.';
    case 'IP':
      return 'Cette adresse IP est bannie suite à la suspension d un point relais.';
    default:
      return 'Identité bannie.';
  }
}