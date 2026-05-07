const FALLBACK_SITE_URL = 'https://kimmicolis.vercel.app';

export const SUPPORTED_LOCALES = ['fr', 'ar', 'en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function getSiteUrl() {
  const candidate = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || FALLBACK_SITE_URL;

  try {
    const normalized = new URL(candidate);
    return normalized.toString().replace(/\/$/, '');
  } catch {
    return FALLBACK_SITE_URL;
  }
}