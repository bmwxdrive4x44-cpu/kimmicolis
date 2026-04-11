'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Package, Truck, MapPin, Shield, ArrowRight, Search } from 'lucide-react';
import { useState } from 'react';

export function Hero() {
  const t = useTranslations('landing.hero');
  const [trackingNumber, setTrackingNumber] = useState('');

  return (
    <section className="relative overflow-hidden bg-slate-950">
      {/* Gradient background */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_left,_#064e3b_0%,_#0f172a_55%,_#020617_100%)]" />

      {/* Algeria logistics network — SVG background */}
      <svg
        className="absolute inset-0 z-0 w-full h-full"
        viewBox="0 0 1400 700"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Route connections — glowing lines */}
        {([
          [630,145, 290,200],
          [630,145, 970,220],
          [630,145, 750,310],
          [630,145, 880,170],
          [290,200, 200,310],
          [290,200, 420,380],
          [970,220, 1050,340],
          [970,220, 820,420],
          [750,310, 820,420],
          [750,310, 580,520],
          [420,380, 350,490],
          [420,380, 480,460],
          [480,460, 580,520],
          [820,420, 1050,340],
          [200,310, 350,490],
          [880,170, 1050,340],
        ] as [number,number,number,number][]).map(([x1,y1,x2,y2], i) => (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#10b981"
            strokeWidth="1.5"
            strokeOpacity="0.45"
            strokeDasharray="8 5"
          />
        ))}

        {/* Secondary city nodes */}
        {([
          [290, 200, 'Oran'],
          [970, 220, 'Constantine'],
          [750, 310, 'Sétif'],
          [420, 380, 'Djelfa'],
          [480, 460, 'Ghardaïa'],
          [820, 420, 'Batna'],
          [200, 310, 'Tlemcen'],
          [1050, 340, 'Annaba'],
          [580, 520, 'Ouargla'],
          [350, 490, 'Laghouat'],
          [880, 170, 'Skikda'],
        ] as [number,number,string][]).map(([cx, cy, label], i) => (
          <g key={i} filter="url(#nodeGlow)">
            <circle cx={cx} cy={cy} r="5" fill="#22c55e" fillOpacity="0.9" />
            <circle cx={cx} cy={cy} r="10" fill="none" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.35" />
            <text
              x={cx + 14} y={cy + 4}
              fontSize="11"
              fill="#6ee7b7"
              fillOpacity="0.75"
              fontFamily="Inter, Arial, sans-serif"
              fontWeight="500"
            >{label}</text>
          </g>
        ))}

        {/* Alger — main hub, brighter */}
        {/* Alger — main hub */}
        <g filter="url(#nodeGlow)">
          <circle cx="630" cy="145" r="16" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.5" />
          <circle cx="630" cy="145" r="6" fill="#4ade80" fillOpacity="1" />
          <text x="652" y="141" fontSize="13" fill="#86efac" fillOpacity="0.9" fontFamily="Inter, Arial, sans-serif" fontWeight="700">Alger</text>
          <text x="652" y="156" fontSize="9.5" fill="#6ee7b7" fillOpacity="0.55" fontFamily="Inter, Arial, sans-serif">Hub central</text>
        </g>
      </svg>

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[500px] bg-teal-700/10 rounded-full blur-[120px]" />
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
