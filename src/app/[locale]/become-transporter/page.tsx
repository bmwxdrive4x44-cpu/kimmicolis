'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Banknote, TrendingUp, Shield, Award, ArrowRight } from 'lucide-react';

const BENEFITS = [
  {
    icon: Banknote,
    title: 'Revenus flexibles',
    description: 'Gagnez de l\'argent à votre rythme, sans engagement'
  },
  {
    icon: TrendingUp,
    title: 'Augmentez vos revenus',
    description: 'Accédez à des commandes régulières de qualité'
  },
  {
    icon: Shield,
    title: 'Assurance complète',
    description: 'Protection contre les risques de transport'
  },
  {
    icon: Award,
    title: 'Système de notation',
    description: 'Construisez votre réputation et augmentez vos revenus'
  }
];

export default function BecomeTransporterPage() {
  const router = useRouter();
  const locale = useLocale();

  const handleSignUp = () => {
    router.push(`/${locale}/auth/register?role=TRANSPORTER`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-12 md:py-20 bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                    Devenez Transporteur
                  </h1>
                  <p className="text-xl text-gray-600 dark:text-gray-300">
                    Rejoignez notre réseau de transporteurs et augmentez vos revenus avec nos commandes
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={handleSignUp}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg flex items-center gap-2"
                  >
                    Postuler maintenant
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="px-8 py-6 text-lg"
                  >
                    Conditions
                  </Button>
                </div>

                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>✓ Inscription rapide et gratuite</p>
                  <p>✓ Aucun frais cachés</p>
                  <p>✓ Commencez dès demain</p>
                </div>
              </div>

              <div className="relative">
                <div className="bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-2xl p-12 flex items-center justify-center min-h-96">
                  <Truck className="h-48 w-48 text-blue-600/20 dark:text-blue-400/20" />
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
                Pourquoi rejoindre SwiftColis Transporteurs
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {BENEFITS.map((benefit, idx) => {
                const Icon = benefit.icon;
                return (
                  <Card key={idx} className="border-0 shadow-none bg-slate-50 dark:bg-slate-800 hover:shadow-md transition">
                    <CardContent className="pt-6 space-y-4">
                      <Icon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
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

        {/* Requirements Section */}
        <section className="py-12 md:py-20 bg-slate-50 dark:bg-slate-800">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Conditions requises
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Véhicule
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li>✓ Véhicule en bon état de fonctionnement</li>
                    <li>✓ Assurance responsabilité civile valide</li>
                    <li>✓ Capacité minimum 3,5 tonnes (recommandé)</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Documents
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li>✓ Permis de conduire valide</li>
                    <li>✓ Identification valide</li>
                    <li>✓ Carte grise du véhicule</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-20 bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Prêt à commencer votre carrière ?
            </h2>
            <p className="text-xl text-blue-100">
              Rejoignez des milliers de transporteurs satisfaits
            </p>
            <Button
              onClick={handleSignUp}
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-6 text-lg mt-4"
            >
              Postuler gratuitement
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}