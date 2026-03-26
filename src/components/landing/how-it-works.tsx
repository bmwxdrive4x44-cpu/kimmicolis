'use client';

import { useTranslations } from 'next-intl';
import { Package, MapPin, CheckCircle, ArrowRight } from 'lucide-react';

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks');

  const steps = [
    { 
      key: 'create', 
      icon: Package, 
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30'
    },
    { 
      key: 'deposit', 
      icon: MapPin, 
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30'
    },
    { 
      key: 'track', 
      icon: CheckCircle, 
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30'
    },
  ];

  return (
    <section className="py-20 bg-slate-800 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

      <div className="container px-4 relative">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-white">
            {t('title')}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 relative">
          {/* Connection Lines - Desktop */}
          <div className="hidden lg:block absolute top-24 left-1/3 w-1/3 h-0.5">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-50" />
          </div>

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.key} className="relative flex flex-col items-center text-center group">
                <div className={`relative z-10 mb-6 p-1 rounded-full bg-gradient-to-r ${step.color}`}>
                  <div className={`w-20 h-20 rounded-full ${step.bgColor} backdrop-blur-sm flex items-center justify-center`}>
                    <Icon className="h-10 w-10 text-white" />
                  </div>
                </div>
                <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-slate-800 border-2 ${step.borderColor} flex items-center justify-center font-bold text-sm text-white`}>
                  {index + 1}
                </div>

                <h3 className="text-xl font-semibold mb-3 text-white">
                  {t(`steps.${step.key}.title`)}
                </h3>
                <p className="text-slate-400 max-w-xs">
                  {t(`steps.${step.key}.description`)}
                </p>

                {/* Arrow for desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-24 -right-4 z-20">
                    <ArrowRight className="h-8 w-8 text-slate-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* App Preview Section */}
        <div className="mt-20 grid gap-12 lg:grid-cols-2 items-center">
          <div className="order-2 lg:order-1 space-y-6">
            <h3 className="text-2xl font-bold text-white">
              Suivez vos colis en temps réel
            </h3>
            <p className="text-slate-400">
              Avec notre application de suivi, vous pouvez suivre l'avancement de votre colis à chaque étape. 
              Recevez des notifications instantanées et consultez l'historique complet de vos envois.
            </p>
            <ul className="space-y-3">
              {[
                'Notifications push à chaque mise à jour',
                'Carte interactive avec position en temps réel',
                'Historique complet de vos envois',
                'QR Code unique pour chaque colis'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-300">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl mx-auto max-w-[320px]">
              <img
                src="/images/tracking-app.png"
                alt="Suivi de colis sur smartphone"
                className="w-full h-auto object-cover"
              />
              <div className="absolute bottom-8 left-1/2 flex h-12 w-[72%] -translate-x-1/2 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30">
                Suivi en temps réel
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
