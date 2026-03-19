'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Package, Mail, Phone, MapPin, Facebook, Instagram, Twitter, Clock, Shield } from 'lucide-react';

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="bg-slate-900 text-slate-100 mt-auto relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500">
                <Package className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SwiftColis</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              La première plateforme de livraison inter-wilayas en Algérie. 
              Connectez-vous à un réseau de transporteurs et points relais vérifiés.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 hover:bg-emerald-500 flex items-center justify-center transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 hover:bg-emerald-500 flex items-center justify-center transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 hover:bg-emerald-500 flex items-center justify-center transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
              <div className="w-8 h-1 bg-emerald-500 rounded-full" />
              Liens Rapides
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                  {t('nav.home')}
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                  {t('nav.createParcel')}
                </Link>
              </li>
              <li>
                <Link href="/become-relay" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                  {t('nav.becomeRelay')}
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                  {t('nav.becomeTransporter')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
              <div className="w-8 h-1 bg-emerald-500 rounded-full" />
              Services
            </h3>
            <ul className="space-y-3">
              <li className="text-sm text-slate-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                Livraison inter-wilayas
              </li>
              <li className="text-sm text-slate-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                Points relais partenaires
              </li>
              <li className="text-sm text-slate-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                Suivi en temps réel
              </li>
              <li className="text-sm text-slate-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                Transporteurs professionnels
              </li>
              <li className="text-sm text-slate-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                Paiement sécurisé
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
              <div className="w-8 h-1 bg-emerald-500 rounded-full" />
              Contact
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800 mt-0.5">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">Alger, Algérie</p>
                  <p className="text-xs text-slate-500">Siège social</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800 mt-0.5">
                  <Phone className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">+213 XX XX XX XX</p>
                  <p className="text-xs text-slate-500">Service client</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800 mt-0.5">
                  <Mail className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">contact@swiftcolis.dz</p>
                  <p className="text-xs text-slate-500">Email support</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800 mt-0.5">
                  <Clock className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">Dim - Jeu: 8h - 18h</p>
                  <p className="text-xs text-slate-500">Horaires d'ouverture</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} SwiftColis. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Conditions d'utilisation
              </a>
              <a href="#" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Politique de confidentialité
              </a>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Shield className="h-4 w-4" />
                Paiement sécurisé
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
