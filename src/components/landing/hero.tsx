'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Package, Truck, MapPin, ShieldCheck, ArrowRight, Search, Sparkles, Clock3 } from 'lucide-react';
import { useState } from 'react';

export function Hero() {
  const t = useTranslations('landing.hero');
  const [trackingNumber, setTrackingNumber] = useState('');

  const trustItems = [
    { icon: MapPin, label: '48 wilayas couvertes' },
    { icon: Truck, label: 'Transporteurs verifies' },
    { icon: ShieldCheck, label: 'Flux colis securises' },
  ];

  return (
    <section className="relative overflow-hidden bg-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(16,185,129,0.12),transparent_36%),radial-gradient(circle_at_86%_14%,rgba(14,165,233,0.1),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_56%,#e2e8f0_100%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(71,85,105,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(71,85,105,0.08)_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="container relative z-10 px-4 pb-24 pt-16 md:pt-20 lg:pb-32 lg:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              SaaS logistique nouvelle generation
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.03em] text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
                {t('title')}
                <span className="block bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 bg-clip-text text-transparent">Expediez plus vite avec une visibilite complete sur chaque colis.</span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg md:text-xl">
                {t('subtitle')}
              </p>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                {t('description')}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/auth/register">
                <Button size="lg" className="h-12 rounded-xl bg-emerald-500 px-7 text-sm font-semibold text-white hover:bg-emerald-400 sm:h-12">
                  <Package className="mr-2 h-4 w-4" />
                  {t('cta.send')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/become-relay">
                <Button variant="outline" size="lg" className="h-12 rounded-xl border-slate-300 bg-white px-7 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  {t('cta.partner')}
                </Button>
              </Link>
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              {trustItems.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-3 text-slate-700 backdrop-blur">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-medium leading-snug">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-emerald-300/30 via-cyan-300/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/95 p-6 shadow-[0_35px_90px_-45px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Suivi instantane</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">{t('cta.track')}</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  Temps reel
                </span>
              </div>

              <div className="mb-6 flex gap-2">
                <input
                  type="text"
                  placeholder="SCXXXXXXXXX"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <Link href={`/dashboard/client?track=${trackingNumber}`}>
                  <Button className="h-12 rounded-xl bg-emerald-500 px-4 hover:bg-emerald-400">
                    <Search className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-600">Colis traites</p>
                  <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">50K+</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-600">Points relais actifs</p>
                  <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">500+</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs text-slate-600">Engagement produit</p>
                  <p className="mt-1 text-base font-medium text-slate-700">Interface unifiee pour clients, transporteurs et relais dans un flux unique.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}