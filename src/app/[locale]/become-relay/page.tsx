'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, CheckCircle, Clock, Users, TrendingUp, ArrowRight } from 'lucide-react';

const BENEFITS = [
  {
    icon: Users,
    title: 'Clients de qualitÃ©',
    description: 'AccÃ©dez Ã  un rÃ©seau de clients vÃ©rifiÃ©s cherchant des solutions fiables'
  },
  {
    icon: TrendingUp,
    title: 'Revenus supplÃ©mentaires',
    description: 'Gagnez et dÃ©veloppez votre activitÃ© grÃ¢ce aux services de colis'
  },
  {
    icon: Clock,
    title: 'FlexibilitÃ©',
    description: 'GÃ©rez vos horaires et commandes en fonction de votre disponibilitÃ©'
  },
  {
    icon: CheckCircle,
    title: 'Support 24/7',
    description: 'Une Ã©quipe dÃ©diÃ©e pour vous accompagner Ã  chaque Ã©tape'
  }
];

export default function BecomeRelayPage() {
  const router = useRouter();
  const locale = useLocale();

  const handleSignUp = () => {
    router.push(`/${locale}/auth/register?role=RELAIS`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-12 md:py-20 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                    Devenez Point Relais
                  </h1>
                  <p className="text-xl text-gray-600 dark:text-gray-300">
                    Proposez les services de SwiftColis Ã  vos clients et augmentez votre chiffre d'affaires
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={handleSignUp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg flex items-center gap-2"
                  >
                    Rejoindre maintenant
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="px-8 py-6 text-lg"
                  >
                    En savoir plus
                  </Button>
                </div>

                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>âœ“ Inscription gratuite et rapide</p>
                  <p>âœ“ Aucun engagement minimum</p>
                  <p>âœ“ Commencez Ã  hÃ©berger immÃ©diatement</p>
                </div>
              </div>

              <div className="relative">
                <div className="bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-2xl p-12 flex items-center justify-center min-h-96">
                  <Store className="h-48 w-48 text-emerald-600/20 dark:text-emerald-400/20" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-12 md:py-20 bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Avantages pour vous
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                DÃ©couvrez pourquoi rejoindre SwiftColis
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {BENEFITS.map((benefit, idx) => {
                const Icon = benefit.icon;
                return (
                  <Card key={idx} className="border-0 shadow-none bg-slate-50 dark:bg-slate-800 hover:shadow-md transition">
                    <CardContent className="pt-6 space-y-4">
                      <Icon className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {benefit.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {benefit.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-20 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              PrÃªt Ã  rejoindre la famille SwiftColis ?
            </h2>
            <p className="text-xl text-emerald-100">
              Inscription facile, aucune commission cachÃ©e, support complet
            </p>
            <Button
              onClick={handleSignUp}
              size="lg"
              className="bg-white text-emerald-600 hover:bg-gray-100 px-8 py-6 text-lg mt-4"
            >
              Commencer gratuitement
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
