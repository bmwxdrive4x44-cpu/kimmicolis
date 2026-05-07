import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/site';

function asLocale(value: string): SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale) ? (value as SupportedLocale) : 'fr';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = asLocale(locale);

  return {
    title: 'Livraison colis Alger',
    description:
      'Envoyez vos colis a Alger avec SwiftColis. Consultez les relais, les delais indicatifs et les conseils pour un envoi fiable.',
    alternates: {
      canonical: `/${safeLocale}/livraison-colis-alger`,
    },
    openGraph: {
      title: 'Livraison colis Alger | SwiftColis',
      description:
        'Service de livraison de colis a Alger avec reseau relais, suivi et support SwiftColis.',
      url: `/${safeLocale}/livraison-colis-alger`,
    },
  };
}

const cityBlocks = [
  {
    title: 'Alger Centre',
    description: 'Depots quotidiens, forte capacite de prise en charge et scans frequents.',
  },
  {
    title: 'Bab Ezzouar et Est',
    description: 'Flux reguliers vers les zones commerciales et residences universitaires.',
  },
  {
    title: 'Ouest Algerois',
    description: 'Livraison vers les quartiers residentiels avec relais partenaires actifs.',
  },
];

const checklist = [
  'Verifier le numero de telephone destinataire avant depot.',
  'Choisir un relais proche des axes principaux pour reduire les delais.',
  'Renseigner une description claire du colis pour eviter les litiges.',
  'Partager le numero de suivi au destinataire des la creation.',
];

export default async function AlgerLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = asLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-cyan-50 p-6 sm:p-8">
            <Badge variant="outline" className="border-emerald-200 bg-white/80 text-emerald-700">Ville cible</Badge>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">Livraison de colis a Alger</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              SwiftColis facilite les envois a Alger avec un parcours clair: creation en ligne, depot relais, suivi des etapes, puis remise securisee.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/${safeLocale}/auth/register`}>Creer un compte</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${safeLocale}/contact`}>Parler a un conseiller</Link>
              </Button>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {cityBlocks.map((block) => (
              <Card key={block.title}>
                <CardHeader>
                  <CardTitle className="text-lg">{block.title}</CardTitle>
                  <CardDescription>{block.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Checklist avant depot</CardTitle>
              <CardDescription>Les actions qui reduisent les retards et erreurs de livraison.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {checklist.map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">{index + 1}</div>
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}