import { db } from '@/lib/db';

export const LOYALTY_DEFAULTS = {
  discountRate: 0.05,
  minParcels: 5,
  windowDays: 7,
  stickyDays: 30,
} as const;

export const LOYALTY_LIMITS = {
  discountRate: { min: 0, max: 0.1 },
  minParcels: { min: 3, max: 10 },
  windowDays: { min: 7, max: 14 },
  stickyDays: { min: 7, max: 60 },
} as const;

export interface ImplicitLoyaltyConfig {
  discountRate: number;
  minParcels: number;
  windowDays: number;
  stickyDays: number;
}

type RawImplicitLoyaltyConfig = {
  discountRate?: unknown;
  minParcels?: unknown;
  windowDays?: unknown;
  stickyDays?: unknown;
};

const SETTING_KEYS = [
  'loyaltyImplicitDiscountRate',
  'loyaltyImplicitMinParcels',
  'loyaltyImplicitWindowDays',
  'loyaltyImplicitStickyDays',
] as const;

const CACHE_TTL_MS = 30 * 1000;
let cachedConfig: ImplicitLoyaltyConfig | null = null;
let cachedAt = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseWithBounds(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

export function sanitizeLoyaltyConfig(input: RawImplicitLoyaltyConfig): ImplicitLoyaltyConfig {
  return {
    discountRate: parseWithBounds(
      input.discountRate,
      LOYALTY_DEFAULTS.discountRate,
      LOYALTY_LIMITS.discountRate.min,
      LOYALTY_LIMITS.discountRate.max
    ),
    minParcels: Math.round(parseWithBounds(
      input.minParcels,
      LOYALTY_DEFAULTS.minParcels,
      LOYALTY_LIMITS.minParcels.min,
      LOYALTY_LIMITS.minParcels.max
    )),
    windowDays: Math.round(parseWithBounds(
      input.windowDays,
      LOYALTY_DEFAULTS.windowDays,
      LOYALTY_LIMITS.windowDays.min,
      LOYALTY_LIMITS.windowDays.max
    )),
    stickyDays: Math.round(parseWithBounds(
      input.stickyDays,
      LOYALTY_DEFAULTS.stickyDays,
      LOYALTY_LIMITS.stickyDays.min,
      LOYALTY_LIMITS.stickyDays.max
    )),
  };
}

export async function getImplicitLoyaltyConfig(forceRefresh = false): Promise<ImplicitLoyaltyConfig> {
  if (!forceRefresh && cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const settings = await db.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const config = sanitizeLoyaltyConfig({
    discountRate: map.get('loyaltyImplicitDiscountRate'),
    minParcels: map.get('loyaltyImplicitMinParcels'),
    windowDays: map.get('loyaltyImplicitWindowDays'),
    stickyDays: map.get('loyaltyImplicitStickyDays'),
  });

  cachedConfig = config;
  cachedAt = Date.now();
  return config;
}

export function clearImplicitLoyaltyConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}
