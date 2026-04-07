'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import { WILAYAS } from '@/lib/constants';

export type LabelParcel = {
  id: string;
  trackingNumber: string;
  villeDepart: string;
  villeArrivee: string;
  senderFirstName?: string | null;
  senderLastName?: string | null;
  senderPhone?: string | null;
  recipientFirstName?: string | null;
  recipientLastName?: string | null;
  recipientPhone?: string | null;
  weight?: number | null;
  description?: string | null;
  prixClient: number;
  qrCodeImage?: string | null;
  relaisDepart?: { commerceName: string; address: string; ville: string } | null;
  relaisArrivee?: { commerceName: string; address: string; ville: string } | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLabelHtml(parcels: LabelParcel[]): string {
  const css = `
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; background: #fff; }
    .page { padding: 14px; }
    .label {
      border: 1.5px solid #0f172a;
      border-radius: 10px;
      padding: 18px;
      margin: 12px auto;
      max-width: 720px;
      background: #ffffff;
      box-shadow: 0 0 0 2px #ecfeff inset;
      page-break-after: always;
      page-break-inside: avoid;
    }
    .label:last-child { page-break-after: auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 10px; }
    .brand { font-size: 24px; font-weight: 900; color: #0f766e; letter-spacing: -0.5px; }
    .stamp {
      border: 1px solid #99f6e4;
      color: #115e59;
      background: #ecfeff;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .7px;
    }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .tracking-badge {
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: 800;
      background: #f0fdfa;
      border: 1.5px solid #5eead4;
      border-radius: 6px;
      padding: 4px 12px;
    }
    .route-bar {
      background: linear-gradient(90deg, #0f766e, #0ea5a4);
      color: #fff;
      text-align: center;
      padding: 9px;
      font-weight: 700;
      font-size: 15px;
      border-radius: 5px;
      margin-bottom: 12px;
    }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .box {
      border: 1px solid #cbd5e1;
      padding: 10px;
      border-radius: 6px;
      background: #f8fafc;
    }
    .box-relay {
      border: 1px solid #a5f3fc;
      background: #ecfeff;
      padding: 10px;
      border-radius: 6px;
    }
    .label-muted {
      color: #6b7280;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .7px;
      margin-bottom: 3px;
    }
    .name { font-size: 15px; font-weight: 600; }
    .relay-name { font-size: 14px; font-weight: 700; color: #0f766e; }
    .relay-addr { font-size: 12px; color: #374151; margin-top: 2px; }
    .relay-ville { font-size: 12px; color: #6b7280; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
    .meta-chip {
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 5px 10px;
      font-size: 13px;
      background: #f1f5f9;
    }
    .meta-chip.strong { border-color: #99f6e4; background: #ecfeff; color: #115e59; }
    .desc-box {
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 13px;
      margin-bottom: 10px;
      color: #374151;
    }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; margin-top: 4px; }
    .qr-block { text-align: center; }
    .qr-block img { width: 100px; height: 100px; display: block; margin: 0 auto; }
    .qr-hint { font-size: 11px; color: #6b7280; margin-top: 4px; }
    .print-hint {
      margin: 0 auto 8px;
      max-width: 720px;
      font-size: 12px;
      color: #334155;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    @media print {
      body { margin: 0; }
      .page { padding: 0; }
      .print-hint { display: none; }
      .label { margin: 0; border-radius: 0; border: 2px solid #000; box-shadow: none; }
    }
  `;

  const labelsHtml = parcels
    .map((p) => {
      const departName = WILAYAS.find((w) => w.id === p.villeDepart)?.name || p.villeDepart;
      const arriveeName = WILAYAS.find((w) => w.id === p.villeArrivee)?.name || p.villeArrivee;
      const senderName = [p.senderLastName, p.senderFirstName].filter(Boolean).join(' ') || '—';
      const recipientName = [p.recipientLastName, p.recipientFirstName].filter(Boolean).join(' ') || '—';

      return `
      <div class="label">
        <div class="header">
          <div class="brand">SwiftColis</div>
          <div class="header-right">
            <span class="stamp">Etiquette officielle</span>
            <div class="tracking-badge">${escapeHtml(p.trackingNumber)}</div>
          </div>
        </div>

        <div class="route-bar">${escapeHtml(departName)} &rarr; ${escapeHtml(arriveeName)}</div>

        <div class="grid2">
          <div class="box">
            <div class="label-muted">Expediteur</div>
            <div class="name">${escapeHtml(senderName)}</div>
            <div>${escapeHtml(p.senderPhone || '—')}</div>
          </div>
          <div class="box">
            <div class="label-muted">Destinataire</div>
            <div class="name">${escapeHtml(recipientName)}</div>
            <div>${escapeHtml(p.recipientPhone || '—')}</div>
          </div>
        </div>

        <div class="grid2">
          <div class="box-relay">
            <div class="label-muted">Relais de depart</div>
            <div class="relay-name">${escapeHtml(p.relaisDepart?.commerceName || '(non renseigne)')}</div>
            <div class="relay-addr">${escapeHtml(p.relaisDepart?.address || '')}</div>
            <div class="relay-ville">${escapeHtml(p.relaisDepart?.ville || '')}</div>
          </div>
          <div class="box-relay">
            <div class="label-muted">Relais de livraison</div>
            <div class="relay-name">${escapeHtml(p.relaisArrivee?.commerceName || '(non renseigne)')}</div>
            <div class="relay-addr">${escapeHtml(p.relaisArrivee?.address || '')}</div>
            <div class="relay-ville">${escapeHtml(p.relaisArrivee?.ville || '')}</div>
          </div>
        </div>

        <div class="meta-row">
          ${p.weight ? `<div class="meta-chip"><strong>Poids :</strong> ${p.weight} kg</div>` : ''}
          <div class="meta-chip strong"><strong>Suivi :</strong> ${escapeHtml(p.trackingNumber)}</div>
        </div>

        ${p.description ? `<div class="desc-box"><strong>Contenu :</strong> ${escapeHtml(p.description)}</div>` : ''}

        <div class="footer">
          <div></div>
          ${
            p.qrCodeImage
              ? `<div class="qr-block">
                  <img src="${p.qrCodeImage}" alt="QR Code" />
                  <div class="qr-hint">Scanner au relais</div>
                </div>`
              : ''
          }
        </div>
      </div>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="fr"><head>
  <meta charset="UTF-8" />
  <title>Etiquettes - SwiftColis</title>
  <style>${css}</style>
</head>
<body>
  <div class="page">
    <div class="print-hint">Astuce: utilisez Imprimer puis Enregistrer au format PDF pour telecharger l'etiquette.</div>
    ${labelsHtml}
  </div>
</body>
</html>`;
}

function openLabelWindow(html: string, documentTitle: string) {
  const win = window.open('', '_blank', 'width=920,height=1200');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.document.title = documentTitle;
  }

  return win;
}

function triggerPrint(win: Window | null) {
  if (!win) return;

  const waitForImages = async () => {
    const images = Array.from(win.document.images);
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
      )
    );
  };

  const run = () => {
    waitForImages().finally(() => {
      win.focus();
      win.print();
    });
  };

  if (win.document.readyState === 'complete') {
    run();
    return;
  }

  win.addEventListener('load', run, { once: true });
}

