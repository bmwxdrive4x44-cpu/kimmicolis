'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormGlobalError } from '@/components/ui/form-error';
import { useToast } from '@/hooks/use-toast';

type EnseigneProfile = {
  businessName: string;
  legalName: string | null;
  website: string | null;
  logoUrl: string | null;
  monthlyVolume: number;
  billingEmail: string | null;
  operationalCity: string | null;
};

export function EnseigneProfileCard({ initialProfile }: { initialProfile: EnseigneProfile }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessName: initialProfile.businessName || '',
    legalName: initialProfile.legalName || '',
    website: initialProfile.website || '',
    logoUrl: initialProfile.logoUrl || '',
    monthlyVolume: String(initialProfile.monthlyVolume ?? 0),
    billingEmail: initialProfile.billingEmail || '',
    operationalCity: initialProfile.operationalCity || '',
  });

  const onChange = (key: keyof typeof form, value: string) => {
    setSubmitError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    setIsSaving(true);
    try {
      const response = await fetch('/api/enseignes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          legalName: form.legalName,
          website: form.website,
          logoUrl: form.logoUrl,
          monthlyVolume: Number.parseInt(form.monthlyVolume, 10),
          billingEmail: form.billingEmail,
          operationalCity: form.operationalCity,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || 'Impossible de sauvegarder le profil enseigne';
        setSubmitError(message);
        return;
      }

      toast({ title: 'Profil enseigne mis a jour' });
    } catch {
      setSubmitError('Erreur reseau, veuillez reessayer.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Profil enseigne</h3>
      <p className="mt-1 text-sm text-slate-600">
        Mettez a jour vos informations B2B utilisees par l''equipe operationnelle.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <FormGlobalError message={submitError} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nom commercial</Label>
            <Input value={form.businessName} onChange={(e) => onChange('businessName', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Raison sociale</Label>
            <Input value={form.legalName} onChange={(e) => onChange('legalName', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Site web</Label>
            <Input value={form.website} onChange={(e) => onChange('website', e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>URL logo</Label>
            <Input value={form.logoUrl} onChange={(e) => onChange('logoUrl', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Volume mensuel</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.monthlyVolume}
              onChange={(e) => onChange('monthlyVolume', e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Email facturation</Label>
            <Input
              type="email"
              value={form.billingEmail}
              onChange={(e) => onChange('billingEmail', e.target.value)}
              placeholder="facturation@enseigne.dz"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Ville operationnelle</Label>
          <Input value={form.operationalCity} onChange={(e) => onChange('operationalCity', e.target.value)} />
        </div>

        <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? 'Enregistrement...' : 'Enregistrer le profil'}
        </Button>
      </form>
    </section>
  );
}
