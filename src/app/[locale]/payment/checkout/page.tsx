'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Banknote, ArrowLeft, Loader2 } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const locale = useLocale();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    }
  }, [status, locale, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Banknote className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Paiement en espèces</CardTitle>
          <CardDescription className="text-base mt-2">
            Le paiement de votre colis se fait directement au point relais de départ
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Comment ça fonctionne?</h3>
            <ol className="space-y-3 text-sm text-blue-900 dark:text-blue-100">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span><strong>Créez votre colis</strong> avec le numéro de suivi généré</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span><strong>Rendez-vous au point relais</strong> de départ avec votre colis</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                <span><strong>Payez en espèces</strong> le commerçant (montant affiché à la création)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                <span><strong>Recevez un reçu</strong> et suivez votre colis en temps réel</span>
              </li>
            </ol>
          </div>

          {/* Benefits */}
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">✓ Avantages du paiement en espèces</h4>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>• Pas de frais de transaction bancaire</li>
              <li>• Paiement immédiat au commerçant</li>
              <li>• Suivi du colis garanti après paiement</li>
            </ul>
          </div>

          {/* Next Steps */}
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Allez à votre espace client for créer un colis
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push(`/${locale}/dashboard/client`)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Aller à mon tableau de bord
              </Button>
              <Button
                onClick={() => router.push(`/${locale}/dashboard/client?tab=payment`)}
                variant="outline"
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voir mes colis
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
