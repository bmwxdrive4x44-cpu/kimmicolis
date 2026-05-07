import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Stats } from '@/components/landing/stats';
import { CTA } from '@/components/landing/cta';
import Link from 'next/link';
import { getSiteUrl, type SupportedLocale, SUPPORTED_LOCALES } from '@/lib/site';

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

function asLocale(value: string): SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale) ? (value as SupportedLocale) : 'fr';
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const safeLocale = asLocale(locale);
  const siteUrl = getSiteUrl();
  const absoluteHome = `${siteUrl}/${safeLocale}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'SwiftColis',
        url: siteUrl,
        logo: `${siteUrl}/images/logo.png`,
        sameAs: [],
      },
      {
        '@type': 'WebSite',
        name: 'SwiftColis',
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/${safeLocale}/faq?query={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Service',
        serviceType: 'Livraison de colis',
        provider: {
          '@type': 'Organization',
          name: 'SwiftColis',
        },
        areaServed: {
          '@type': 'Country',
          name: 'Algerie',
        },
        url: absoluteHome,
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header />
      <main className="flex-1">
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-cyan-50 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Pages locales</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Livraison de colis par ville</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Consultez nos pages dediees aux grandes villes pour connaitre la couverture, les tarifs et les conseils de depot.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href={`/${safeLocale}/livraison-colis-alger`}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-900">Livraison colis Alger</p>
                <p className="mt-2 text-sm text-slate-600">Couverture Alger centre et peripherie, options de depot et reception.</p>
              </Link>
              <Link
                href={`/${safeLocale}/livraison-colis-oran`}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-900">Livraison colis Oran</p>
                <p className="mt-2 text-sm text-slate-600">Trajets frequents vers et depuis Oran, relais et bonnes pratiques d envoi.</p>
              </Link>
            </div>
          </div>
        </section>
        <CTA />
      </main>
      <Footer />
    </div>
  );
}