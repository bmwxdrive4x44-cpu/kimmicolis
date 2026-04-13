'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Trash2 } from 'lucide-react';

export type EditableParcel = {
  id: string;
  status: string;
  recipientFirstName?: string | null;
  recipientLastName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  weight?: number | null;
  description?: string | null;
};

const EDITABLE_STATUSES = new Set(['CREATED', 'PENDING_PAYMENT', 'ANNULE']);

export function ParcelEditDialog({
  parcel,
  onSaved,
  buttonLabel = 'Modifier',
}: {
  parcel: EditableParcel;
  onSaved?: (updatedParcel: EditableParcel) => void;
  buttonLabel?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    recipientFirstName: parcel.recipientFirstName || '',
    recipientLastName: parcel.recipientLastName || '',
    recipientPhone: parcel.recipientPhone || '',
    recipientEmail: parcel.recipientEmail || '',
    weight: parcel.weight ? String(parcel.weight) : '1',
    description: parcel.description || '',
  });

  const canEdit = useMemo(() => EDITABLE_STATUSES.has(parcel.status), [parcel.status]);

  useEffect(() => {
    if (!open) {
      setForm({
        recipientFirstName: parcel.recipientFirstName || '',
        recipientLastName: parcel.recipientLastName || '',
        recipientPhone: parcel.recipientPhone || '',
        recipientEmail: parcel.recipientEmail || '',
        weight: parcel.weight ? String(parcel.weight) : '1',
        description: parcel.description || '',
      });
      setFieldErrors({});
    }
  }, [open, parcel]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const normalizedPhone = form.recipientPhone.replace(/\s+/g, '').trim();
    const trimmedRecipientEmail = form.recipientEmail.trim().toLowerCase();
    const weight = Number(form.weight);

    if (!form.recipientFirstName.trim()) errors.recipientFirstName = 'Le prénom destinataire est obligatoire.';
    if (!form.recipientLastName.trim()) errors.recipientLastName = 'Le nom destinataire est obligatoire.';
    if (!normalizedPhone) {
      errors.recipientPhone = 'Le téléphone destinataire est obligatoire.';
    } else if (!/^\+?[0-9]{8,15}$/.test(normalizedPhone)) {
      errors.recipientPhone = 'Téléphone destinataire invalide.';
    }
    if (trimmedRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedRecipientEmail)) {
      errors.recipientEmail = 'Email destinataire invalide.';
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      errors.weight = 'Le poids doit être supérieur à 0.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast({ title: 'Modification impossible', description: 'Ce colis est déjà payé ou en cours de traitement.', variant: 'destructive' });
      return;
    }

    if (!validateForm()) {
      toast({ title: 'Erreur', description: 'Veuillez corriger les champs obligatoires.', variant: 'destructive' });
      return;
    }

    const trimmedRecipientEmail = form.recipientEmail.trim().toLowerCase();
    const weight = Number(form.weight);

    setSaving(true);
    try {
      const res = await fetch(`/api/parcels/${parcel.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientFirstName: form.recipientFirstName.trim(),
          recipientLastName: form.recipientLastName.trim(),
          recipientPhone: form.recipientPhone.replace(/\s+/g, '').trim(),
          recipientEmail: trimmedRecipientEmail || null,
          weight,
          description: form.description.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Impossible de modifier ce colis');
      }

      toast({ title: 'Colis modifié', description: 'Les changements ont été enregistrés.' });
      setOpen(false);
      setFieldErrors({});
      onSaved?.({
        ...parcel,
        recipientFirstName: form.recipientFirstName.trim(),
        recipientLastName: form.recipientLastName.trim(),
        recipientPhone: form.recipientPhone.replace(/\s+/g, '').trim(),
        recipientEmail: trimmedRecipientEmail || null,
        weight,
        description: form.description.trim(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inattendue';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={!canEdit} title={!canEdit ? 'Modification possible uniquement avant paiement' : undefined}>
          <Pencil className="h-3 w-3 mr-1" />{buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le colis</DialogTitle>
          <DialogDescription>
            Modification autorisee uniquement avant paiement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prénom destinataire</Label>
              <Input className={fieldErrors.recipientFirstName ? 'border-red-500 focus-visible:ring-red-500' : ''} value={form.recipientFirstName} onChange={(e) => updateField('recipientFirstName', e.target.value)} />
              {fieldErrors.recipientFirstName && <p className="text-xs text-red-600">{fieldErrors.recipientFirstName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Nom destinataire</Label>
              <Input className={fieldErrors.recipientLastName ? 'border-red-500 focus-visible:ring-red-500' : ''} value={form.recipientLastName} onChange={(e) => updateField('recipientLastName', e.target.value)} />
              {fieldErrors.recipientLastName && <p className="text-xs text-red-600">{fieldErrors.recipientLastName}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Téléphone destinataire</Label>
              <Input className={fieldErrors.recipientPhone ? 'border-red-500 focus-visible:ring-red-500' : ''} value={form.recipientPhone} onChange={(e) => updateField('recipientPhone', e.target.value)} placeholder="0555123456" />
              {fieldErrors.recipientPhone && <p className="text-xs text-red-600">{fieldErrors.recipientPhone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email destinataire (optionnel)</Label>
              <Input className={fieldErrors.recipientEmail ? 'border-red-500 focus-visible:ring-red-500' : ''} type="email" value={form.recipientEmail} onChange={(e) => updateField('recipientEmail', e.target.value)} placeholder="destinataire@email.com" />
              {fieldErrors.recipientEmail && <p className="text-xs text-red-600">{fieldErrors.recipientEmail}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Poids (kg)</Label>
            <Input className={fieldErrors.weight ? 'border-red-500 focus-visible:ring-red-500' : ''} type="number" step="0.1" min="0.1" value={form.weight} onChange={(e) => updateField('weight', e.target.value)} />
            {fieldErrors.weight && <p className="text-xs text-red-600">{fieldErrors.weight}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Description (optionnel)</Label>
            <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => {
            setOpen(false);
            setFieldErrors({});
          }}>Annuler</Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ParcelDeleteButton({
  parcel,
  onSaved,
}: {
  parcel: EditableParcel;
  onSaved?: (deletedParcelId: string) => void;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const canEdit = useMemo(() => EDITABLE_STATUSES.has(parcel.status), [parcel.status]);

  const handleDelete = async () => {
    if (!canEdit) {
      toast({ title: 'Suppression impossible', description: 'Ce colis est déjà payé ou en cours de traitement.', variant: 'destructive' });
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/parcels/${parcel.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Impossible de supprimer ce colis');

      toast({ title: 'Colis supprimé', description: 'Suppression définitive effectuée.' });
      onSaved?.(parcel.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inattendue';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={!canEdit || deleting}
          title={!canEdit ? 'Suppression possible uniquement avant paiement' : undefined}
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
          Supprimer
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer la suppression du colis</AlertDialogTitle>
          <AlertDialogDescription>
            Ce colis est non payé. Si vous confirmez, il sera supprimé définitivement avec son historique lié et vous ne pourrez pas annuler cette action.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Supprimer définitivement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
