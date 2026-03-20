'use client';

import { useTranslations } from 'next-intl';
import { Package, MapPin, Store, Truck } from 'lucide-react';

export function Stats() {
  const t = useTranslations('landing.stats');

  const stats = [
    { key: 'parcels', value: '50,000+', icon: Package, color: 'from-emerald-400 to-teal-300' },
    { key: 'cities', value: '48', icon: MapPin, color: 'from-blue-400 to-cyan-300' },
    { key: 'relays', value: '500+', icon: Store, color: 'from-orange-400 to-yellow-300' },
    { key: 'transporters', value: '1,000+', icon: Truck, color: 'from-purple-400 to-pink-300' },
  ];

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600" />
        <div className="absolute inset-0 bg-[url('/images/hero-delivery.png')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white/10 blur-xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-white/10 blur-xl" />

      <div className="container px-4 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            SwiftColis en chiffres
          </h2>
          <p className="text-white/80 max-w-2xl mx-auto">
            Une plateforme de confiance qui connecte clients, transporteurs et points relais à travers toute l'Algérie
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.key} className="relative group">
                <div className="absolute inset-0 bg-white/5 rounded-2xl blur-xl group-hover:bg-white/10 transition-colors" />
                <div className="relative text-center p-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-all duration-300">
                  <div className="flex justify-center mb-4">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${stat.color} p-0.5`}>
                      <div className="w-full h-full rounded-full bg-slate-900/50 flex items-center justify-center">
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className={`text-4xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2`}>
                    {stat.value}
                  </p>
                  <p className="text-white/80 text-lg">{t(stat.key)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
