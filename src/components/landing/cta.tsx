'use client';

import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Package, Truck, Store, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-24 sm:py-28 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(16,185,129,0.15),transparent_38%),radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.12),transparent_34%)]" />

      <div className="container relative px-4">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/80 p-8 text-center shadow-[0_40px_120px_-60px_rgba(16,185,129,0.55)] backdrop-blur sm:p-10 lg:p-14">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            Activation rapide
          </p>

          <h2 className="mx-auto mt-6 max-w-4xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Lancez vos envois avec un workflow moderne, lisible et previsible.
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base lg:text-lg">
            Creez votre compte, activez votre role et pilotez toutes vos operations logistiques depuis une seule interface.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-200">
            {[
              'Inscription gratuite',
              'Onboarding guide',
              'Support 7j/7',
            ].map((benefit) => (
              <span key={benefit} className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-300" />
                {benefit}
              </span>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-xs leading-relaxed text-slate-300">
            Pour les points relais: activation apres verification du dossier, avec periode d essai et validation operationnelle progressive.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Link href="/auth/register" className="sm:col-span-3 lg:col-span-1">
              <Button size="lg" className="h-12 w-full rounded-xl bg-emerald-500 text-sm font-semibold hover:bg-emerald-400">
                <Package className="mr-2 h-4 w-4" />
                Expédier maintenant
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/register?role=TRANSPORTER">
              <Button size="lg" variant="outline" className="h-12 w-full rounded-xl border-slate-500/70 bg-slate-900/60 text-sm font-semibold text-white hover:bg-slate-800/80">
                <Truck className="mr-2 h-4 w-4" />
                Je suis transporteur
              </Button>
            </Link>
            <Link href="/become-relay">
              <Button size="lg" variant="outline" className="h-12 w-full rounded-xl border-slate-500/70 bg-slate-900/60 text-sm font-semibold text-white hover:bg-slate-800/80">
                <Store className="mr-2 h-4 w-4" />
                Ouvrir un point relais
              </Button>
            </Link>
          </div>

          <div className="mt-10 grid gap-4 border-t border-slate-800 pt-8 text-left sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['48', 'Wilayas couvertes'],
              ['500+', 'Points relais'],
              ['1000+', 'Transporteurs'],
              ['50K+', 'Colis livres'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-2xl font-black tracking-tight text-white">{value}</p>
                <p className="text-xs text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}