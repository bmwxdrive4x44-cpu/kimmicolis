'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { PartnerApplicationForm } from '@/components/landing/partner-application-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Store, CheckCircle, Clock, Users, TrendingUp, ArrowRight } from 'lucide-react';

const BENEFITS = [
  {
    icon: Users,
    title: 'Clients de qualité',
    description: 'Accédez à un réseau de clients vérifiés cherchant des solutions fiables'
  },
  {
    icon: TrendingUp,
    title: 'Revenus supplémentaires',
    description: 'Gagnez et développez votre activité grâce aux services de colis'
  },
  {
    icon: Clock,
    title: 'Flexibilité',
    description: 'Gérez vos horaires et commandes en fonction de votre disponibilité'
  },
  {
    icon: CheckCircle,
    title: 'Support 24/7',
    description: 'Une équipe dédiée pour vous accompagner à chaque étape'
  }
];

const RELAY_CONDITIONS = [
  {
    title: 'Documents obligatoires',
    description: 'Pièce d’identité du gérant, informations du commerce, téléphone joignable et adresse complète vérifiable.',
  },
  {
    title: 'Conformité et vérification',
    description: 'Votre dossier est vérifié par l’équipe SwiftColis avant activation. Seuls les profils conformes sont approuvés.',
  },
  {
    title: 'Caution de sécurité',
    description: 'Une caution peut être demandée selon le profil de risque et le volume. Elle reste bloquée selon les règles de conformité.',
  },
  {
    title: 'Respect des reversements',
    description: 'Les montants encaissés doivent être reversés à temps à la plateforme. Les retards répétitifs peuvent entraîner suspension et sanctions.',
  },
  {
    title: 'Qualité de service minimum',
    description: 'Le relais doit assurer un traitement correct des colis, respecter les scans requis et maintenir un score de conformité satisfaisant.',
  },
  {
    title: 'Suivi et audits',
    description: 'Un suivi régulier est effectué (écarts de cash, retards, incidents). Les cas critiques sont revus par l’administration.',
  },
];

export default function BecomeRelayPage() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    const y = element.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const handleSignUp = () => {
    scrollToSection('relay-application-section');
  };

  const handleLearnMore = () => {
    scrollToSection('relay-conditions-section');
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <section className="relative py-12 md:py-20 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                    Devenez Point Relais
                  </h1>
                  <p className="text-xl text-gray-600 dark:text-gray-300">
                    Proposez les services de SwiftColis à vos clients et augmentez votre chiffre d'affaires
                  </p>
                </div>

                {/* Process Steps */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">Comment ça fonctionne?</h3>
                  <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex gap-3">
                      <span className="font-bold text-emerald-600 flex-shrink-0">1.</span>
                      <p>Créez votre compte et renseignez les informations du commerce (adresse, ville, horaires, contact).</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-emerald-600 flex-shrink-0">2.</span>
                      <p>Soumettez votre dossier avec les justificatifs requis pour vérification.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-emerald-600 flex-shrink-0">3.</span>
                      <p>Paiement de la caution si demandée, puis validation admin du dossier.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-emerald-600 flex-shrink-0">4.</span>
                      <p>Activation du relais, démarrage opérationnel et suivi conformité mensuel.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={handleSignUp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg flex items-center gap-2"
                  >
                    Rejoindre maintenant
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" className="px-8 py-6 text-lg" onClick={handleLearnMore}>
                    En savoir plus
                  </Button>
                </div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>✓ Inscription gratuite et rapide</p>
                  <p>✓ Validation du dossier avant activation</p>
                  <p>✓ Conditions de conformité transparentes</p>
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

        <section className="py-12 md:py-20 bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Avantages pour vous
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Découvrez pourquoi rejoindre SwiftColis
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

        <section id="relay-conditions-section" className="py-12 md:py-20 bg-slate-50 dark:bg-slate-900/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Conditions pour devenir relais
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Voici les règles principales à respecter pour une activation et une collaboration durable.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {RELAY_CONDITIONS.map((condition, idx) => (
                <Card key={idx} className="border bg-white dark:bg-slate-900">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        {condition.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {condition.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="relay-application-section" className="py-12 md:py-20 bg-slate-50 dark:bg-slate-900/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                Déposer votre candidature
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Remplissez le formulaire ci-dessous pour créer votre compte et votre dossier relais en une seule étape.
              </p>
            </div>
            <PartnerApplicationForm role="RELAIS" />
          </div>
        </section>

        <section className="py-12 md:py-20 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Prêt à rejoindre la famille SwiftColis ?
            </h2>
            <p className="text-xl text-emerald-100">
              Dossier clair, règles transparentes, support complet
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
}