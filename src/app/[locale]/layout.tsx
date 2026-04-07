import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/providers';

const locales = ['fr', 'ar', 'en', 'es'] as const;
type Locale = (typeof locales)[number];

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
