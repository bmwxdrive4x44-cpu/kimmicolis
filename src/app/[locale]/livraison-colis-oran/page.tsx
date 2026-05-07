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
    title: 'Livraison colis Oran',
    description:
      'Service SwiftColis pour envoyer des colis vers Oran avec suivi des etapes, relais partenaires et conseils de preparation.',
    alternates: {
      canonical: `/${safeLocale}/livraison-colis-oran`,
    },
    openGraph: {
      title: 'Livraison colis Oran | SwiftColis',
      description:
        'Livrez vos colis vers Oran avec un flux de depot relais et un suivi transparent.',
      url: `/${safeLocale}/livraison-colis-oran`,
    },
  };
}

const routeHighlights = [
  {
    title: 'Oran vers Alger',
    description: 'Trajet frequent pour envois professionnels et e-commerce.',
  },
  {
    title: 'Oran vers Ouest',
    description: 'Flux regional optimise pour les destinations de proximite.',
  },
  {
    title: 'Reception a Oran',
    description: 'Relais de retrait avec verification identite et code.',
  },
];

const bestPractices = [
  'Choisir un emballage adapte au type de produit et au transport routier.',
  'Ajouter une etiquette lisible avec nom, numero et ville du destinataire.',
  'Eviter les depots tardifs pour ne pas decaler le prochain depart de mission.',
  'Informer le client final du relais de retrait des la creation du colis.',
];

export default async function OranLandingPage({
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
          <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-sky-50 p-6 sm:p-8">
            <Badge variant="outline" className="border-cyan-200 bg-white/80 text-cyan-700">Ville cible</Badge>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">Livraison de colis a Oran</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Vous expediez vers Oran ou depuis Oran ? Cette page centralise les bonnes pratiques pour reduire les incidents et accelerer la livraison.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/${safeLocale}/auth/register`}>Commencer un envoi</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${safeLocale}/faq`}>Voir la FAQ logistique</Link>
              </Button>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {routeHighlights.map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Bonnes pratiques avant envoi</CardTitle>
              <CardDescription>Actions simples qui ameliorent le taux de livraison reussie.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {bestPractices.map((rule, index) => (
                <div key={rule} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-xs font-semibold text-cyan-700">{index + 1}</div>
                  <p className="text-sm leading-6 text-slate-700">{rule}</p>
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