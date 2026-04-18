'use client';

import { useTranslations } from 'next-intl';
import { MapPin, Radio, DollarSign, Shield, Sparkles } from 'lucide-react';

const icons = {
  network: MapPin,
  tracking: Radio,
  price: DollarSign,
  secure: Shield,
};

export function Features() {
  const t = useTranslations('landing.features');
  const items = ['network', 'tracking', 'price', 'secure'] as const;

  return (
    <section className="relative overflow-hidden bg-slate-950 py-24 sm:py-28 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.2),transparent_40%)]" />

      <div className="container relative px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center sm:mb-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            Briques produit
          </p>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">{t('title')}</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const Icon = icons[item];
            return (
              <article
                key={item}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-slate-900"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-500/15 text-emerald-300 transition-colors group-hover:bg-emerald-500/25">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-white">{t(`items.${item}.title`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{t(`items.${item}.description`)}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-14 grid items-center gap-10 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-7 sm:p-9 lg:mt-20 lg:grid-cols-[1.02fr_0.98fr] lg:p-10">
          <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-emerald-900/20">
            <img
              src="/images/relay-service.png"
              alt="Service de points relais"
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <h3 className="text-2xl font-black leading-tight text-white sm:text-3xl">Un reseau relais dense pour accelerer vos livraisons</h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              Deposez et recuperez vos colis dans un maillage national de commerces partenaires, avec des horaires et process harmonises.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-200 sm:text-base">
              {[
                'Commerces de proximite verifies',
                'Retrait et depot rapides avec QR code',
                'Process standardise pour limiter les erreurs',
                'Pilotage unifie cote client, relais et transporteur',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
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