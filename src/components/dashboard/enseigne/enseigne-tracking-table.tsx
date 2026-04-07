'use client';

import { ParcelDeleteButton, ParcelEditDialog } from '@/components/dashboard/parcel-edit-dialog';
import { ParcelLabelButton, ParcelLabelsBulkButton, type LabelParcel } from '@/components/dashboard/parcel-label-button';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  if (parcels.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        Aucun colis pour le moment. Commencez par un import CSV ou une creation manuelle.
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{parcels.length} colis</p>
        <ParcelLabelsBulkButton parcels={parcels} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Tracking</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Destinataire</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Route</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Statut</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Montant</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {parcels.map((parcel) => {
            const statusMeta = getStatusMeta(parcel.status);
            return (
              <tr key={parcel.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{parcel.trackingNumber}</td>
                <td className="px-4 py-3 text-slate-700">{parcel.recipientFirstName || '—'} {parcel.recipientLastName || ''}</td>
                <td className="px-4 py-3 text-slate-600">{parcel.villeDepart} - {parcel.villeArrivee}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">{Math.round(parcel.prixClient)} DA</td>
                <td className="px-4 py-3 text-slate-600">{new Date(parcel.createdAt).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ParcelLabelButton parcel={parcel} />
                    <ParcelEditDialog parcel={parcel} onSaved={() => router.refresh()} buttonLabel="Modifier" />
                    <ParcelDeleteButton parcel={parcel} onSaved={() => router.refresh()} />
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
