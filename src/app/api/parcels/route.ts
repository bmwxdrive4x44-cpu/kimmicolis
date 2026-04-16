import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateTrackingNumber } from '@/lib/constants';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { requireRole, verifyJWT } from '@/lib/rbac';
import { generateQRCodeImage } from '@/lib/qrcode';
import { calculateDynamicParcelPricing, estimateSafeDistanceKmByWilayas } from '@/lib/pricing';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';
import { getImplicitLoyaltyConfig } from '@/lib/loyalty-config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { findActiveLineByCities } from '@/lib/logistics';
import { generateWithdrawalPin, calculateQRExpiration } from '@/lib/qr-security';
import { checkRelayTrialQuota } from '@/lib/relais-trial';

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '').replace(/[^+\d]/g, '');
}

function isValidPhone(value: string): boolean {
  return /^\+?\d{8,15}$/.test(value);
}

function normalizeOptionalEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function hashWithdrawalCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateWithdrawalCode(length: 4 | 6 = 6): string {
  const min = length === 4 ? 1000 : 100000;
  const max = length === 4 ? 9999 : 999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function inferLegacyParcelFormat(weightKg: number): 'PETIT' | 'MOYEN' | 'GROS' {
  if (weightKg <= 1) return 'PETIT';
  if (weightKg <= 5) return 'MOYEN';
  return 'GROS';
}

function shouldFallbackToUltraLegacy(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  const code = String((error as any).code);
  // P2022: colonne absente ; P2010: échec SQL brut (souvent colonne/contrainte côté schéma legacy)
  return code === 'P2022' || code === 'P2010';
}

type LegacyColisRecord = {
  id: string;
  trackingNumber: string;
  clientId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  villeDepart: string;
  villeArrivee: string;
  status: string;
  prixClient: number;
  createdAt: Date;
};

type ColisColumnMeta = {
  column_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

let colisColumnMetaCache: ColisColumnMeta[] | null = null;

async function getColisColumnMeta(): Promise<ColisColumnMeta[]> {
  if (colisColumnMetaCache) {
    return colisColumnMetaCache;
  }

  const rows = await db.$queryRaw<ColisColumnMeta[]>`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Colis'
    ORDER BY ordinal_position
  `;

  colisColumnMetaCache = rows;
  return rows;
}

function buildLegacyColisReturning(meta: ColisColumnMeta[]): string {
  const available = new Set(meta.map((column) => column.column_name));
  const returning = [
    '"id"',
    '"trackingNumber"',
    '"clientId"',
    '"relaisDepartId"',
    '"relaisArriveeId"',
    '"villeDepart"',
    '"villeArrivee"',
    '"status"',
    '"prixClient"',
  ];

  if (available.has('createdAt')) {
    returning.push('"createdAt"');
  } else if (available.has('dateCreation')) {
    returning.push('"dateCreation" AS "createdAt"');
  } else {
    returning.push('NOW() AS "createdAt"');
  }

  return returning.join(', ');
}

async function createAdaptiveLegacyColisRaw(data: {
  trackingNumber: string;
  clientId: string;
  lineId?: string;
  senderFirstName?: string;
  senderLastName?: string;
  senderPhone?: string;
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  recipientEmail?: string | null;
  withdrawalCodeHash?: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  villeDepart: string;
  villeArrivee: string;
  format?: 'PETIT' | 'MOYEN' | 'GROS';
  weight?: number;
  description?: string | null;
  prixClient: number;
  commissionPlateforme: number;
  commissionRelais: number;
  netTransporteur: number;
  qrCode: string;
  status: string;
  dateLimit?: Date;
  qrToken?: string;
  withdrawalPin?: string;
  qrExpiresAt?: Date;
  custody?: string;
  expectedDeliveryAt?: Date;
  labelPrintMode?: string;
}) {
  const meta = await getColisColumnMeta();
  const available = new Set(meta.map((column) => column.column_name));
  const now = new Date();
  const valuesByColumn: Record<string, unknown> = {
    id: randomUUID(),
    trackingNumber: data.trackingNumber,
    clientId: data.clientId,
    lineId: data.lineId,
    senderFirstName: data.senderFirstName,
    senderLastName: data.senderLastName,
    senderPhone: data.senderPhone,
    recipientFirstName: data.recipientFirstName,
    recipientLastName: data.recipientLastName,
    recipientPhone: data.recipientPhone,
    recipientEmail: data.recipientEmail,
    withdrawalCodeHash: data.withdrawalCodeHash,
    relaisDepartId: data.relaisDepartId,
    relaisArriveeId: data.relaisArriveeId,
    villeDepart: data.villeDepart,
    villeArrivee: data.villeArrivee,
    format: data.format,
    weight: data.weight,
    description: data.description ?? null,
    prixClient: data.prixClient,
    commissionPlateforme: data.commissionPlateforme,
    commissionRelais: data.commissionRelais,
    netTransporteur: data.netTransporteur,
    qrCode: data.qrCode,
    status: data.status,
    dateLimit: data.dateLimit,
    dateCreation: now,
    createdAt: now,
    updatedAt: now,
    qrToken: data.qrToken,
    withdrawalPin: data.withdrawalPin,
    qrExpiresAt: data.qrExpiresAt,
    custody: data.custody,
    expectedDeliveryAt: data.expectedDeliveryAt,
    labelPrintMode: data.labelPrintMode,
  };

  const columns = meta
    .map((column) => column.column_name)
    .filter((columnName) => available.has(columnName) && valuesByColumn[columnName] !== undefined);

  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values = columns.map((columnName) => valuesByColumn[columnName]);
  const query = `
    INSERT INTO "Colis" (${columns.map((columnName) => `"${columnName}"`).join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${buildLegacyColisReturning(meta)}
  `;

  const rows = await db.$queryRawUnsafe<LegacyColisRecord[]>(query, ...values);
  return rows[0];
}

async function updateAdaptiveLegacyColisQrRaw(colisId: string, qrCode: string, qrCodeImage: string | null) {
  const meta = await getColisColumnMeta();
  const available = new Set(meta.map((column) => column.column_name));
  const sets: string[] = [];
  const values: unknown[] = [];

  sets.push(`"qrCode" = $${values.length + 1}`);
  values.push(qrCode);

  if (available.has('qrCodeImage')) {
    sets.push(`"qrCodeImage" = $${values.length + 1}`);
    values.push(qrCodeImage);
  }

  if (available.has('updatedAt')) {
    sets.push(`"updatedAt" = $${values.length + 1}`);
    values.push(new Date());
  }

  values.push(colisId);

  const query = `
    UPDATE "Colis"
    SET ${sets.join(', ')}
    WHERE "id" = $${values.length}
    RETURNING ${buildLegacyColisReturning(meta)}
  `;

  const rows = await db.$queryRawUnsafe<LegacyColisRecord[]>(query, ...values);
  return rows[0];
}

async function createLegacyColisRaw(data: {
  trackingNumber: string;
  clientId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  villeDepart: string;
  villeArrivee: string;
  format: 'PETIT' | 'MOYEN' | 'GROS';
  weight: number;
  description: string | null;
  prixClient: number;
  commissionPlateforme: number;
  commissionRelais: number;
  netTransporteur: number;
  qrCode: string;
  status: string;
  dateLimit: Date;
}) {
  const id = randomUUID();
  const rows = await db.$queryRaw<LegacyColisRecord[]>`
    INSERT INTO "Colis" (
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "format",
      "weight",
      "description",
      "prixClient",
      "commissionPlateforme",
      "commissionRelais",
      "netTransporteur",
      "qrCode",
      "status",
      "dateLimit",
      "updatedAt"
    ) VALUES (
      ${id},
      ${data.trackingNumber},
      ${data.clientId},
      ${data.relaisDepartId},
      ${data.relaisArriveeId},
      ${data.villeDepart},
      ${data.villeArrivee},
      ${data.format},
      ${data.weight},
      ${data.description},
      ${data.prixClient},
      ${data.commissionPlateforme},
      ${data.commissionRelais},
      ${data.netTransporteur},
      ${data.qrCode},
      ${data.status},
      ${data.dateLimit},
      NOW()
    )
    RETURNING
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "status",
      "prixClient",
      "createdAt"
  `;

  return rows[0];
}

async function createLegacyColisRawWithLineId(data: {
  trackingNumber: string;
  clientId: string;
  lineId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  villeDepart: string;
  villeArrivee: string;
  format: 'PETIT' | 'MOYEN' | 'GROS';
  weight: number;
  description: string | null;
  prixClient: number;
  commissionPlateforme: number;
  commissionRelais: number;
  netTransporteur: number;
  qrCode: string;
  status: string;
  dateLimit: Date;
}) {
  const id = randomUUID();
  const rows = await db.$queryRaw<LegacyColisRecord[]>`
    INSERT INTO "Colis" (
      "id",
      "trackingNumber",
      "clientId",
      "lineId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "format",
      "weight",
      "description",
      "prixClient",
      "commissionPlateforme",
      "commissionRelais",
      "netTransporteur",
      "qrCode",
      "status",
      "dateLimit",
      "updatedAt"
    ) VALUES (
      ${id},
      ${data.trackingNumber},
      ${data.clientId},
      ${data.lineId},
      ${data.relaisDepartId},
      ${data.relaisArriveeId},
      ${data.villeDepart},
      ${data.villeArrivee},
      ${data.format},
      ${data.weight},
      ${data.description},
      ${data.prixClient},
      ${data.commissionPlateforme},
      ${data.commissionRelais},
      ${data.netTransporteur},
      ${data.qrCode},
      ${data.status},
      ${data.dateLimit},
      NOW()
    )
    RETURNING
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "status",
      "prixClient",
      "createdAt"
  `;

  return rows[0];
}

async function createUltraLegacyColisRaw(data: {
  trackingNumber: string;
  clientId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  villeDepart: string;
  villeArrivee: string;
  format: 'PETIT' | 'MOYEN' | 'GROS';
  prixClient: number;
  commissionPlateforme: number;
  commissionRelais: number;
  netTransporteur: number;
  qrCode: string;
  status: string;
}) {
  const id = randomUUID();
  const now = new Date();
  const rows = await db.$queryRaw<LegacyColisRecord[]>`
    INSERT INTO "Colis" (
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "format",
      "prixClient",
      "commissionPlateforme",
      "commissionRelais",
      "netTransporteur",
      "qrCode",
      "status",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${data.trackingNumber},
      ${data.clientId},
      ${data.relaisDepartId},
      ${data.relaisArriveeId},
      ${data.villeDepart},
      ${data.villeArrivee},
      ${data.format},
      ${data.prixClient},
      ${data.commissionPlateforme},
      ${data.commissionRelais},
      ${data.netTransporteur},
      ${data.qrCode},
      ${data.status},
      ${now},
      ${now}
    )
    RETURNING
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "status",
      "prixClient",
      "createdAt"
  `;

  return rows[0];
}

async function createUltraLegacyColisRawWithLineId(data: {
  trackingNumber: string;
  clientId: string;
  lineId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  villeDepart: string;
  villeArrivee: string;
  format: 'PETIT' | 'MOYEN' | 'GROS';
  prixClient: number;
  commissionPlateforme: number;
  commissionRelais: number;
  netTransporteur: number;
  qrCode: string;
  status: string;
}) {
  const id = randomUUID();
  const now = new Date();
  const rows = await db.$queryRaw<LegacyColisRecord[]>`
    INSERT INTO "Colis" (
      "id",
      "trackingNumber",
      "clientId",
      "lineId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "format",
      "prixClient",
      "commissionPlateforme",
      "commissionRelais",
      "netTransporteur",
      "qrCode",
      "status",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${data.trackingNumber},
      ${data.clientId},
      ${data.lineId},
      ${data.relaisDepartId},
      ${data.relaisArriveeId},
      ${data.villeDepart},
      ${data.villeArrivee},
      ${data.format},
      ${data.prixClient},
      ${data.commissionPlateforme},
      ${data.commissionRelais},
      ${data.netTransporteur},
      ${data.qrCode},
      ${data.status},
      ${now},
      ${now}
    )
    RETURNING
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "status",
      "prixClient",
      "createdAt"
  `;

  return rows[0];
}

async function createUltraLegacyColisRawNoFormat(data: {
  trackingNumber: string;
  clientId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  villeDepart: string;
  villeArrivee: string;
  prixClient: number;
  commissionPlateforme: number;
  commissionRelais: number;
  netTransporteur: number;
  qrCode: string;
  status: string;
}) {
  const id = randomUUID();
  const now = new Date();
  const rows = await db.$queryRaw<LegacyColisRecord[]>`
    INSERT INTO "Colis" (
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "prixClient",
      "commissionPlateforme",
      "commissionRelais",
      "netTransporteur",
      "qrCode",
      "status",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${data.trackingNumber},
      ${data.clientId},
      ${data.relaisDepartId},
      ${data.relaisArriveeId},
      ${data.villeDepart},
      ${data.villeArrivee},
      ${data.prixClient},
      ${data.commissionPlateforme},
      ${data.commissionRelais},
      ${data.netTransporteur},
      ${data.qrCode},
      ${data.status},
      ${now},
      ${now}
    )
    RETURNING
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "status",
      "prixClient",
      "createdAt"
  `;

  return rows[0];
}

async function createUltraLegacyColisRawNoFormatWithLineId(data: {
  trackingNumber: string;
  clientId: string;
  lineId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  villeDepart: string;
  villeArrivee: string;
  prixClient: number;
  commissionPlateforme: number;
  commissionRelais: number;
  netTransporteur: number;
  qrCode: string;
  status: string;
}) {
  const id = randomUUID();
  const now = new Date();
  const rows = await db.$queryRaw<LegacyColisRecord[]>`
    INSERT INTO "Colis" (
      "id",
      "trackingNumber",
      "clientId",
      "lineId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "prixClient",
      "commissionPlateforme",
      "commissionRelais",
      "netTransporteur",
      "qrCode",
      "status",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${data.trackingNumber},
      ${data.clientId},
      ${data.lineId},
      ${data.relaisDepartId},
      ${data.relaisArriveeId},
      ${data.villeDepart},
      ${data.villeArrivee},
      ${data.prixClient},
      ${data.commissionPlateforme},
      ${data.commissionRelais},
      ${data.netTransporteur},
      ${data.qrCode},
      ${data.status},
      ${now},
      ${now}
    )
    RETURNING
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "status",
      "prixClient",
      "createdAt"
  `;

  return rows[0];
}

async function updateLegacyColisQrRaw(colisId: string, qrCode: string, qrCodeImage: string | null) {
  const rows = await db.$queryRaw<LegacyColisRecord[]>`
    UPDATE "Colis"
    SET
      "qrCode" = ${qrCode},
      "qrCodeImage" = ${qrCodeImage}
    WHERE "id" = ${colisId}
    RETURNING
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "status",
      "prixClient",
      "createdAt"
  `;

  return rows[0];
}

async function updateUltraLegacyColisQrRaw(colisId: string, qrCode: string) {
  const rows = await db.$queryRaw<LegacyColisRecord[]>`
    UPDATE "Colis"
    SET "qrCode" = ${qrCode}
    WHERE "id" = ${colisId}
    RETURNING
      "id",
      "trackingNumber",
      "clientId",
      "relaisDepartId",
      "relaisArriveeId",
      "villeDepart",
      "villeArrivee",
      "status",
      "prixClient",
      "createdAt"
  `;

  return rows[0];
}

function parseVillesEtapes(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];

  const raw = value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // fallback CSV
  }

  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function trajetSupportsParcel(
  trajet: { villeDepart: string; villeArrivee: string; villesEtapes?: unknown },
  parcel: { villeDepart: string; villeArrivee: string }
) {
  const itinerary = [trajet.villeDepart, ...parseVillesEtapes(trajet.villesEtapes), trajet.villeArrivee];
  const depIndex = itinerary.indexOf(parcel.villeDepart);
  const arrIndex = itinerary.indexOf(parcel.villeArrivee);
  return depIndex >= 0 && arrIndex > depIndex;
}

function isRelayVisibleToExternal(relay: { status?: string | null; operationalStatus?: string | null } | null | undefined) {
  return Boolean(relay && relay.status === 'APPROVED' && relay.operationalStatus !== 'SUSPENDU');
}

function sanitizeRelayForExternal<T>(relay: T & { status?: string | null; operationalStatus?: string | null } | null | undefined) {
  if (!relay) return null;
  return isRelayVisibleToExternal(relay) ? relay : null;
}

function sanitizeParcelRelaysForExternal<T extends { relaisDepart?: any; relaisArrivee?: any }>(parcel: T): T {
  return {
    ...parcel,
    relaisDepart: sanitizeRelayForExternal(parcel.relaisDepart),
    relaisArrivee: sanitizeRelayForExternal(parcel.relaisArrivee),
  };
}

async function getPricingConfig() {
  const keys = [
    'pricingAdminFee',
    'pricingRatePerKg',
    'pricingRatePerKm',
    'pricingRelayDepartureRate',
    'pricingRelayArrivalRate',
    'pricingRelayPrintFee',
    'pricingRoundTo',
    'platformCommission',
  ];

  const settings = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const getNumber = (key: string, fallback: number) => {
    const value = Number(map.get(key));
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    adminFee: getNumber('pricingAdminFee', 50),
    ratePerKg: getNumber('pricingRatePerKg', 120),
    ratePerKm: getNumber('pricingRatePerKm', 2.5),
    relayDepartureRate: getNumber('pricingRelayDepartureRate', 0.1),
    relayArrivalRate: getNumber('pricingRelayArrivalRate', 0.1),
    relayPrintFee: getNumber('pricingRelayPrintFee', 30),
    roundTo: getNumber('pricingRoundTo', 10),
    platformCommissionRate: getNumber('platformCommission', 10) / 100,
  };
}

// GET all parcels
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const available = searchParams.get('available'); // "true" = show available for transport
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');
  const tracking = searchParams.get('tracking');

  try {
    // Public tracking lookup: limited data only
    if (tracking && !clientId && !status && available !== 'true') {
      const parcels = await db.colis.findMany({
        where: { trackingNumber: tracking },
        select: {
          id: true,
          trackingNumber: true,
          villeDepart: true,
          villeArrivee: true,
          weight: true,
          status: true,
          createdAt: true,
          relaisDepart: {
            select: { commerceName: true, status: true, operationalStatus: true },
          },
          relaisArrivee: {
            select: { commerceName: true, status: true, operationalStatus: true },
          },
          trackingHistory: {
            select: { status: true, notes: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(parcels.map((parcel) => sanitizeParcelRelaysForExternal(parcel)));
    }

    const auth = await requireRole(request, ['CLIENT', 'RELAIS', 'TRANSPORTER', 'ADMIN']);
    if (!auth.success) return auth.response;
    const { payload } = auth;

    const where: Record<string, unknown> = {};

    if (clientId) {
      if (payload.role === 'CLIENT' && clientId !== payload.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.clientId = clientId;
    } else if (payload.role === 'CLIENT') {
      where.clientId = payload.id;
    }
    if (status) {
      where.status = status;
    } else if (available === 'true') {
      // Show parcels available for transport: deposited at relay (new + legacy statuses)
      where.status = { in: ['DEPOSITED_RELAY', 'WAITING_PICKUP', 'READY_FOR_DEPOSIT', 'RECU_RELAIS', 'PAID_RELAY'] };
      // Only parcels without an active mission
      where.missions = { none: { status: { in: ['ASSIGNE', 'EN_COURS'] } } };
      where.lineId = { not: null };
      where.relaisDepart = { is: { status: 'APPROVED', operationalStatus: 'ACTIF' } };
      where.relaisArrivee = { is: { status: 'APPROVED', operationalStatus: 'ACTIF' } };
    }
    if (tracking) {
      where.trackingNumber = tracking;
    }

    let parcels: any[] = [];
    try {
      parcels = await db.colis.findMany({
        where,
        include: {
          line: true,
          client: {
            select: { id: true, name: true, email: true, phone: true },
          },
          relaisDepart: {
            include: { user: { select: { name: true, phone: true } } },
          },
          relaisArrivee: {
            include: { user: { select: { name: true, phone: true } } },
          },
          missions: {
            include: {
              transporteur: { select: { id: true, name: true, phone: true } },
            },
          },
          trackingHistory: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      }) as any[];
    } catch (queryError) {
      console.warn('[api/parcels] full query failed, using compatibility fallback:', queryError);
      parcels = await db.colis.findMany({
        where,
        select: {
          id: true,
          trackingNumber: true,
          clientId: true,
          relaisDepartId: true,
          relaisArriveeId: true,
          villeDepart: true,
          villeArrivee: true,
          weight: true,
          description: true,
          status: true,
          prixClient: true,
          createdAt: true,
          dateLimit: true,
          qrCodeImage: true,
          recipientFirstName: true,
          recipientLastName: true,
          recipientPhone: true,
          recipientEmail: true,
          relaisDepart: {
            select: {
              id: true,
              commerceName: true,
              address: true,
              ville: true,
              status: true,
              operationalStatus: true,
              user: { select: { name: true, phone: true } },
            },
          },
          relaisArrivee: {
            select: {
              id: true,
              commerceName: true,
              address: true,
              ville: true,
              status: true,
              operationalStatus: true,
              user: { select: { name: true, phone: true } },
            },
          },
          trackingHistory: {
            select: {
              id: true,
              status: true,
              notes: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }) as any[];
    }

    const parcelsForExternalRoles = payload.role === 'CLIENT' || payload.role === 'TRANSPORTER'
      ? parcels.map((parcel) => sanitizeParcelRelaysForExternal(parcel))
      : parcels;

    if (available === 'true' && payload.role === 'TRANSPORTER') {
      const futureTrajets = await db.trajet.findMany({
        where: {
          transporteurId: payload.id,
          status: 'PROGRAMME',
          dateDepart: { gte: new Date() },
        },
        select: { lineId: true, villeDepart: true, villeArrivee: true, villesEtapes: true },
      });

      return NextResponse.json(
        parcelsForExternalRoles.filter((parcel) =>
          futureTrajets.some((trajet) => {
            if (parcel.lineId && trajet.lineId && parcel.lineId !== trajet.lineId) {
              return false;
            }

            return trajetSupportsParcel(trajet, parcel);
          })
        )
      );
    }

    return NextResponse.json(parcelsForExternalRoles);
  } catch (error) {
    console.error('Error fetching parcels:', error);

    // Keep a stable array shape for client-scoped list requests.
    if (available === 'true' || Boolean(clientId)) {
      return NextResponse.json([]);
    }

    return NextResponse.json({ error: 'Failed to fetch parcels' }, { status: 500 });
  }
}

// POST create parcel
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { payload } = auth;

  // Rate limit: 30 requests per minute per user
  const rateLimitResult = await checkRateLimit(
    request,
    RATE_LIMIT_PRESETS.moderate,
    payload?.id
  );

  if (rateLimitResult.limited) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please slow down.',
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
        },
      }
    );
  }

  let errorStep = 'INIT';
  const badRequest = (code: string, error: string, details?: string) =>
    NextResponse.json(
      {
        error,
        code,
        ...(details ? { details } : {}),
      },
      { status: 400 }
    );

  try {
    errorStep = 'PARSE_BODY';
    const body = await request.json();
    const {
      clientId,
      senderFirstName,
      senderLastName,
      senderPhone,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      recipientEmail,
      labelPrintMode,
      withdrawalCode,
      relaisDepartId,
      relaisArriveeId,
      villeDepart,
      villeArrivee,
      weight,
      description,
    } = body;

    if (payload.role === 'CLIENT' && clientId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (
      !senderFirstName?.trim() ||
      !senderLastName?.trim() ||
      !senderPhone?.trim() ||
      !recipientFirstName?.trim() ||
      !recipientLastName?.trim() ||
      !recipientPhone?.trim()
    ) {
      return badRequest('MISSING_CONTACT_FIELDS', 'Informations expéditeur/destinataire incomplètes');
    }

    const normalizedSenderPhone = normalizePhone(senderPhone);
    const normalizedRecipientPhone = normalizePhone(recipientPhone);
    if (!isValidPhone(normalizedSenderPhone) || !isValidPhone(normalizedRecipientPhone)) {
      const invalidFields = [
        !isValidPhone(normalizedSenderPhone) ? 'expediteur' : null,
        !isValidPhone(normalizedRecipientPhone) ? 'destinataire' : null,
      ].filter(Boolean).join(', ');

      return badRequest(
        'INVALID_PHONE',
        'Numéro de téléphone invalide',
        `Champ(s): ${invalidFields}. Format attendu: 8 a 15 chiffres, + autorise.`
      );
    }

    const normalizedRecipientEmail = normalizeOptionalEmail(recipientEmail);
    if (normalizedRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipientEmail)) {
      return badRequest('INVALID_RECIPIENT_EMAIL', 'Email destinataire invalide');
    }

    const parsedWeight = Number(weight ?? 0);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      return badRequest('INVALID_WEIGHT', 'Le poids du colis est obligatoire et doit être supérieur à 0 kg');
    }

    errorStep = 'RELAIS_VALIDATE';
    // Check if relais are operational (with compatibility fallback for older schemas)
    let relaisDepart: any;
    let relaisArrivee: any;
    try {
      [relaisDepart, relaisArrivee] = await Promise.all([
        db.relais.findUnique({ where: { id: relaisDepartId }, select: { ville: true, status: true, operationalStatus: true, suspensionReason: true } }),
        db.relais.findUnique({ where: { id: relaisArriveeId }, select: { ville: true, status: true, operationalStatus: true, suspensionReason: true } }),
      ]);
    } catch (relayQueryError) {
      console.warn('[api/parcels] relay operational select failed, retrying with minimal select:', relayQueryError);
      [relaisDepart, relaisArrivee] = await Promise.all([
        db.relais.findUnique({ where: { id: relaisDepartId }, select: { ville: true, status: true } }),
        db.relais.findUnique({ where: { id: relaisArriveeId }, select: { ville: true, status: true } }),
      ]);
    }

    if (!relaisDepart || relaisDepart.status !== 'APPROVED' || relaisDepart.operationalStatus === 'SUSPENDU') {
      return badRequest('RELAIS_DEPART_UNAVAILABLE', 'Relais de départ suspendu', relaisDepart?.suspensionReason || 'Raison non spécifiée');
    }

    if (!relaisArrivee || relaisArrivee.status !== 'APPROVED' || relaisArrivee.operationalStatus === 'SUSPENDU') {
      return badRequest('RELAIS_ARRIVEE_UNAVAILABLE', 'Relais d\'arrivée suspendu', relaisArrivee?.suspensionReason || 'Raison non spécifiée');
    }

    errorStep = 'TRIAL_QUOTA';
    let trialQuota: { limited: boolean; maxPerDay?: number } = { limited: false };
    try {
      trialQuota = await checkRelayTrialQuota({
        relaisId: relaisDepartId,
        additionalParcels: 1,
      });
    } catch (trialQuotaError) {
      console.warn('[api/parcels] relay trial quota check failed, bypassing quota gate:', trialQuotaError);
    }
    if (trialQuota.limited) {
      return badRequest(
        'RELAY_TRIAL_QUOTA_REACHED',
        'Relais en période d\'essai: quota quotidien atteint',
        `Maximum ${trialQuota.maxPerDay} colis/jour pendant l'essai`
      );
    }

    if (relaisDepart.ville !== villeDepart || relaisArrivee.ville !== villeArrivee) {
      return badRequest('RELAIS_CITY_MISMATCH', 'Les relais sélectionnés ne correspondent pas aux villes choisies');
    }

    errorStep = 'ACTIVE_LINE';
    const activeLine = await findActiveLineByCities(villeDepart, villeArrivee);
    if (!activeLine) {
      return badRequest('NO_ACTIVE_LINE', 'Aucune ligne active n\'est disponible pour cet itinéraire', `${villeDepart} -> ${villeArrivee}`);
    }

    const effectiveWithdrawalCode = String(withdrawalCode ?? generateWithdrawalCode(6));
    if (!/^\d{4}$|^\d{6}$/.test(effectiveWithdrawalCode)) {
      return badRequest('INVALID_WITHDRAWAL_CODE', 'Le code de retrait doit contenir 4 ou 6 chiffres');
    }

    const normalizedLabelPrintMode = String(labelPrintMode || 'HOME').toUpperCase();
    if (!['HOME', 'RELAY'].includes(normalizedLabelPrintMode)) {
      return badRequest('INVALID_LABEL_PRINT_MODE', 'Mode impression invalide (HOME ou RELAY)');
    }

    errorStep = 'PRICING';
    // Calculate prices: distance auto-estimated from departure/arrival wilayas
    const estimatedDistanceKm = estimateSafeDistanceKmByWilayas(villeDepart, villeArrivee);
    const pricingConfig = await getPricingConfig();
    const dynamic = calculateDynamicParcelPricing({
      weightKg: parsedWeight,
      distanceKm: estimatedDistanceKm,
      adminFee: pricingConfig.adminFee,
      ratePerKg: pricingConfig.ratePerKg,
      ratePerKm: pricingConfig.ratePerKm,
      formatMultiplier: 1,
      relayDepartureCommissionRate: pricingConfig.relayDepartureRate,
      relayArrivalCommissionRate: pricingConfig.relayArrivalRate,
      platformMarginRate: pricingConfig.platformCommissionRate,
      roundTo: pricingConfig.roundTo,
    });

    const relayPrintFee = normalizedLabelPrintMode === 'RELAY' ? pricingConfig.relayPrintFee : 0;
    const baseClientPriceWithPrint = dynamic.clientPrice + relayPrintFee;
    let eligibility = { eligible: false };
    let loyaltyConfig = { discountRate: 0 };
    try {
      eligibility = await evaluateImplicitProEligibility(clientId);
      loyaltyConfig = await getImplicitLoyaltyConfig();
    } catch (loyaltyError) {
      console.warn('[api/parcels] implicit-pro eligibility unavailable, continuing without discount:', loyaltyError);
    }
    const implicitDiscountRate = eligibility.eligible ? loyaltyConfig.discountRate : 0;
    const implicitDiscountAmount = Math.round(baseClientPriceWithPrint * implicitDiscountRate);
    const prixClient = baseClientPriceWithPrint - implicitDiscountAmount;
    const netTransporteur = dynamic.netTransporteur;
    const relayFee = dynamic.relayCommissionTotal + relayPrintFee;
    const platformFee = dynamic.platformMargin;
    const pricingBreakdown: Record<string, unknown> = {
      model: 'dynamic',
      ...dynamic,
      estimatedDistanceKm,
      labelPrintMode: normalizedLabelPrintMode,
      relayPrintFee,
      baseClientPrice: dynamic.clientPrice,
      baseClientPriceWithPrint,
      implicitProEligible: eligibility.eligible,
      implicitProDiscountRate: implicitDiscountRate,
      implicitProDiscountAmount: implicitDiscountAmount,
      finalClientPrice: prixClient,
    };

    errorStep = 'CREATE_PREPARE';
    // Generate tracking number and secure QR token
    const trackingNumber = generateTrackingNumber();
    const qrToken = randomBytes(24).toString('hex');
    const withdrawalPin = generateWithdrawalPin(); // 🔒 NEW: 4-digit PIN for security
    const qrExpiresAt = calculateQRExpiration(24); // 🔒 NEW: QR expires in 24 hours
    const expectedDeliveryAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const placeholderQrPayload = JSON.stringify({ token: qrToken });

    const minimalCreateData = {
      trackingNumber,
      clientId,
      lineId: activeLine.id,
      senderFirstName: senderFirstName.trim(),
      senderLastName: senderLastName.trim(),
      senderPhone: normalizedSenderPhone,
      recipientFirstName: recipientFirstName.trim(),
      recipientLastName: recipientLastName.trim(),
      recipientPhone: normalizedRecipientPhone,
      relaisDepartId,
      relaisArriveeId,
      villeDepart,
      villeArrivee,
      weight: parsedWeight,
      description,
      prixClient,
      commissionPlateforme: platformFee,
      commissionRelais: relayFee,
      netTransporteur,
      qrCode: placeholderQrPayload,
      status: 'CREATED',
      dateLimit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const baseCreateData = {
      ...minimalCreateData,
      recipientEmail: normalizedRecipientEmail,
      withdrawalCodeHash: hashWithdrawalCode(effectiveWithdrawalCode),
    };

    const createSelect = {
      id: true,
      trackingNumber: true,
      clientId: true,
      lineId: true,
      relaisDepartId: true,
      relaisArriveeId: true,
      villeDepart: true,
      villeArrivee: true,
      status: true,
      prixClient: true,
      createdAt: true,
    };
    const legacyCreateData = {
      trackingNumber,
      clientId,
      lineId: activeLine.id,
      relaisDepartId,
      relaisArriveeId,
      villeDepart,
      villeArrivee,
      format: inferLegacyParcelFormat(parsedWeight),
      weight: parsedWeight,
      description,
      prixClient,
      commissionPlateforme: platformFee,
      commissionRelais: relayFee,
      netTransporteur,
      qrCode: placeholderQrPayload,
      status: 'CREATED',
      dateLimit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    const ultraLegacyCreateData = {
      lineId: activeLine.id,
      commissionPlateforme: platformFee,
      commissionRelais: relayFee,
      netTransporteur,
      trackingNumber,
      clientId,
      relaisDepartId,
      relaisArriveeId,
      villeDepart,
      villeArrivee,
      format: inferLegacyParcelFormat(parsedWeight),
      prixClient,
      qrCode: placeholderQrPayload,
      status: 'CREATED',
    };

    errorStep = 'CREATE_COLIS';
    let createdColis;
    let isLegacySchema = false;
    try {
      createdColis = await db.colis.create({
        data: {
          ...baseCreateData,
          qrToken,
          withdrawalPin,
          qrExpiresAt,
          custody: 'CLIENT',
          expectedDeliveryAt,
        },
        select: createSelect,
      });
    } catch (createError) {
      console.warn('[api/parcels] full create failed, retrying with compatibility payload:', createError);
      try {
        createdColis = await db.colis.create({
          data: baseCreateData,
          select: createSelect,
        });
      } catch (compatCreateError) {
        console.warn('[api/parcels] compatibility create failed, retrying with minimal payload:', compatCreateError);
        try {
          createdColis = await db.colis.create({
            data: minimalCreateData,
            select: createSelect,
          });
        } catch (minimalCreateError) {
          console.warn('[api/parcels] minimal create failed, retrying with legacy schema payload:', minimalCreateError);
          isLegacySchema = true;
          const legacyRawAttempts: Array<{ name: string; run: () => Promise<any> }> = [
            {
              name: 'legacy schema payload',
              run: () => createLegacyColisRaw(legacyCreateData),
            },
            {
              name: 'legacy schema payload with lineId',
              run: () => createLegacyColisRawWithLineId(legacyCreateData),
            },
            {
              name: 'ultra-legacy payload',
              run: () => createUltraLegacyColisRaw(ultraLegacyCreateData),
            },
            {
              name: 'ultra-legacy payload with lineId',
              run: () => createUltraLegacyColisRawWithLineId(ultraLegacyCreateData),
            },
            {
              name: 'ultra-legacy payload without format column',
              run: () => createUltraLegacyColisRawNoFormat(ultraLegacyCreateData),
            },
            {
              name: 'ultra-legacy payload without format column with lineId',
              run: () => createUltraLegacyColisRawNoFormatWithLineId(ultraLegacyCreateData),
            },
            {
              name: 'adaptive legacy payload (information_schema)',
              run: () => createAdaptiveLegacyColisRaw({
                ...baseCreateData,
                qrToken,
                withdrawalPin,
                qrExpiresAt,
                custody: 'CLIENT',
                expectedDeliveryAt,
                labelPrintMode: normalizedLabelPrintMode,
                format: inferLegacyParcelFormat(parsedWeight),
                dateLimit: minimalCreateData.dateLimit,
              }),
            },
          ];

          let legacyError: unknown = minimalCreateError;

          for (const attempt of legacyRawAttempts) {
            if (!shouldFallbackToUltraLegacy(legacyError)) {
              throw legacyError;
            }

            try {
              createdColis = await attempt.run();
              legacyError = null;
              break;
            } catch (attemptError) {
              console.warn(`[api/parcels] ${attempt.name} failed, trying next fallback:`, attemptError);
              legacyError = attemptError;
            }
          }

          if (!createdColis) {
            throw legacyError;
          }
        }
      }
    }

    errorStep = 'QR_GENERATE';
    const secureQrPayload = JSON.stringify({
      parcelId: createdColis.id,
      token: qrToken,
      tracking: trackingNumber,
      pin: withdrawalPin, // Include PIN in QR payload
      expiresAt: qrExpiresAt.toISOString(),
    });
    let qrCodeImage = '';
    try {
      qrCodeImage = await generateQRCodeImage(secureQrPayload);
    } catch (qrError) {
      console.warn('[api/parcels] QR image generation failed, continuing without image:', qrError);
    }

    errorStep = 'UPDATE_COLIS_QR';
    let colis;
    try {
      if (isLegacySchema) {
        try {
          colis = await updateLegacyColisQrRaw(createdColis.id, secureQrPayload, qrCodeImage || null);
        } catch (legacyUpdateError) {
          if (shouldFallbackToUltraLegacy(legacyUpdateError)) {
            try {
              colis = await updateUltraLegacyColisQrRaw(createdColis.id, secureQrPayload);
            } catch (ultraLegacyUpdateError) {
              if (shouldFallbackToUltraLegacy(ultraLegacyUpdateError)) {
                colis = await updateAdaptiveLegacyColisQrRaw(createdColis.id, secureQrPayload, qrCodeImage || null);
              } else {
                throw ultraLegacyUpdateError;
              }
            }
          } else {
            throw legacyUpdateError;
          }
        }
      } else {
      colis = await db.colis.update({
        where: { id: createdColis.id },
        data: {
          qrCode: secureQrPayload,
          qrCodeImage: qrCodeImage || null,
        },
        select: createSelect,
      });
      }
    } catch (updateError) {
      console.warn('[api/parcels] update QR payload failed, keeping initial parcel payload:', updateError);
      colis = createdColis;
    }

    // Create tracking history
    errorStep = 'TRACKING_CREATE';
    try {
      await db.trackingHistory.create({
        data: {
          colisId: colis.id,
          status: 'CREATED',
          location: villeDepart,
          userId: payload.id,
          notes: `Colis créé (impression ${normalizedLabelPrintMode === 'RELAY' ? 'au relais' : 'à domicile'}) et placé dans la file d'attente de la ligne ${activeLine.villeDepart} → ${activeLine.villeArrivee}`,
        },
      });
    } catch (trackingError) {
      console.warn('[api/parcels] tracking history create failed (non-blocking):', trackingError);
    }

    errorStep = 'POST_ELIGIBILITY_REFRESH';
    try {
      await evaluateImplicitProEligibility(clientId);
    } catch (eligibilityError) {
      console.error('[implicit-pro] post-create evaluation failed:', eligibilityError);
    }

    errorStep = 'RESPONSE';
    return NextResponse.json({
      ...colis,
      withdrawalCode: effectiveWithdrawalCode,
      labelPrintMode: normalizedLabelPrintMode,
      relayPrintFee,
      pricingBreakdown,
    });
  } catch (error) {
    const prismaCode = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : null;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating parcel:', { step: errorStep, prismaCode, message, error });
    const status =
      prismaCode === 'P2010' || prismaCode === 'P2022'
        ? 400
        : 500;
    return NextResponse.json(
      {
        error: 'Failed to create parcel',
        step: errorStep,
        code: prismaCode,
        details: message,
      },
      { status }
    );
  }
}
