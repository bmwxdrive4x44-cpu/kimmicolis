'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard, ArrowLeft, Loader2, CheckCircle, XCircle,
  Smartphone, AlertCircle, Lock, ShieldCheck
} from 'lucide-react';

type PaymentMethod = 'CIB' | 'EDAHABIA' | 'BARIDI_MOB' | 'STRIPE_TEST';
type CheckoutStep = 'method' | 'form' | 'processing' | 'success' | 'failure';

interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  colisId: string;
  expiresAt: string;
  transactionRef?: string | null;
  colis?: { trackingNumber: string; villeDepart: string; villeArrivee: string; weight?: number | null };
}

interface PaymentConfig {
  onlinePaymentAvailable: boolean;
  availableMethods: PaymentMethod[];
  simulationMode: boolean;
  provider: string;
  environment: string;
}

function MethodCard({ method, title, subtitle, icon, onClick }: {
  method: PaymentMethod; title: string; subtitle: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all text-left w-full group"
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <span className="text-slate-400 group-hover:text-emerald-600 transition-colors">→</span>
    </button>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const locale = useLocale();
  const { data: session, status: authStatus } = useSession();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  const getPaymentTabUrl = () => {
    if (userRole === 'ENSEIGNE') return `/${locale}/dashboard/enseigne?tab=payments`;
    return `/${locale}/dashboard/client?tab=payment`;
  };

  const getHistoryTabUrl = () => {
    if (userRole === 'ENSEIGNE') return `/${locale}/dashboard/enseigne?tab=tracking`;
    return `/${locale}/dashboard/client?tab=history`;
  };

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);
  const [queueRemaining, setQueueRemaining] = useState(0);
  const [queueReturnUrl, setQueueReturnUrl] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

  const availableMethods = paymentConfig?.availableMethods || [];

  const waitForBackendConfirmation = async (id: string, maxAttempts = 12) => {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`/api/payments?paymentId=${id}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Impossible de vérifier le statut paiement');
      }

      const data = await res.json();
      setPayment(data);

      if (data.status === 'COMPLETED') {
        setTxRef(data.transactionRef || null);
        setStep('success');
        return;
      }

      if (data.status === 'FAILED') {
        setErrorMsg(data.errorMessage || 'Paiement refusé par le fournisseur.');
        setStep('failure');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setErrorMsg('Paiement en cours de confirmation côté serveur. Veuillez réessayer dans quelques secondes.');
    setStep('failure');
  };

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push(`/${locale}/auth/login`);
  }, [authStatus, locale, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    if (!paymentId) { setIsLoading(false); return; }

    // Lire la queue enseigne depuis sessionStorage
    try {
      const raw = sessionStorage.getItem('swiftcolis_payment_queue');
      if (raw) {
        const queue: { ids: string[]; returnUrl: string } = JSON.parse(raw);
        // Retirer le paymentId courant de la queue
        const remaining = queue.ids.filter((id) => id !== paymentId);
        setQueueRemaining(remaining.length);
        setQueueReturnUrl(queue.returnUrl);
        sessionStorage.setItem('swiftcolis_payment_queue', JSON.stringify({ ids: remaining, returnUrl: queue.returnUrl }));
      }
    } catch { /* sessionStorage indisponible */ }

    (async () => {
      try {
        const [paymentRes, configRes] = await Promise.all([
          fetch(`/api/payments?paymentId=${paymentId}`),
          fetch('/api/payments?config=1'),
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setPaymentConfig(configData);
        }

        if (!paymentRes.ok) { const e = await paymentRes.json(); setLoadError(e.error || 'Paiement introuvable'); return; }
        const data = await paymentRes.json();
        if (data.status === 'COMPLETED') { setStep('success'); setTxRef(data.transactionRef); }
        setPayment(data);
      } catch { setLoadError('Erreur de connexion'); }
      finally { setIsLoading(false); }
    })();
  }, [paymentId, authStatus]);

  const handleMethodSelect = (method: PaymentMethod) => {
    if (paymentConfig && (!paymentConfig.onlinePaymentAvailable || !availableMethods.includes(method))) {
      setErrorMsg('Le paiement en ligne est actuellement indisponible. Vous pouvez regler ce colis au relais de depart.');
      setStep('failure');
      return;
    }
    setSelectedMethod(method);
    setStep('form');
  };

  const handlePay = async () => {
    if (!payment || !selectedMethod) return;
    setErrorMsg(null);

    setStep('processing');
    try {
      const res = await fetch('/api/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment.id, action: 'process', method: selectedMethod }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Paiement refusé. Veuillez réessayer.');
        setStep('failure');
        return;
      }

      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      if (data.payment?.id) {
        await waitForBackendConfirmation(data.payment.id);
        return;
      }

      setErrorMsg('Réponse PSP invalide.');
      setStep('failure');
    } catch { setErrorMsg('Erreur de connexion. Veuillez réessayer.'); setStep('failure'); }
  };

  if (authStatus === 'loading' || isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="max-w-md w-full"><CardContent className="pt-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Paiement introuvable</h2>
          <p className="text-slate-600 mb-6">{loadError}</p>
          <Button onClick={() => router.push(getPaymentTabUrl())}>Retour</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-xl w-full space-y-4">

        {step !== 'processing' && step !== 'success' && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => step === 'form' ? setStep('method') : router.push(getPaymentTabUrl())}>
              <ArrowLeft className="h-4 w-4 mr-1" />Retour
            </Button>
            <span className="text-sm text-slate-500 flex items-center gap-1"><Lock className="h-3 w-3" /> Paiement sécurisé</span>
          </div>
        )}

        {payment && step !== 'success' && (
          <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950">
            <CardContent className="pt-4 pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Montant à payer</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{payment.amount.toFixed(2)} DA</p>
                  {payment.colis && (
                    <p className="text-xs text-slate-500 mt-1">Colis {payment.colis.weight ? `${payment.colis.weight} kg` : ''} · {payment.colis.villeDepart} → {payment.colis.villeArrivee}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-emerald-700 border-emerald-300">{payment.currency}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {paymentConfig && !paymentConfig.onlinePaymentAvailable && step === 'method' && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle>Paiement en ligne indisponible</CardTitle>
              <CardDescription>Le fournisseur de paiement n'est pas encore configure pour cette instance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-amber-900">
              <p>Vous pouvez conserver ce colis dans le panier et le regler directement au relais de depart.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push(getPaymentTabUrl())}>Retour au panier</Button>
                <Button onClick={() => router.push(getHistoryTabUrl())} className="bg-emerald-600 hover:bg-emerald-700 text-white">Voir mes colis</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'method' && paymentConfig?.onlinePaymentAvailable !== false && (
          <Card>
            <CardHeader>
              <CardTitle>Choisir un mode de paiement</CardTitle>
              <CardDescription>
                {paymentConfig?.simulationMode
                  ? 'Aucun PSP réel configuré: Stripe est proposé en mode simulation pour tester le parcours.'
                  : 'Sélectionnez votre méthode de paiement préférée'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {availableMethods.includes('CIB') && <MethodCard method="CIB" title="Carte CIB" subtitle="Visa / Mastercard algérienne (SATIM)" icon={<CreditCard className="h-6 w-6 text-blue-600" />} onClick={() => handleMethodSelect('CIB')} />}
              {availableMethods.includes('EDAHABIA') && <MethodCard method="EDAHABIA" title="Carte Edahabia" subtitle="Carte Algérie Poste (CCP)" icon={<CreditCard className="h-6 w-6 text-yellow-600" />} onClick={() => handleMethodSelect('EDAHABIA')} />}
              {availableMethods.includes('BARIDI_MOB') && <MethodCard method="BARIDI_MOB" title="Baridi Mob" subtitle="Paiement mobile Algérie Poste" icon={<Smartphone className="h-6 w-6 text-green-600" />} onClick={() => handleMethodSelect('BARIDI_MOB')} />}
              {availableMethods.includes('STRIPE_TEST') && <MethodCard method="STRIPE_TEST" title="Stripe (mode test)" subtitle={paymentConfig?.simulationMode ? 'Simulation de paiement Stripe sans PSP réel' : 'Cartes de test Stripe'} icon={<CreditCard className="h-6 w-6 text-purple-600" />} onClick={() => handleMethodSelect('STRIPE_TEST')} />}
            </CardContent>
          </Card>
        )}

        {step === 'form' && selectedMethod && (
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedMethod === 'CIB' && 'Payer avec Carte CIB'}
                {selectedMethod === 'EDAHABIA' && 'Payer avec Carte Edahabia'}
                {selectedMethod === 'BARIDI_MOB' && 'Payer avec Baridi Mob'}
                {selectedMethod === 'STRIPE_TEST' && 'Payer avec Stripe (test)'}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs">
                <ShieldCheck className="h-3 w-3 text-green-600" />
                Paiement sécurisé · Données chiffrées TLS 1.3
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{errorMsg}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-slate-300">
                {paymentConfig?.simulationMode && selectedMethod === 'STRIPE_TEST'
                  ? 'Mode simulation Stripe: aucun PSP externe ne sera appele. Le paiement sera traite directement par le backend pour tester le parcours utilisateur.'
                  : 'Vous allez etre redirige vers la page securisee du PSP pour finaliser le paiement. Le statut de votre colis sera mis a jour apres confirmation du webhook.'}
              </div>

              <Button onClick={handlePay} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
                <Lock className="h-4 w-4 mr-2" />{paymentConfig?.simulationMode && selectedMethod === 'STRIPE_TEST' ? 'Simuler le paiement Stripe' : `Continuer vers PSP (${payment?.amount.toFixed(2)} DA)`}
              </Button>
              <p className="text-xs text-center text-slate-500">
                {paymentConfig?.simulationMode && selectedMethod === 'STRIPE_TEST'
                  ? 'Simulation de paiement Stripe pour valider le parcours sans configuration PSP externe.'
                  : `Paiement sécurisé via ${selectedMethod === 'BARIDI_MOB' ? 'Baridi (Algérie Poste)' : selectedMethod === 'STRIPE_TEST' ? 'Stripe test' : 'réseau SATIM'}.`}
              </p>
            </CardContent>
          </Card>
        )}

        {step === 'processing' && (
          <Card><CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-emerald-600 mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-2">Traitement en cours…</h2>
            <p className="text-slate-500 text-sm">Attente de confirmation du backend via webhook officiel. Ne fermez pas cette fenêtre.</p>
          </CardContent></Card>
        )}

        {step === 'success' && (
          <Card><CardContent className="pt-10 pb-10 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-emerald-700 mb-2">Paiement confirmé par le backend</h2>
            <p className="text-slate-600 mb-2">Votre paiement de <strong>{payment?.amount.toFixed(2)} DA</strong> est validé après confirmation serveur.</p>
            {txRef && <p className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded mb-4 inline-block">Réf: {txRef}</p>}
            {queueRemaining > 0 ? (
              <p className="text-sm text-amber-700 font-medium mb-4">
                {queueRemaining} colis restant{queueRemaining > 1 ? 's' : ''} à payer dans ce lot.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mb-4">Votre colis passe au prochain état opérationnel côté serveur.</p>
            )}
            {queueRemaining > 0 ? (() => {
              // Lire le prochain paymentId depuis sessionStorage
              try {
                const raw = sessionStorage.getItem('swiftcolis_payment_queue');
                if (raw) {
                  const queue: { ids: string[]; returnUrl: string } = JSON.parse(raw);
                  if (queue.ids.length > 0) {
                    return (
                      <div className="flex flex-col gap-2 items-center">
                        <Button
                          onClick={() => router.push(`/${locale}/payment/checkout?paymentId=${queue.ids[0]}`)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Payer le colis suivant ({queueRemaining} restant{queueRemaining > 1 ? 's' : ''})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { sessionStorage.removeItem('swiftcolis_payment_queue'); router.push(queue.returnUrl); }}
                        >
                          Terminer et revenir au tableau de bord
                        </Button>
                      </div>
                    );
                  }
                }
              } catch { /* ignore */ }
              return null;
            })() : (
              <Button
                onClick={() => {
                  const returnUrl = queueReturnUrl;
                  if (returnUrl) {
                    sessionStorage.removeItem('swiftcolis_payment_queue');
                    router.push(returnUrl);
                  } else {
                    router.push(getHistoryTabUrl());
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Voir mes colis
              </Button>
            )}
          </CardContent></Card>
        )}

        {step === 'failure' && (
          <Card><CardContent className="pt-10 pb-10 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-700 mb-2">Paiement refusé</h2>
            <p className="text-slate-600 mb-6">{errorMsg || "Votre paiement n'a pas pu être traité."}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setStep('method'); setErrorMsg(null); }}>Réessayer</Button>
              <Button variant="ghost" onClick={() => router.push(getPaymentTabUrl())}>Annuler</Button>
            </div>
          </CardContent></Card>
        )}

      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
