import { NextIntlClientProvider } from 'next-intl';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/providers';
import { getSiteUrl, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/site';

type Locale = SupportedLocale;
const locales = SUPPORTED_LOCALES;
const siteUrl = getSiteUrl();

const isRTL = (locale: Locale): boolean => locale === 'ar';

import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';

const messagesMap: Record<Locale, any> = {
  fr: frMessages,
  ar: arMessages,
  en: enMessages,
  es: esMessages,
};

const localeSeo: Record<Locale, { title: string; description: string; ogLocale: string }> = {
  fr: {
    title: 'Livraison de colis en Algerie',
    description: 'Expediez et suivez vos colis en Algerie avec SwiftColis: points relais, transporteurs verifies et suivi clair.',
    ogLocale: 'fr_DZ',
  },
  ar: {
    title: 'Service de livraison de colis en Algerie',
    description: 'SwiftColis facilite l envoi et le suivi des colis en Algerie via un reseau de relais et de transport.',
    ogLocale: 'ar_DZ',
  },
  en: {
    title: 'Parcel Delivery in Algeria',
    description: 'SwiftColis helps you ship and track parcels in Algeria with relay points and vetted transporters.',
    ogLocale: 'en_US',
  },
  es: {
    title: 'Entrega de paquetes en Argelia',
    description: 'SwiftColis facilita el envio y seguimiento de paquetes en Argelia con puntos de relevo y transportistas verificados.',
    ogLocale: 'es_ES',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = locales.includes(locale as Locale) ? (locale as Locale) : 'fr';
  const seo = localeSeo[safeLocale];

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: `/${safeLocale}`,
      languages: {
        fr: '/fr',
        ar: '/ar',
        en: '/en',
        es: '/es',
      },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `${siteUrl}/${safeLocale}`,
      siteName: 'SwiftColis',
      type: 'website',
      locale: seo.ogLocale,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = messagesMap[locale as Locale] || frMessages;
  const rtl = isRTL(locale as Locale);

  return (
    <div lang={locale} dir={rtl ? 'rtl' : 'ltr'}>
      <Providers>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </Providers>
    </div>
  );
}
