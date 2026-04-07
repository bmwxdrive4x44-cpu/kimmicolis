'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Plus, X, Loader2, CheckCircle, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type AvailableLine = {
  villeDepart: string;
  villeArrivee: string;
  isActive?: boolean;
};

type SimpleForm = {
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  villeArrivee: string;
  weight: string;
};

type AdvancedForm = SimpleForm & {
  villeDepart: string;
  description: string;
  relaisArriveeId: string;
};

type RelayOption = {
  id: string;
  commerceName: string;
  address: string;
  ville: string;
};

type CreatedColis = {
  id: string;
  trackingNumber: string;
  prixClient: number;
  villeDepart: string;
  villeArrivee: string;
  status: string;
};

/* ─── Props ─────────────────────────────────────────────────────────────────── */
interface EnseigneQuickCreateModalProps {
  /** Ville de départ par défaut (operationalCity de l'enseigne) */
  defaultVilleDepart?: string;
  /** Callback appelé après création réussie */
  onCreated?: (colis: CreatedColis) => void;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */
export function EnseigneQuickCreateModal({ defaultVilleDepart = '', onCreated }: EnseigneQuickCreateModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [availableLines, setAvailableLines] = useState<AvailableLine[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [hasLoadedLines, setHasLoadedLines] = useState(false);
  const [relaisArriveeOptions, setRelaisArriveeOptions] = useState<RelayOption[]>([]);
  const [isLoadingRelaisArrivee, setIsLoadingRelaisArrivee] = useState(false);

  // Created colis — triggers payment popup
  const [createdColis, setCreatedColis] = useState<CreatedColis | null>(null);

  const emptySimple: SimpleForm = {
    recipientFirstName: '',
    recipientLastName: '',
    recipientPhone: '',
    villeArrivee: '',
    weight: '1',
  };

  const [form, setForm] = useState<AdvancedForm>({
    ...emptySimple,
    villeDepart: defaultVilleDepart,
    description: '',
    relaisArriveeId: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AdvancedForm, string>>>({});

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (!open || hasLoadedLines) return;

    let cancelled = false;
    const loadAvailableLines = async () => {
      setIsLoadingLines(true);
      try {
        const res = await fetch('/api/lignes', { method: 'GET' });
        if (!res.ok) throw new Error('Failed to load lines');
        const lines = (await res.json()) as AvailableLine[];
        if (cancelled) return;
        setAvailableLines((Array.isArray(lines) ? lines : []).filter((line) => line?.isActive !== false));
      } catch {
        if (cancelled) return;
        setAvailableLines([]);
      } finally {
        if (cancelled) return;
        setIsLoadingLines(false);
        setHasLoadedLines(true);
      }
    };

    loadAvailableLines();
    return () => {
      cancelled = true;
    };
  }, [open, hasLoadedLines]);

  const departureCities = useMemo(() => {
    return Array.from(new Set(availableLines.map((line) => line.villeDepart?.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [availableLines]);

  const effectiveVilleDepart = (advanced || !defaultVilleDepart) ? form.villeDepart : defaultVilleDepart;

  const arrivalCities = useMemo(() => {
    if (!effectiveVilleDepart) return [];
    return Array.from(
      new Set(
        availableLines
          .filter((line) => line.villeDepart?.trim() === effectiveVilleDepart)
          .map((line) => line.villeArrivee?.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [availableLines, effectiveVilleDepart]);

  useEffect(() => {
    if (form.villeArrivee && !arrivalCities.includes(form.villeArrivee)) {
      setForm((prev) => ({ ...prev, villeArrivee: '', relaisArriveeId: '' }));
    }
  }, [arrivalCities, form.villeArrivee]);

  useEffect(() => {
    if (!form.villeArrivee) {
      setRelaisArriveeOptions([]);
      setForm((prev) => (prev.relaisArriveeId ? { ...prev, relaisArriveeId: '' } : prev));
      return;
    }

    let cancelled = false;
    const loadRelaisArrivee = async () => {
      setIsLoadingRelaisArrivee(true);
      try {
        const res = await fetch(`/api/relais?status=APPROVED&ville=${encodeURIComponent(form.villeArrivee)}`);
        const data = (await res.json().catch(() => [])) as RelayOption[];
        if (cancelled) return;

        const options = Array.isArray(data)
          ? data
              .filter((r) => r?.id && r?.commerceName)
              .map((r) => ({
                id: r.id,
                commerceName: r.commerceName,
                address: r.address || 'Adresse non renseignée',
                ville: r.ville,
              }))
          : [];

        setRelaisArriveeOptions(options);
        setForm((prev) => {
          if (prev.relaisArriveeId && options.some((r) => r.id === prev.relaisArriveeId)) return prev;
          return { ...prev, relaisArriveeId: options[0]?.id || '' };
        });
      } catch {
        if (cancelled) return;
        setRelaisArriveeOptions([]);
        setForm((prev) => ({ ...prev, relaisArriveeId: '' }));
      } finally {
        if (!cancelled) setIsLoadingRelaisArrivee(false);
      }
    };

    loadRelaisArrivee();
    return () => {
      cancelled = true;
    };
  }, [form.villeArrivee]);

  const selectedRelaisArrivee = useMemo(
    () => relaisArriveeOptions.find((r) => r.id === form.relaisArriveeId) || null,
    [relaisArriveeOptions, form.relaisArriveeId]
  );

  function validate(): boolean {
    const e: Partial<Record<keyof AdvancedForm, string>> = {};
    if (!form.recipientFirstName.trim()) e.recipientFirstName = 'Prénom requis';
    if (!form.recipientLastName.trim()) e.recipientLastName = 'Nom requis';
    if (!form.recipientPhone.trim()) e.recipientPhone = 'Téléphone requis';
    if (!form.villeArrivee) e.villeArrivee = 'Ville arrivée requise';
    if (advanced && !form.villeDepart) e.villeDepart = 'Ville départ requise';
    const w = Number(form.weight);
    if (!Number.isFinite(w) || w <= 0) e.weight = 'Poids invalide (ex: 1.5)';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/parcels/quick-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientFirstName: form.recipientFirstName.trim(),
          recipientLastName: form.recipientLastName.trim(),
          recipientPhone: form.recipientPhone.trim(),
          villeDepart: advanced ? form.villeDepart : (defaultVilleDepart || undefined),
          villeArrivee: form.villeArrivee,
          relaisArriveeId: form.relaisArriveeId || undefined,
          weight: Number(form.weight),
          description: form.description.trim() || undefined,
          deliveryType: 'relay',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Erreur création', description: data.error || 'Erreur inattendue', variant: 'destructive' });
        return;
      }

      // Reset form
      setForm({ ...emptySimple, villeDepart: defaultVilleDepart, description: '', relaisArriveeId: '' });
      setErrors({});

      // Show payment popup
      setCreatedColis(data.colis);
      onCreated?.(data.colis);
    } catch {
      toast({ title: 'Erreur réseau', description: 'Impossible de contacter le serveur', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePayNow() {
    if (!createdColis) return;
    // Store in session for the payment queue
    const queue = [{ colisId: createdColis.id, amount: createdColis.prixClient, trackingNumber: createdColis.trackingNumber }];
    sessionStorage.setItem('swiftcolis_payment_queue', JSON.stringify(queue));
    startTransition(() => {
      router.push(`/${locale}/dashboard/enseigne?tab=payments#enseigne-payments`);
      setCreatedColis(null);
      setOpen(false);
    });
  }

  function handlePayLater() {
    setCreatedColis(null);
    // Refresh dashboard so new colis appears in tracker
    router.refresh();
    toast({
      title: 'Colis créé',
      description: `#${createdColis?.trackingNumber} — pensez à payer avant expédition.`,
    });
    setOpen(false);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <Plus className="h-4 w-4" />
        Créer un colis
      </button>

      {/* Overlay */}
      {isMounted && open && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !createdColis && setOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl mx-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Nouveau colis</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Création rapide — en 30 secondes</p>
              </div>
              <button
                type="button"
                onClick={() => !createdColis && setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[70vh] px-6 py-5 space-y-4">
              {/* Mode badge */}
              <div className="flex items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-semibold ${!advanced ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  🟢 Mode simple
                </span>
                <span className={`rounded-full px-2.5 py-1 font-semibold ${advanced ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  🔵 Mode avancé
                </span>
              </div>

              {/* Recipient section */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Destinataire</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Prénom *"
                      value={form.recipientFirstName}
                      onChange={(e) => setForm({ ...form, recipientFirstName: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    {errors.recipientFirstName && <p className="mt-1 text-xs text-red-600">{errors.recipientFirstName}</p>}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Nom *"
                      value={form.recipientLastName}
                      onChange={(e) => setForm({ ...form, recipientLastName: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    {errors.recipientLastName && <p className="mt-1 text-xs text-red-600">{errors.recipientLastName}</p>}
                  </div>
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder="Téléphone * (ex: 0555123456)"
                    value={form.recipientPhone}
                    onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  {errors.recipientPhone && <p className="mt-1 text-xs text-red-600">{errors.recipientPhone}</p>}
                </div>
              </fieldset>

              {/* Route section */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Itinéraire</legend>
                {/* Ville départ only in advanced or when no default */}
                {(advanced || !defaultVilleDepart) && (
                  <div>
                    <select
                      value={form.villeDepart}
                      onChange={(e) => setForm({ ...form, villeDepart: e.target.value })}
                      disabled={isLoadingLines}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">{isLoadingLines ? 'Chargement des départs...' : 'Ville de départ *'}</option>
                      {departureCities.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                    {errors.villeDepart && <p className="mt-1 text-xs text-red-600">{errors.villeDepart}</p>}
                  </div>
                )}
                {!advanced && defaultVilleDepart && (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                    <span className="text-slate-400">Départ:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{defaultVilleDepart}</span>
                    <span className="ml-auto text-xs text-slate-400">(votre ville d'opération)</span>
                  </div>
                )}
                <div>
                  <select
                    value={form.villeArrivee}
                    onChange={(e) => setForm({ ...form, villeArrivee: e.target.value })}
                    disabled={isLoadingLines || !effectiveVilleDepart || arrivalCities.length === 0}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">
                      {isLoadingLines
                        ? 'Chargement des destinations...'
                        : (!effectiveVilleDepart ? 'Sélectionnez d\'abord une ville de départ' : 'Wilaya de livraison *')}
                    </option>
                    {arrivalCities.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                  {errors.villeArrivee && <p className="mt-1 text-xs text-red-600">{errors.villeArrivee}</p>}
                  {!isLoadingLines && effectiveVilleDepart && arrivalCities.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">Aucune destination active disponible pour cette ville de départ.</p>
                  )}
                </div>
              </fieldset>

              {/* Parcel weight */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                  Poids (kg)
                </label>
                <div className="flex gap-2">
                  {[0.5, 1, 2, 5].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setForm({ ...form, weight: String(w) })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        form.weight === String(w)
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {w} kg
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="Autre"
                    value={[0.5, 1, 2, 5].map(String).includes(form.weight) ? '' : form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-center text-sm focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                {errors.weight && <p className="mt-1 text-xs text-red-600">{errors.weight}</p>}
              </div>

              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => setAdvanced(!advanced)}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-700"
              >
                <span>{advanced ? 'Masquer les options avancées' : 'Options avancées (adresse, description…)'}</span>
                {advanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {/* Advanced section */}
              {advanced && (
                <fieldset className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
                  <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Mode avancé</legend>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Le ramassage à domicile n'est pas disponible pour un seul colis. Utilisez l'import CSV pour les envois multiples.
                  </div>

                  {/* Destination relay selection */}
                  <div>
                    <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">Relais de destination</p>
                    <select
                      value={form.relaisArriveeId}
                      onChange={(e) => setForm({ ...form, relaisArriveeId: e.target.value })}
                      disabled={isLoadingRelaisArrivee || !form.villeArrivee || relaisArriveeOptions.length === 0}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">
                        {isLoadingRelaisArrivee
                          ? 'Chargement des relais...'
                          : (!form.villeArrivee ? 'Sélectionnez d\'abord la ville de livraison' : 'Choisir un relais')}
                      </option>
                      {relaisArriveeOptions.map((relay) => (
                        <option key={relay.id} value={relay.id}>{relay.commerceName}</option>
                      ))}
                    </select>

                    {selectedRelaisArrivee && (
                      <div className="mt-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <p className="font-semibold text-blue-700 dark:text-blue-300">Adresse du relais destination</p>
                        <p className="mt-1">{selectedRelaisArrivee.commerceName}</p>
                        <p>{selectedRelaisArrivee.address}</p>
                        <p className="text-slate-500">{selectedRelaisArrivee.ville}</p>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <input
                      type="text"
                      placeholder="Description du colis (facultatif)"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      maxLength={200}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </fieldset>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Création…</>
                  ) : (
                    <>Créer en 1 clic</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Payment required popup ──────────────────────────────────────────── */}
      {isMounted && createdColis && createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            {/* Accent header */}
            <div className="bg-amber-500 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-white" />
                <p className="font-semibold">Colis créé avec succès !</p>
              </div>
              <p className="mt-1 font-mono text-sm text-amber-100">#{createdColis.trackingNumber}</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Warning */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  ⚠️ Paiement requis pour activer la livraison
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Sans paiement confirmé, votre colis reste hors circuit logistique et ne peut pas être expédié.
                </p>
              </div>

              {/* Price */}
              <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">Montant à régler</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {Math.round(createdColis.prixClient).toLocaleString('fr-DZ')} DA
                </span>
              </div>

              {/* Route */}
              <p className="text-center text-xs text-slate-500">
                {createdColis.villeDepart} → {createdColis.villeArrivee}
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Payer maintenant
                </button>
                <button
                  type="button"
                  onClick={handlePayLater}
                  className="rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Plus tard (rappel affiché sur le dashboard)
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
