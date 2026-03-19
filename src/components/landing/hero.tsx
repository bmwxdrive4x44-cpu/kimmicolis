'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Package, Truck, MapPin, Shield, ArrowRight, Search } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

export function Hero() {
  const t = useTranslations('landing.hero');
  const [trackingNumber, setTrackingNumber] = useState('');

  return (
    <section className="relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-delivery.png"
          alt="SwiftColis Delivery"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/60" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 px-4 py-16 md:py-24 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          {/* Left Content */}
          <div className="flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium backdrop-blur-sm">
              <Truck className="h-4 w-4" />
              Livraison inter-wilayas
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-white">
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                {t('title')}
              </span>
            </h1>

            <p className="text-xl text-slate-300 max-w-xl">
              {t('subtitle')}
            </p>

            <p className="text-slate-400 max-w-xl">
              {t('description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/auth/register">
                <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 w-full sm:w-auto gap-2 shadow-lg shadow-emerald-500/25">
                  <Package className="h-5 w-5" />
                  {t('cta.send')}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href="/become-relay">
                <Button variant="outline" size="lg" className="w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm">
                  {t('cta.partner')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Content - Tracking Card */}
          <div className="flex flex-col gap-6">
            {/* Tracking Form */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                <Search className="h-5 w-5 text-emerald-400" />
                {t('cta.track')}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="SCXXXXXXXXX"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <Link href={`/dashboard/client?track=${trackingNumber}`}>
                  <Button className="bg-emerald-500 hover:bg-emerald-600 h-full px-6">
                    <Search className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-xl rounded-xl shadow-xl p-5 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/20">
                    <Package className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">50K+</p>
                    <p className="text-sm text-slate-400">Colis livrés</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-xl shadow-xl p-5 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-500/20">
                    <MapPin className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">48</p>
                    <p className="text-sm text-slate-400">Wilayas</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-xl shadow-xl p-5 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-orange-500/20">
                    <Shield className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">500+</p>
                    <p className="text-sm text-slate-400">Points relais</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-xl shadow-xl p-5 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-purple-500/20">
                    <Truck className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">1K+</p>
                    <p className="text-sm text-slate-400">Transporteurs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
