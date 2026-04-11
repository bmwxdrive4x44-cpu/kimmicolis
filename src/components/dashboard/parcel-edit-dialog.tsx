'use client';

import { useMemo, useState } from 'react';
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
  const [form, setForm] = useState({
    recipientFirstName: parcel.recipientFirstName || '',
    recipientLastName: parcel.recipientLastName || '',
    recipientPhone: parcel.recipientPhone || '',
    recipientEmail: parcel.recipientEmail || '',
    weight: parcel.weight ? String(parcel.weight) : '1',
    description: parcel.description || '',
  });

  const canEdit = useMemo(() => EDITABLE_STATUSES.has(parcel.status), [parcel.status]);

  const handleSave = async () => {
    if (!canEdit) {
      toast({ title: 'Modification impossible', description: 'Ce colis est déjà payé ou en cours de traitement.', variant: 'destructive' });
      return;
    }

    if (!form.recipientFirstName.trim() || !form.recipientLastName.trim()) {
      toast({ title: 'Erreur', description: 'Nom et prénom destinataire sont obligatoires.', variant: 'destructive' });
      return;
    }

    if (!/^\+?[0-9]{8,15}$/.test(form.recipientPhone.replace(/\s+/g, '').trim())) {
      toast({ title: 'Erreur', description: 'Téléphone destinataire invalide.', variant: 'destructive' });
      return;
    }

    const trimmedRecipientEmail = form.recipientEmail.trim().toLowerCase();
    if (trimmedRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedRecipientEmail)) {
      toast({ title: 'Erreur', description: 'Email destinataire invalide.', variant: 'destructive' });
      return;
    }

    const weight = Number(form.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      toast({ title: 'Erreur', description: 'Poids invalide.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/parcels/${parcel.id}`, {
        method: 'PATCH',
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
        <Button size="sm" variant="outline" disabled={!canEdit} title={!canEdit ? 'Modification possible uniquement avant paiement' : undefined}>
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
              <Input value={form.recipientFirstName} onChange={(e) => setForm((p) => ({ ...p, recipientFirstName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nom destinataire</Label>
              <Input value={form.recipientLastName} onChange={(e) => setForm((p) => ({ ...p, recipientLastName: e.target.value }))} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Téléphone destinataire</Label>
              <Input value={form.recipientPhone} onChange={(e) => setForm((p) => ({ ...p, recipientPhone: e.target.value }))} placeholder="0555123456" />
            </div>
            <div className="space-y-1.5">
              <Label>Email destinataire (optionnel)</Label>
              <Input type="email" value={form.recipientEmail} onChange={(e) => setForm((p) => ({ ...p, recipientEmail: e.target.value }))} placeholder="destinataire@email.com" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Poids (kg)</Label>
            <Input type="number" step="0.1" min="0.1" value={form.weight} onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Description (optionnel)</Label>
            <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
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
      const res = await fetch(`/api/parcels/${parcel.id}`, { method: 'DELETE' });
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
