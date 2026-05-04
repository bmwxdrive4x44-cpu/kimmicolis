'use client';

import { useEffect, useState } from 'react';
import { ParcelDeleteButton, ParcelEditDialog, type EditableParcel } from '@/components/dashboard/parcel-edit-dialog';
import { ParcelLabelButton, ParcelLabelsBulkButton, type LabelParcel } from '@/components/dashboard/parcel-label-button';

function getStatusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'CREATED':
      return { label: 'Cree', className: 'border-slate-200 bg-slate-100 text-slate-700' };
    case 'PENDING_PAYMENT':
      return { label: 'Paiement en cours', className: 'border-orange-200 bg-orange-100 text-orange-700' };
    case 'READY_FOR_DEPOSIT':
      return { label: 'Depot au relais', className: 'border-violet-200 bg-violet-100 text-violet-700' };
    case 'WAITING_PICKUP':
      return { label: 'En cours de livraison', className: 'border-sky-200 bg-sky-100 text-sky-700' };
    case 'EN_TRANSPORT':
      return { label: 'En cours de livraison', className: 'border-blue-200 bg-blue-100 text-blue-800' };
    case 'ARRIVE_RELAIS_DESTINATION':
      return { label: 'Depose au relais destination', className: 'border-cyan-200 bg-cyan-100 text-cyan-800' };
    case 'LIVRE':
      return { label: 'Livre', className: 'border-emerald-200 bg-emerald-100 text-emerald-800' };
    default:
      return { label: status, className: 'border-slate-200 bg-slate-100 text-slate-700' };
  }
}

export function EnseigneTrackingTable({
  parcels,
}: {
  parcels: Array<LabelParcel & {
    recipientFirstName: string | null;
    recipientLastName: string | null;
    status: string;
    createdAt: string | Date;
  }>;
}) {
  const [items, setItems] = useState(parcels);

  useEffect(() => {
    setItems(parcels);
  }, [parcels]);

  const handleParcelSaved = (updatedParcel: EditableParcel) => {
    setItems((current) => current.map((parcel) => (parcel.id === updatedParcel.id ? { ...parcel, ...updatedParcel } : parcel)));
  };

  const handleParcelDeleted = (deletedParcelId: string) => {
    setItems((current) => current.filter((parcel) => parcel.id !== deletedParcelId));
  };

  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        Aucun colis pour le moment. Commencez par un import CSV ou une creation manuelle.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-sm font-medium text-slate-600">{items.length} colis</p>
        <ParcelLabelsBulkButton parcels={items} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]">
      <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50/90">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Tracking</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Destinataire</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Route</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Statut</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Montant</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Date</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((parcel) => {
            const statusMeta = getStatusMeta(parcel.status);
            return (
              <tr key={parcel.id} className="transition-colors hover:bg-slate-50/80">
                <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-800">{parcel.trackingNumber}</td>
                <td className="px-5 py-4 text-slate-700">
                  <div className="font-medium text-slate-900">{parcel.recipientFirstName || '—'} {parcel.recipientLastName || ''}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{parcel.recipientPhone || 'Telephone non renseigne'}</div>
                </td>
                <td className="px-5 py-4 text-slate-600">
                  <div className="text-sm font-medium text-slate-700">{parcel.villeDepart} - {parcel.villeArrivee}</div>
                  <div className="mt-0.5 text-xs text-slate-500">Flux logistique</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </td>
                <td className="px-5 py-4 font-semibold text-slate-900">{Math.round(parcel.prixClient)} DA</td>
                <td className="px-5 py-4 text-slate-600">{new Date(parcel.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ParcelLabelButton parcel={parcel} />
                    <ParcelEditDialog parcel={parcel} onSaved={handleParcelSaved} buttonLabel="Modifier" />
                    <ParcelDeleteButton parcel={parcel} onSaved={handleParcelDeleted} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