export function ParcelLabelButton({ parcel }: { parcel: LabelParcel }) {
  const [printing, setPrinting] = useState(false);

  const buildSingleTitle = () => `Etiquette-${parcel.trackingNumber || parcel.id}`;

  const handlePrint = () => {
    setPrinting(true);
    try {
      const win = openLabelWindow(buildLabelHtml([parcel]), buildSingleTitle());
      triggerPrint(win);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePrint}
      disabled={printing}
      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
      title="Imprimer l'etiquette"
    >
      {printing ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <Printer className="h-3 w-3 mr-1" />
      )}
      Imprimer
    </Button>
  );
}

export function ParcelLabelsBulkButton({ parcels }: { parcels: LabelParcel[] }) {
  const [printing, setPrinting] = useState(false);

  const buildBulkTitle = () => `Etiquettes-${new Date().toISOString().slice(0, 10)}`;

  const handlePrint = () => {
    if (parcels.length === 0) return;
    setPrinting(true);
    try {
      const win = openLabelWindow(buildLabelHtml(parcels), buildBulkTitle());
      triggerPrint(win);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePrint}
      disabled={printing || parcels.length === 0}
      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
      title="Imprimer toutes les etiquettes"
    >
      {printing ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <Printer className="h-3 w-3 mr-1" />
      )}
      Tout imprimer ({parcels.length})
    </Button>
  );
}
