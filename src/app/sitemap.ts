import type { MetadataRoute } from 'next';
import { getSiteUrl, SUPPORTED_LOCALES } from '@/lib/site';

const localeRoutes = [
  '',
  '/contact',
  '/faq',
  '/pro',
  '/livraison-colis-alger',
  '/livraison-colis-oran',
  '/auth/login',
  '/auth/register',
  '/become-relay',
  '/become-transporter',
  '/become-enseigne',
] as const;

const routePriority: Record<string, number> = {
  '': 1,
  '/livraison-colis-alger': 0.9,
  '/livraison-colis-oran': 0.9,
  '/pro': 0.8,
  '/contact': 0.7,
  '/faq': 0.7,
};

function getPriority(route: string) {
  return routePriority[route] ?? 0.6;
}

function getFrequency(route: string): MetadataRoute.Sitemap[number]['changeFrequency'] {
  if (route === '') return 'daily';
  if (route === '/livraison-colis-alger' || route === '/livraison-colis-oran') return 'daily';
  if (route === '/contact' || route === '/faq' || route === '/pro') return 'weekly';
  return 'monthly';
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  return SUPPORTED_LOCALES.flatMap((locale) => {
    return localeRoutes.map((route) => ({
      url: `${siteUrl}/${locale}${route}`,
      lastModified: now,
      changeFrequency: getFrequency(route),
      priority: getPriority(route),
    }));
  });
}