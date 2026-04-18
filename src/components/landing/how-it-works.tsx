'use client';

import { useTranslations } from 'next-intl';
import { Package, MapPin, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks');

  const steps = [
    {
      key: 'create',
      icon: Package,
      tone: 'from-emerald-500/20 to-cyan-500/20 border-emerald-300/30 text-emerald-200',
    },
    {
      key: 'deposit',
      icon: MapPin,
      tone: 'from-blue-500/20 to-cyan-500/20 border-blue-300/30 text-blue-200',
    },
    {
      key: 'track',
      icon: CheckCircle,
      tone: 'from-violet-500/20 to-fuchsia-500/20 border-violet-300/30 text-violet-200',
    },
  ] as const;

  return (
    <section className="relative overflow-hidden bg-slate-900 py-24 sm:py-28 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.12),transparent_38%),radial-gradient(circle_at_85%_82%,rgba(99,102,241,0.12),transparent_34%)]" />

      <div className="container relative px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center sm:mb-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
            <Sparkles className="h-3.5 w-3.5" />
            Parcours operationnel
          </p>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">{t('title')}</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={step.key}
                className="relative rounded-2xl border border-slate-700 bg-slate-950/70 p-6 sm:p-7"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border bg-gradient-to-br ${step.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold tracking-[0.18em] text-slate-400">ETAPE 0{index + 1}</span>
                </div>

                <h3 className="text-xl font-bold text-white">{t(`steps.${step.key}.title`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{t(`steps.${step.key}.description`)}</p>

                {index < steps.length - 1 ? (
                  <ArrowRight className="absolute -right-2 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-600 lg:block" />
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="mt-14 grid items-center gap-10 rounded-3xl border border-slate-700 bg-slate-950/70 p-7 sm:p-9 lg:mt-20 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
          <div className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-[1.7rem] border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/70">
            <img
              src="/images/tracking-app.png"
              alt="Suivi de colis sur smartphone"
              className="w-full object-cover"
            />
            <div className="absolute bottom-5 left-1/2 w-[78%] -translate-x-1/2 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-3 py-2 text-center text-xs font-semibold text-emerald-100 backdrop-blur">
              Notifications et tracking en direct
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-black leading-tight text-white sm:text-3xl">Un suivi lisible pour vous et vos clients</h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              Chaque mise a jour de statut est centralisee pour reduire les appels, accelerer les remises et rassurer le client final.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200 sm:text-base">
              {[
                'Notifications automatiques a chaque etape',
                'Historique complet des evenements colis',
                'Vision partagée entre client, relais et transporteur',
                'Moins d ambiguite lors des remises',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-cyan-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}