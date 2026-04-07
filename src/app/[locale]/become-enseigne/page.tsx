'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { EnseigneOnboardingForm } from '@/components/landing/enseigne-onboarding-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Boxes, BarChart3, Link2, ArrowRight } from 'lucide-react';

const BENEFITS = [
  {
    icon: Boxes,
    title: 'Expedition en lot',
    description: 'Creez plusieurs colis en une seule operation via le mode bulk.',
  },
  {
    icon: BarChart3,
    title: 'Pilotage KPI',
    description: 'Suivez vos volumes, taux de livraison et activite logistique.',
  },
  {
    icon: Link2,
    title: 'Integration e-commerce',
    description: 'Preparez la connexion de votre boutique et automatisez les flux.',
  },
];

export default function BecomeEnseignePage() {
  const handleScroll = () => {
    document.getElementById('enseigne-onboarding-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="relative bg-gradient-to-br from-amber-50 via-white to-orange-50 py-12 md:py-20 dark:from-slate-900 dark:via-slate-800 dark:to-slate-800">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="space-y-6">
              <div>
                <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white md:text-5xl">Devenez Enseigne Partenaire</h1>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  Ouvrez votre espace B2B pour expedier vos commandes plus vite et mieux piloter votre logistique.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                <p><strong>1.</strong> Creez votre compte enseigne.</p>
                <p><strong>2.</strong> Completez votre profil commercial.</p>
                <p><strong>3.</strong> Accedez au dashboard et lancez vos envois bulk.</p>
              </div>

              <Button onClick={handleScroll} className="bg-amber-600 px-8 py-6 text-lg text-white hover:bg-amber-700">
                Demarrer maintenant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="flex min-h-96 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 p-12 dark:from-amber-900/30 dark:to-orange-900/30">
              <Building2 className="h-48 w-48 text-amber-700/20 dark:text-amber-400/20" />
            </div>
          </div>
        </section>

        <section className="bg-white py-12 md:py-16 dark:bg-slate-900">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">Pourquoi choisir SwiftColis Enseigne</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">Une base operationnelle simple, puis des integrations evolutives.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {BENEFITS.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="border-0 bg-slate-50 shadow-none dark:bg-slate-800">
                    <CardContent className="space-y-3 pt-6">
                      <Icon className="h-9 w-9 text-amber-600 dark:text-amber-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400">{item.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-12 md:py-16 dark:bg-slate-800">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">Activer mon espace enseigne</h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Tout se fait sur cette page: compte + profil enseigne.</p>
            </div>
            <EnseigneOnboardingForm />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
