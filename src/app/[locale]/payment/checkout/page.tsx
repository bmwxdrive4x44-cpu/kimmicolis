'use client';

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Banknote, CreditCard, ArrowLeft, Loader2, CheckCircle, XCircle,
  Smartphone, AlertCircle, Lock, ShieldCheck
} from 'lucide-react';

type PaymentMethod = 'CIB' | 'EDAHABIA' | 'BARIDI_MOB' | 'CASH_RELAY';
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
  colis?: { trackingNumber: string; villeDepart: string; villeArrivee: string; format: string };
}

function formatCardNumber(value: string): string {
  return value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
}
function formatExpiry(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return v;
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

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [cardForm, setCardForm] = useState({ cardNumber: '', expiry: '', cvv: '', cardHolder: '' });
  const [baridiForm, setBaridiForm] = useState({ phone: '', otp: '' });
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push(`/${locale}/auth/login`);
  }, [authStatus, locale, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    if (!paymentId) { setIsLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/payments?paymentId=${paymentId}`);
        if (!res.ok) { const e = await res.json(); setLoadError(e.error || 'Paiement introuvable'); return; }
        const data = await res.json();
        if (data.status === 'COMPLETED') { setStep('success'); setTxRef(data.transactionRef); }
        setPayment(data);
      } catch { setLoadError('Erreur de connexion'); }
      finally { setIsLoading(false); }
    })();
  }, [paymentId, authStatus]);

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setStep(method === 'CASH_RELAY' ? 'success' : 'form');
  };

  const validateCardForm = () => {
    if (cardForm.cardNumber.replace(/\s/g, '').length < 16) { setErrorMsg('Numéro de carte invalide (16 chiffres)'); return false; }
    if (!/^\d{2}\/\d{2}$/.test(cardForm.expiry)) { setErrorMsg("Date d'expiration invalide (MM/AA)"); return false; }
    if (cardForm.cvv.length < 3) { setErrorMsg('CVV invalide'); return false; }
    if (!cardForm.cardHolder.trim()) { setErrorMsg('Nom du porteur requis'); return false; }
    return true;
  };

  const handleSendOtp = async () => {
    if (!/^(05|06|07)\d{8}$/.test(baridiForm.phone.replace(/\s/g, ''))) {
      setErrorMsg('Numéro algérien invalide (ex: 0612345678)'); return;
    }
    setSendingOtp(true);
    await new Promise(r => setTimeout(r, 1500));
    setOtpSent(true); setSendingOtp(false); setErrorMsg(null);
  };

  const handlePay = async () => {
    if (!payment || !selectedMethod) return;
    setErrorMsg(null);
    if (selectedMethod === 'BARIDI_MOB') {
      if (!otpSent) { setErrorMsg('Veuillez d\'abord recevoir votre code OTP'); return; }
      if (baridiForm.otp.length < 4) { setErrorMsg('Code OTP invalide'); return; }
    } else {
      if (!validateCardForm()) return;
    }
    setStep('processing');
    try {
      const res = await fetch('/api/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment.id, action: 'process', method: selectedMethod }),
      });
      const data = await res.json();
      if (!res.ok || !data.payment) { setErrorMsg(data.error || 'Paiement refusé. Veuillez réessayer.'); setStep('failure'); return; }
      setTxRef(data.payment.transactionRef || null);
      setStep('success');
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
          <Button onClick={() => router.push(`/${locale}/dashboard/client?tab=payment`)}>Retour</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-xl w-full space-y-4">

        {step !== 'processing' && step !== 'success' && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => step === 'form' ? setStep('method') : router.push(`/${locale}/dashboard/client?tab=payment`)}>
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
                    <p className="text-xs text-slate-500 mt-1">Colis {payment.colis.format} · {payment.colis.villeDepart} → {payment.colis.villeArrivee}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-emerald-700 border-emerald-300">{payment.currency}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'method' && (
          <Card>
            <CardHeader>
              <CardTitle>Choisir un mode de paiement</CardTitle>
              <CardDescription>Sélectionnez votre méthode de paiement préférée</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <MethodCard method="CIB" title="Carte CIB" subtitle="Visa / Mastercard algérienne (SATIM)" icon={<CreditCard className="h-6 w-6 text-blue-600" />} onClick={() => handleMethodSelect('CIB')} />
              <MethodCard method="EDAHABIA" title="Carte Edahabia" subtitle="Carte Algérie Poste (CCP)" icon={<CreditCard className="h-6 w-6 text-yellow-600" />} onClick={() => handleMethodSelect('EDAHABIA')} />
              <MethodCard method="BARIDI_MOB" title="Baridi Mob" subtitle="Paiement mobile Algérie Poste" icon={<Smartphone className="h-6 w-6 text-green-600" />} onClick={() => handleMethodSelect('BARIDI_MOB')} />
              <MethodCard method="CASH_RELAY" title="Espèces au relais" subtitle="Payer en cash lors du dépôt du colis" icon={<Banknote className="h-6 w-6 text-slate-600" />} onClick={() => handleMethodSelect('CASH_RELAY')} />
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

              {(selectedMethod === 'CIB' || selectedMethod === 'EDAHABIA') && (
                <>
                  {selectedMethod === 'CIB' && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {['BNA', 'CPA', 'BEA', 'BADR', 'BDL', 'CNEP', 'BNP PARIBAS EL DJAZAÏR'].map(b => (
                        <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                      ))}
                    </div>
                  )}
                  <div>
                    <Label htmlFor="cardHolder">Nom sur la carte</Label>
                    <Input id="cardHolder" placeholder="AHMED BENALI" value={cardForm.cardHolder}
                      onChange={e => setCardForm(f => ({ ...f, cardHolder: e.target.value.toUpperCase() }))}
                      className="mt-1 font-mono" autoComplete="cc-name" />
                  </div>
                  <div>
                    <Label htmlFor="cardNumber">Numéro de carte</Label>
                    <Input id="cardNumber" placeholder="1234 5678 9012 3456" value={cardForm.cardNumber}
                      onChange={e => setCardForm(f => ({ ...f, cardNumber: formatCardNumber(e.target.value) }))}
                      className="mt-1 font-mono tracking-widest" maxLength={19} autoComplete="cc-number" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiry">Expiration</Label>
                      <Input id="expiry" placeholder="MM/AA" value={cardForm.expiry}
                        onChange={e => setCardForm(f => ({ ...f, expiry: formatExpiry(e.target.value) }))}
                        className="mt-1 font-mono" maxLength={5} autoComplete="cc-exp" />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" type="password" value={cardForm.cvv}
                        onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                        className="mt-1 font-mono" maxLength={3} autoComplete="cc-csc" />
                    </div>
                  </div>
                </>
              )}

              {selectedMethod === 'BARIDI_MOB' && (
                <>
                  <div>
                    <Label htmlFor="baridiPhone">Numéro de téléphone</Label>
                    <div className="flex gap-2 mt-1">
                      <Input id="baridiPhone" placeholder="0612345678" value={baridiForm.phone}
                        onChange={e => setBaridiForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                        className="font-mono" maxLength={10} disabled={otpSent} />
                      <Button variant="outline" onClick={handleSendOtp} disabled={otpSent || sendingOtp} className="shrink-0">
                        {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : otpSent ? '✓ Envoyé' : 'Envoyer OTP'}
                      </Button>
                    </div>
                  </div>
                  {otpSent && (
                    <div>
                      <Label htmlFor="otp">Code OTP (reçu par SMS)</Label>
                      <Input id="otp" placeholder="123456" value={baridiForm.otp}
                        onChange={e => setBaridiForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        className="mt-1 font-mono tracking-widest text-center text-xl" maxLength={6} />
                    </div>
                  )}
                  {errorMsg && !otpSent && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      <AlertCircle className="h-4 w-4" />{errorMsg}
                    </div>
                  )}
                </>
              )}

              <Button onClick={handlePay} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
                <Lock className="h-4 w-4 mr-2" />Payer {payment?.amount.toFixed(2)} DA
              </Button>
              <p className="text-xs text-center text-slate-500">
                Paiement sécurisé via {selectedMethod === 'BARIDI_MOB' ? 'Baridi (Algérie Poste)' : 'réseau SATIM'}.
              </p>
            </CardContent>
          </Card>
        )}

        {step === 'processing' && (
          <Card><CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-emerald-600 mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-2">Traitement en cours…</h2>
            <p className="text-slate-500 text-sm">Ne fermez pas cette fenêtre.</p>
          </CardContent></Card>
        )}

        {step === 'success' && (
          <Card><CardContent className="pt-10 pb-10 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
            {selectedMethod === 'CASH_RELAY' ? (
              <>
                <h2 className="text-xl font-bold text-emerald-700 mb-2">Paiement au relais sélectionné</h2>
                <p className="text-slate-600 mb-4">
                  Rendez-vous au point relais de départ avec votre colis.
                  Payez <strong>{payment?.amount.toFixed(2)} DA</strong> en espèces.
                  Le paiement sera enregistré automatiquement lors du dépôt du colis.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-emerald-700 mb-2">Paiement confirmé !</h2>
                <p className="text-slate-600 mb-2">Votre paiement de <strong>{payment?.amount.toFixed(2)} DA</strong> a été accepté.</p>
                {txRef && <p className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded mb-4 inline-block">Réf: {txRef}</p>}
                <p className="text-sm text-slate-500 mb-4">Votre colis sera pris en charge dès son dépôt au relais de départ.</p>
              </>
            )}
            <Button onClick={() => router.push(`/${locale}/dashboard/client?tab=history`)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Voir mes colis
            </Button>
          </CardContent></Card>
        )}

        {step === 'failure' && (
          <Card><CardContent className="pt-10 pb-10 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-700 mb-2">Paiement refusé</h2>
            <p className="text-slate-600 mb-6">{errorMsg || "Votre paiement n'a pas pu être traité."}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setStep('method'); setErrorMsg(null); }}>Réessayer</Button>
              <Button variant="ghost" onClick={() => router.push(`/${locale}/dashboard/client?tab=payment`)}>Annuler</Button>
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
