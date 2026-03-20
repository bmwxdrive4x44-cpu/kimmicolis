'use client';

import { useTranslations } from 'next-intl';
import { MapPin, Radio, DollarSign, Shield, Package, Truck } from 'lucide-react';
import Image from 'next/image';

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
    <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-white">
            {t('title')}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => {
            const Icon = icons[item];
            return (
              <div
                key={item}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/25">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-white">
                    {t(`items.${item}.title`)}
                  </h3>
                  <p className="text-slate-400">
                    {t(`items.${item}.description`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Highlight with Image */}
        <div className="mt-20 grid gap-12 lg:grid-cols-2 items-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="/images/relay-service.png"
                alt="Service de points relais"
                width={600}
                height={400}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white">
              Un réseau de points relais partout en Algérie
            </h3>
            <p className="text-slate-400">
              Déposez et récupérez vos colis dans plus de 500 commerces partenaires à travers les 48 wilayas. 
              Nos points relais sont ouverts 6j/7 avec des horaires flexibles.
            </p>
            <ul className="space-y-3">
              {[
                'Épiceries, pharmacies, bureaux de tabac partenaires',
                'Horaires d\'ouverture étendus',
                'Dépôt et retrait en 2 minutes',
                'QR Code pour traçabilité totale'
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
        </div>
      </div>
    </section>
  );
}
