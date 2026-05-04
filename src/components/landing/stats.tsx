'use client';

import { useTranslations } from 'next-intl';
import { Package, MapPin, Store, Truck, Sparkles } from 'lucide-react';

export function Stats() {
  const t = useTranslations('landing.stats');

  const stats = [
    { key: 'parcels', value: '50,000+', icon: Package, tone: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
    { key: 'cities', value: '48', icon: MapPin, tone: 'text-cyan-700 border-cyan-200 bg-cyan-50' },
    { key: 'relays', value: '500+', icon: Store, tone: 'text-amber-700 border-amber-200 bg-amber-50' },
    { key: 'transporters', value: '1,000+', icon: Truck, tone: 'text-violet-700 border-violet-200 bg-violet-50' },
  ] as const;

  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-20 lg:py-24">
      <div className="container px-4">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-7 sm:p-10 lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(16,185,129,0.08),transparent_38%),radial-gradient(circle_at_86%_85%,rgba(59,130,246,0.08),transparent_32%)]" />

          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
              <Sparkles className="h-3.5 w-3.5" />
              Chiffres cles
            </p>

            <div className="mt-5 max-w-2xl">
              <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">SwiftColis en chiffres</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Une plateforme operationnelle pour connecter clients, relais et transporteurs dans un reseau national fiable.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <article key={stat.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${stat.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-3xl font-black tracking-tight text-slate-900">{stat.value}</p>
                    <p className="mt-1 text-sm text-slate-600">{t(stat.key)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}