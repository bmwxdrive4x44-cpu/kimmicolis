'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2, CreditCard, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const PAYMENT_QUEUE_KEY = 'swiftcolis_payment_queue';

interface UnpaidParcel {
  id: string;
  trackingNumber: string;
  recipientFirstName: string;
  recipientLastName: string;
  villeDepart: string;
  villeArrivee: string;
  prixClient: number;
  createdAt: string;
}

export function EnseignePaymentsTab({ clientId, isPro = false }: { clientId: string; isPro?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();
  const [unpaidParcels, setUnpaidParcels] = useState<UnpaidParcel[]>([]);
  const [stats, setStats] = useState({ unpaidCount: 0, unpaidTotal: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchUnpaidParcels = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/enseignes/payments?clientId=${encodeURIComponent(clientId)}`);
      const data = await response.json();
      if (response.ok) {
        setUnpaidParcels(data.parcels);
        setStats(data.stats);
      } else {
        toast({ title: 'Erreur', description: data.error || 'Erreur lors du chargement', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Erreur reseau', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    fetchUnpaidParcels();
  }, [fetchUnpaidParcels]);

  const selectedTotal = unpaidParcels
    .filter((p) => selectedIds.has(p.id))
    .reduce((sum, p) => sum + p.prixClient, 0);

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === unpaidParcels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaidParcels.map((p) => p.id)));
    }
  };

  const handlePay = async () => {
    if (selectedIds.size === 0) {
      toast({ title: 'Info', description: 'Selectionnez au moins un colis' });
      return;
    }

    setIsProcessing(true);
    try {
      // Creer un payment par colis selectionne
      const selectedParcels = unpaidParcels.filter((p) => selectedIds.has(p.id));
      const results: { paymentId: string; paymentUrl: string }[] = [];

      for (const parcel of selectedParcels) {
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            colisId: parcel.id,
            amount: parcel.prixClient,
            paymentMethod: isPro ? 'STRIPE_TEST' : 'STRIPE_TEST',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({
            title: 'Erreur creation paiement',
            description: `${parcel.trackingNumber}: ${data.error || 'Erreur inconnue'}`,
            variant: 'destructive',
          });
          setIsProcessing(false);
          return;
        }
        results.push({ paymentId: data.paymentId, paymentUrl: data.paymentUrl });
      }

      if (results.length === 0) {
        setIsProcessing(false);
        return;
      }

      // Stocker la queue dans sessionStorage
      const returnUrl = `/${locale}/dashboard/enseigne?tab=payments`;
      const queue = {
        ids: results.map((r) => r.paymentId),
        returnUrl,
      };
      sessionStorage.setItem(PAYMENT_QUEUE_KEY, JSON.stringify(queue));

      // Rediriger vers le checkout du premier payment
      router.push(`/${locale}/payment/checkout?paymentId=${results[0].paymentId}`);
    } catch {
      toast({ title: 'Erreur', description: 'Erreur reseau', variant: 'destructive' });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl font-black tracking-tight text-slate-900">Paiement des colis</CardTitle>
          <CardDescription>
            Selectionnez les colis a payer. Vous serez redirige vers la page de paiement securisee.
            Le matching logistique demarre uniquement apres confirmation du paiement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recap stats */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Colis en attente de paiement</p>
              <p className="mt-1 text-2xl font-bold text-amber-800">{stats.unpaidCount}</p>
              <p className="text-sm text-amber-700">Total: {Math.round(stats.unpaidTotal)} DA</p>
            </div>
            {selectedIds.size > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Selection actuelle</p>
                <p className="mt-1 text-2xl font-bold text-emerald-800">{selectedIds.size} colis</p>
                <p className="text-sm text-emerald-700">A payer: {Math.round(selectedTotal)} DA</p>
              </div>
            )}
          </div>

          {/* Barre d'actions */}
          {!isLoading && unpaidParcels.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectAll}
              >
                {selectedIds.size === unpaidParcels.length ? 'Deselectionner tout' : 'Selectionner tout'}
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  onClick={handlePay}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparation du paiement...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Payer {selectedIds.size} colis — {Math.round(selectedTotal)} DA
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Liste des colis */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : unpaidParcels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <p className="font-medium text-slate-700">Aucun colis en attente de paiement</p>
              <p className="mt-1 text-sm text-slate-500">
                Creez des colis depuis l onglet &quot;Imports CSV&quot; pour les payer ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 shadow-[0_16px_35px_-28px_rgba(15,23,42,0.35)]">
              <table className="min-w-[920px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === unpaidParcels.length && unpaidParcels.length > 0}
                        onChange={handleSelectAll}
                        className="rounded"
                        aria-label="Selectionner tout"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Tracking</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Destinataire</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Route</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Montant</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unpaidParcels.map((parcel) => (
                    <tr
                      key={parcel.id}
                      onClick={() => handleToggleSelect(parcel.id)}
                      className={`cursor-pointer transition-colors ${selectedIds.has(parcel.id) ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(parcel.id)}
                          onChange={() => handleToggleSelect(parcel.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{parcel.trackingNumber}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {parcel.recipientFirstName} {parcel.recipientLastName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {parcel.villeDepart} → {parcel.villeArrivee}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {Math.round(parcel.prixClient)} DA
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(parcel.createdAt).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {selectedIds.size > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-emerald-200 bg-emerald-50">
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-emerald-800">
                        Total selection ({selectedIds.size} colis)
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold text-emerald-800">
                        {Math.round(selectedTotal)} DA
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
