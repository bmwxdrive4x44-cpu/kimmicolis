'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Package, Truck, Store, ArrowRight, CheckCircle } from 'lucide-react';

export function CTA() {
  return (
    <section className="py-20 bg-gradient-to-b from-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 relative">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Prêt à démarrer avec{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              SwiftColis
            </span>
            ?
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
            Rejoignez des milliers d'utilisateurs qui font confiance à SwiftColis pour leurs envois 
            à travers l'Algérie. Créez votre compte gratuit en quelques secondes.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            {[
              'Inscription gratuite',
              'Sans engagement',
              'Support 7j/7',
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/auth/register">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 w-full sm:w-auto gap-2 shadow-lg shadow-emerald-500/25 px-8">
                <Package className="h-5 w-5" />
                Envoyer un colis
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link href="/auth/register?role=TRANSPORTER">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 bg-transparent border-slate-600 text-white hover:bg-slate-800 hover:text-white">
                <Truck className="h-5 w-5" />
                Devenir transporteur
              </Button>
            </Link>
            <Link href="/become-relay">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 bg-transparent border-slate-600 text-white hover:bg-slate-800 hover:text-white">
                <Store className="h-5 w-5" />
                Devenir relais
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-8 pt-8 border-t border-slate-800">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">48</div>
              <div className="text-sm text-slate-500">Wilayas couvertes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">500+</div>
              <div className="text-sm text-slate-500">Points relais</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">1000+</div>
              <div className="text-sm text-slate-500">Transporteurs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">50K+</div>
              <div className="text-sm text-slate-500">Colis livrés</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
