'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Link } from '@/i18n/routing';
import { WILAYAS, generateTrackingNumber, generateQRData } from '@/lib/constants';
import { parseLocaleFloat } from '@/lib/utils';
import { calculateDynamicParcelPricing, estimateSafeDistanceKmByWilayas } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddressAutocompleteInput } from '@/components/ui/address-autocomplete-input';
import { FormGlobalError } from '@/components/ui/form-error';
import { useToast } from '@/hooks/use-toast';
import { normalizePhone, validatePhone } from '@/lib/validators';
import { CheckCircle, CircleHelp, CreditCard, History, Loader2, Package, Plus, Printer } from 'lucide-react';

const LABEL_STORAGE_KEY = 'swiftcolis.parcel-labels';

const RelaySelectionMap = dynamic(
  () => import('@/components/maps/relay-selection-map').then((mod) => mod.RelaySelectionMap),
  { ssr: false }
);

type CreateParcelFormProps = {
  userId: string;
  onCreated: () => void;
  onGoToHistory: () => void;
  onGoToCart: () => void;
};

type LabelPrintMode = 'HOME' | 'RELAY';

type PricingConfig = {
  pricingAdminFee: number;
  pricingRatePerKg: number;
  pricingRatePerKm: number;
  pricingRelayDepartureRate: number;
  pricingRelayArrivalRate: number;
  pricingRelayPrintFee: number;
  pricingRoundTo: number;
  platformCommission: number;
};

type FormState = {
  villeDepart: string;
  villeArrivee: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  description: string;
  weight: string;
  senderFirstName: string;
  senderLastName: string;
  senderPhone: string;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  recipientEmail: string;
  labelPrintMode: LabelPrintMode;
};

const initialPricingConfig: PricingConfig = {
  pricingAdminFee: 50,
  pricingRatePerKg: 120,
  pricingRatePerKm: 2.5,
  pricingRelayDepartureRate: 0.1,
  pricingRelayArrivalRate: 0.1,
  pricingRelayPrintFee: 30,
  pricingRoundTo: 10,
  platformCommission: 10,
};

const initialFormState: FormState = {
  villeDepart: '',
  villeArrivee: '',
  relaisDepartId: '',
  relaisArriveeId: '',
  description: '',
  weight: '',
  senderFirstName: '',
  senderLastName: '',
  senderPhone: '',
  recipientFirstName: '',
  recipientLastName: '',
  recipientPhone: '',
  recipientEmail: '',
  labelPrintMode: 'HOME',
};

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function CreateParcelForm({ userId, onCreated, onGoToHistory, onGoToCart }: CreateParcelFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [relais, setRelais] = useState<any[]>([]);
  const [relayPrinterStatusById, setRelayPrinterStatusById] = useState<Record<string, 'READY' | 'BROKEN' | 'OUT_OF_PAPER' | 'NOT_EQUIPPED'>>({});
  const [lignesActives, setLignesActives] = useState<any[]>([]);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(initialPricingConfig);
  const [createdParcel, setCreatedParcel] = useState<any>(null);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [homeAddress, setHomeAddress] = useState('');
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [calculatedPrice, setCalculatedPrice] = useState<any>(null);

  const formatRelayHours = (relay: any) => {
    if (!relay?.openTime || !relay?.closeTime) return 'Horaires non renseignés';
    return `${relay.openTime} - ${relay.closeTime}`;
  };

  useEffect(() => {
    void fetchRelais();
    void fetchRelayPrinterStatuses();
    void fetchPricingSettings();
    void fetchLignesActives();
  }, []);

  useEffect(() => {
    if (formData.villeDepart && formData.villeArrivee && formData.weight) {
      calculatePrice();
      return;
    }

    setCalculatedPrice(null);
  }, [formData.villeDepart, formData.villeArrivee, formData.weight, formData.labelPrintMode, pricingConfig]);

  const fetchLignesActives = async () => {
    try {
      const res = await fetch('/api/lignes');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLignesActives(data.filter((line: any) => line.isActive !== false));
      }
    } catch {
      // keep empty to preserve manual fallback behavior
    }
  };

  const fetchRelais = async () => {
    try {
      const response = await fetch('/api/relais?status=APPROVED');
      const payload = await response.json();
      setRelais(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Error fetching relais:', error);
    }
  };

  const fetchRelayPrinterStatuses = async () => {
    try {
      const response = await fetch('/api/relais/printers');
      if (!response.ok) return;
      const data = await response.json();
      const rows = Array.isArray(data?.printers) ? data.printers : [];
      const nextMap = rows.reduce((acc: Record<string, 'READY' | 'BROKEN' | 'OUT_OF_PAPER' | 'NOT_EQUIPPED'>, row: any) => {
        if (row?.relaisId) {
          acc[row.relaisId] = row.printerStatus;
        }
        return acc;
      }, {});
      setRelayPrinterStatusById(nextMap);
    } catch {
      // keep empty map as fallback
    }
  };

  const fetchPricingSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (!response.ok) return;
      setPricingConfig({
        pricingAdminFee: Number(data.pricingAdminFee || 50),
        pricingRatePerKg: Number(data.pricingRatePerKg || 120),
        pricingRatePerKm: Number(data.pricingRatePerKm || 2.5),
        pricingRelayDepartureRate: Number(data.pricingRelayDepartureRate || 0.1),
        pricingRelayArrivalRate: Number(data.pricingRelayArrivalRate || 0.1),
        pricingRelayPrintFee: Number(data.pricingRelayPrintFee || 30),
        pricingRoundTo: Number(data.pricingRoundTo || 10),
        platformCommission: Number(data.platformCommission || 10),
      });
    } catch {
      // keep defaults
    }
  };

  const calculatePrice = () => {
    const weightKg = Number(formData.weight || 0);
    const distanceKm = estimateSafeDistanceKmByWilayas(formData.villeDepart, formData.villeArrivee);

    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) {
      setCalculatedPrice(null);
      return;
    }

    const dynamicPricing = calculateDynamicParcelPricing({
      weightKg,
      distanceKm,
      adminFee: pricingConfig.pricingAdminFee,
      ratePerKg: pricingConfig.pricingRatePerKg,
      ratePerKm: pricingConfig.pricingRatePerKm,
      formatMultiplier: 1,
      relayDepartureCommissionRate: pricingConfig.pricingRelayDepartureRate,
      relayArrivalCommissionRate: pricingConfig.pricingRelayArrivalRate,
      platformMarginRate: pricingConfig.platformCommission / 100,
      roundTo: pricingConfig.pricingRoundTo,
    });

    const relayPrintFee = formData.labelPrintMode === 'RELAY' ? pricingConfig.pricingRelayPrintFee : 0;

    setCalculatedPrice({
      ...dynamicPricing,
      relayPrintFee,
      finalClientPrice: dynamicPricing.clientPrice + relayPrintFee,
    });
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setCalculatedPrice(null);
    setCreatedParcel(null);
    setSubmitError(null);
    setFieldErrors({});
  };

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateRequiredFields = () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    const parsedWeight = parseLocaleFloat(formData.weight);

    if (!formData.villeDepart) errors.villeDepart = 'La ville de départ est obligatoire.';
    if (!formData.villeArrivee) errors.villeArrivee = 'La ville d\'arrivée est obligatoire.';
    if (!formData.relaisDepartId) errors.relaisDepartId = 'Le relais de départ est obligatoire.';
    if (!formData.relaisArriveeId) errors.relaisArriveeId = 'Le relais d\'arrivée est obligatoire.';
    if (!formData.weight.trim()) {
      errors.weight = 'Le poids est obligatoire.';
    } else if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      errors.weight = 'Le poids doit être supérieur à 0.';
    }
    if (!formData.senderLastName.trim()) errors.senderLastName = 'Le nom de l\'expéditeur est obligatoire.';
    if (!formData.senderFirstName.trim()) errors.senderFirstName = 'Le prénom de l\'expéditeur est obligatoire.';
    if (!formData.senderPhone.trim()) errors.senderPhone = 'Le téléphone de l\'expéditeur est obligatoire.';
    if (!formData.recipientLastName.trim()) errors.recipientLastName = 'Le nom du destinataire est obligatoire.';
    if (!formData.recipientFirstName.trim()) errors.recipientFirstName = 'Le prénom du destinataire est obligatoire.';
    if (!formData.recipientPhone.trim()) errors.recipientPhone = 'Le téléphone du destinataire est obligatoire.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const printParcelLabel = () => {
    if (!createdParcel) return;

    const departRelay = relais.find((relay: any) => relay.id === formData.relaisDepartId);
    const arriveeRelay = relais.find((relay: any) => relay.id === formData.relaisArriveeId);
    const villeDepart = WILAYAS.find((wilaya) => wilaya.id === formData.villeDepart)?.name || formData.villeDepart;
    const villeArrivee = WILAYAS.find((wilaya) => wilaya.id === formData.villeArrivee)?.name || formData.villeArrivee;
    const dateCreation = new Date().toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8" />
  <title>Étiquette - ${createdParcel.trackingNumber}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: white; color: #111; }
    .label { border: 3px solid #111; padding: 18px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
    .brand { font-size: 32px; font-weight: 900; color: #059669; }
    .tracking-block { text-align: right; }
    .tracking-label { font-size: 13px; text-transform: uppercase; color: #666; letter-spacing: 1px; }
    .tracking-number { font-family: 'Courier New', monospace; font-size: 34px; font-weight: 900; letter-spacing: 3px; }
    .route-banner { background: #059669; color: white; text-align: center; padding: 12px 16px; font-size: 26px; font-weight: 700; letter-spacing: 2px; margin-bottom: 18px; border-radius: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .info-box { border: 2px solid #ccc; border-radius: 6px; padding: 14px; }
    .info-box.sender { border-color: #059669; }
    .info-box.recipient { border-color: #2563eb; }
    .info-box-title { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px; }
    .info-box.sender .info-box-title { color: #059669; }
    .info-box.recipient .info-box-title { color: #2563eb; }
    .info-name { font-size: 20px; font-weight: 700; }
    .info-phone { font-size: 16px; color: #444; }
    .info-city { font-size: 16px; font-weight: 600; }
    .relay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .relay-box { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; }
    .relay-box-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
    .relay-name { font-weight: 700; font-size: 16px; }
    .relay-address { font-size: 14px; color: #555; }
    .bottom-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px; }
    .qr-block { text-align: center; }
    .qr-block img { width: 140px; height: 140px; }
    .qr-label { font-size: 12px; color: #888; margin-top: 4px; }
    .meta-block { font-size: 15px; }
    .meta-block p { margin-bottom: 6px; }
    .meta-bold { font-weight: 700; }
    .withdrawal-box { background: #eff6ff; border: 2px dashed #2563eb; border-radius: 6px; padding: 12px 18px; text-align: center; margin-bottom: 18px; }
    .withdrawal-label { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; margin-bottom: 4px; }
    .withdrawal-code { font-family: 'Courier New', monospace; font-size: 28px; font-weight: 900; color: #1d4ed8; letter-spacing: 5px; }
    .withdrawal-note { font-size: 12px; color: #3b82f6; margin-top: 4px; }
    .instructions { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 4px; padding: 10px 14px; font-size: 13px; color: #92400e; line-height: 1.6; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="label">
  <div class="header">
    <div class="brand">SwiftColis ⚡</div>
    <div class="tracking-block">
      <div class="tracking-label">N° de suivi</div>
      <div class="tracking-number">${createdParcel.trackingNumber}</div>
    </div>
  </div>
  <div class="route-banner">
    ${villeDepart} &rarr; ${villeArrivee}
  </div>
  <div class="info-grid">
    <div class="info-box sender">
      <div class="info-box-title">&#128228; Expéditeur</div>
      <div class="info-name">${formData.senderLastName} ${formData.senderFirstName}</div>
      <div class="info-phone">&#128241; ${formData.senderPhone}</div>
      <div class="info-city">&#128205; ${villeDepart}</div>
    </div>
    <div class="info-box recipient">
      <div class="info-box-title">&#128229; Destinataire</div>
      <div class="info-name">${formData.recipientLastName} ${formData.recipientFirstName}</div>
      <div class="info-phone">&#128241; ${formData.recipientPhone}</div>
      <div class="info-city">&#128205; ${villeArrivee}</div>
    </div>
  </div>
  <div class="relay-grid">
    <div class="relay-box">
      <div class="relay-box-title">Relais dépôt</div>
      <div class="relay-name">${departRelay?.commerceName ?? '—'}</div>
      <div class="relay-address">${departRelay?.address ?? ''}</div>
    </div>
    <div class="relay-box">
      <div class="relay-box-title">Relais destination</div>
      <div class="relay-name">${arriveeRelay?.commerceName ?? '—'}</div>
      <div class="relay-address">${arriveeRelay?.address ?? ''}</div>
    </div>
  </div>
  ${createdParcel.withdrawalCode ? `
  <div class="withdrawal-box">
    <div class="withdrawal-label">&#128273; Code de retrait destinataire</div>
    <div class="withdrawal-code">${createdParcel.withdrawalCode}</div>
    <div class="withdrawal-note">À communiquer uniquement au destinataire</div>
  </div>` : ''}
  <div class="bottom-row">
    ${createdParcel.qrCodeImage ? `
    <div class="qr-block">
      <img src="${createdParcel.qrCodeImage}" alt="QR Code" />
      <div class="qr-label">Scanner au relais</div>
    </div>` : '<div></div>'}
    <div class="meta-block">
      ${formData.weight ? `<p><span class="meta-bold">Poids :</span> ${formData.weight} kg</p>` : ''}
      ${formData.description ? `<p><span class="meta-bold">Contenu :</span> ${formData.description}</p>` : ''}
      <p><span class="meta-bold">Date :</span> ${dateCreation}</p>
      <p><span class="meta-bold">Prix :</span> ${createdParcel.prixClient ?? ''} DA</p>
    </div>
  </div>
  <div class="instructions">
    &#9888;&#65039; À déposer exclusivement au relais indiqué &bull; Règlement en espèces au dépôt &bull; Conserver ce numéro de suivi
  </div>
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) return;

    win.document.write(html);
    win.document.close();

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

    const triggerPrint = () => {
      waitForImages().finally(() => {
        win.focus();
        win.print();
      });
    };

    if (win.document.readyState === 'complete') {
      triggerPrint();
      return;
    }

    win.addEventListener('load', triggerPrint, { once: true });
  };

  const saveLabelSnapshot = (created: any) => {
    try {
      const departRelay = relais.find((relay: any) => relay.id === formData.relaisDepartId);
      const arriveeRelay = relais.find((relay: any) => relay.id === formData.relaisArriveeId);
      const current = JSON.parse(localStorage.getItem(LABEL_STORAGE_KEY) || '{}');

      current[created.trackingNumber] = {
        trackingNumber: created.trackingNumber,
        withdrawalCode: created.withdrawalCode,
        qrCodeImage: created.qrCodeImage,
        prixClient: created.prixClient,
        createdAt: created.createdAt || new Date().toISOString(),
        villeDepart: formData.villeDepart,
        villeArrivee: formData.villeArrivee,
        weight: formData.weight,
        description: formData.description,
        senderFirstName: formData.senderFirstName,
        senderLastName: formData.senderLastName,
        senderPhone: formData.senderPhone,
        recipientFirstName: formData.recipientFirstName,
        recipientLastName: formData.recipientLastName,
        recipientPhone: formData.recipientPhone,
        recipientEmail: formData.recipientEmail,
        relaisDepartName: departRelay?.commerceName || '',
        relaisDepartAddress: departRelay?.address || '',
        relaisArriveeName: arriveeRelay?.commerceName || '',
        relaisArriveeAddress: arriveeRelay?.address || '',
        labelPrintMode: formData.labelPrintMode,
      };

      localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(current));
    } catch (error) {
      console.error('Unable to persist parcel label snapshot:', error);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateRequiredFields()) {
      const message = 'Veuillez corriger les champs obligatoires.';
      setSubmitError(message);
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setSubmitError(null);

    try {
      const normalizedSenderPhone = normalizePhone(formData.senderPhone);
      const normalizedRecipientPhone = normalizePhone(formData.recipientPhone);

      if (!validatePhone(normalizedSenderPhone)) {
        const message = 'Telephone expediteur invalide. Format attendu: 8 a 15 chiffres, + autorise.';
        setSubmitError(message);
        toast({ title: 'Erreur', description: message, variant: 'destructive' });
        return;
      }

      if (!validatePhone(normalizedRecipientPhone)) {
        const message = 'Telephone destinataire invalide. Format attendu: 8 a 15 chiffres, + autorise.';
        setSubmitError(message);
        toast({ title: 'Erreur', description: message, variant: 'destructive' });
        return;
      }

      const trackingNumber = generateTrackingNumber();
      const qrData = generateQRData(trackingNumber);
      const response = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber,
          clientId: userId,
          relaisDepartId: formData.relaisDepartId,
          relaisArriveeId: formData.relaisArriveeId,
          villeDepart: formData.villeDepart,
          villeArrivee: formData.villeArrivee,
          description: formData.description,
          weight: formData.weight ? parseLocaleFloat(formData.weight) : null,
          senderFirstName: formData.senderFirstName,
          senderLastName: formData.senderLastName,
          senderPhone: formData.senderPhone,
          recipientFirstName: formData.recipientFirstName,
          recipientLastName: formData.recipientLastName,
          recipientPhone: formData.recipientPhone,
          recipientEmail: formData.recipientEmail,
          labelPrintMode: formData.labelPrintMode,
          prixClient: calculatedPrice?.finalClientPrice || 0,
          commissionPlateforme: calculatedPrice?.platformMargin || 0,
          commissionRelais: (calculatedPrice?.relayCommissionTotal || 0) + (calculatedPrice?.relayPrintFee || 0),
          netTransporteur: calculatedPrice?.transportCost || 0,
          qrCode: qrData,
          status: 'CREATED',
        }),
      });

      if (response.ok) {
        const created = await response.json();
        setCreatedParcel(created);
        saveLabelSnapshot(created);
        setSubmitError(null);
        toast({ title: 'Colis créé avec succès', description: `Suivi: ${created.trackingNumber}` });
        onCreated();
        return;
      }

      let description = `Impossible de créer le colis (HTTP ${response.status})`;
      const responseClone = response.clone();
      try {
        const payload = await response.json();
        if (payload?.error) {
          description = String(payload.error);
        }
        if (payload?.details) {
          description = `${description} - ${String(payload.details)}`;
        }
        if (payload?.step || payload?.code) {
          description = `${description} (${payload.step || 'REQUEST'}${payload.code ? ` / ${payload.code}` : ''})`;
        }
      } catch {
        try {
          const rawText = (await responseClone.text())?.trim();
          if (rawText) {
            description = `${description} - ${rawText.slice(0, 220)}`;
          }
        } catch {
          // keep default message
        }
      }

      setSubmitError(description);
      toast({ title: 'Erreur', description, variant: 'destructive' });
    } catch {
      const message = 'Impossible de créer le colis';
      setSubmitError(message);
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const activeRelayCityIds = useMemo(() => {
    return Array.from(
      new Set(
        relais
          .filter((relay: any) => relay.status === 'APPROVED' && relay.operationalStatus === 'ACTIF')
          .map((relay: any) => relay.ville)
      )
    );
  }, [relais]);

  const departWilayas = useMemo(() => {
    if (activeRelayCityIds.length === 0) return [];
    if (lignesActives.length === 0) {
      return WILAYAS.filter((wilaya) => activeRelayCityIds.includes(wilaya.id));
    }

    const ids = new Set<string>();
    lignesActives.forEach((line) => {
      ids.add(line.villeDepart);
      ids.add(line.villeArrivee);
    });

    return WILAYAS.filter((wilaya) => ids.has(wilaya.id) && activeRelayCityIds.includes(wilaya.id));
  }, [activeRelayCityIds, lignesActives]);

  const arriveeWilayas = useMemo(() => {
    if (!formData.villeDepart || activeRelayCityIds.length === 0) return [];
    if (lignesActives.length === 0) {
      return WILAYAS.filter((wilaya) => wilaya.id !== formData.villeDepart && activeRelayCityIds.includes(wilaya.id));
    }

    const ids = new Set<string>();
    lignesActives.forEach((line) => {
      if (line.villeDepart === formData.villeDepart) ids.add(line.villeArrivee);
      if (line.villeArrivee === formData.villeDepart) ids.add(line.villeDepart);
    });

    return WILAYAS.filter((wilaya) => ids.has(wilaya.id) && activeRelayCityIds.includes(wilaya.id));
  }, [activeRelayCityIds, lignesActives, formData.villeDepart]);

  const isRelayPrintMode = formData.labelPrintMode === 'RELAY';
  const relaisDepartCandidates = relais.filter((relay: any) => {
    if (relay.ville !== formData.villeDepart) return false;
    if (!isRelayPrintMode) return true;
    return relayPrinterStatusById[relay.id] === 'READY';
  });

  const departureDistanceById = useMemo(() => {
    const distances: Record<string, number> = {};
    if (!homeCoords) return distances;

    for (const relay of relaisDepartCandidates) {
      if (typeof relay.latitude === 'number' && typeof relay.longitude === 'number') {
        distances[relay.id] = haversineDistanceKm(homeCoords.lat, homeCoords.lon, relay.latitude, relay.longitude);
      }
    }

    return distances;
  }, [homeCoords, relaisDepartCandidates]);

  const relaisDepart = useMemo(() => {
    const sortedRelais = [...relaisDepartCandidates];
    if (!homeCoords) return sortedRelais;

    sortedRelais.sort((first: any, second: any) => {
      const firstDistance = departureDistanceById[first.id] ?? Number.POSITIVE_INFINITY;
      const secondDistance = departureDistanceById[second.id] ?? Number.POSITIVE_INFINITY;

      if (firstDistance !== secondDistance) {
        return firstDistance - secondDistance;
      }

      return String(first.commerceName || '').localeCompare(String(second.commerceName || ''));
    });

    return sortedRelais;
  }, [departureDistanceById, homeCoords, relaisDepartCandidates]);

  const relaisArrivee = relais.filter((relay: any) => relay.ville === formData.villeArrivee);
  const selectedRelayDepart = relais.find((relay: any) => relay.id === formData.relaisDepartId);
  const selectedRelayArrivee = relais.find((relay: any) => relay.id === formData.relaisArriveeId);
  const nearestRelayDepart = relaisDepart.find((relay: any) => Number.isFinite(departureDistanceById[relay.id]));
  const estimatedDistanceKm =
    formData.villeDepart && formData.villeArrivee
      ? estimateSafeDistanceKmByWilayas(formData.villeDepart, formData.villeArrivee)
      : null;

  useEffect(() => {
    if (!isRelayPrintMode || !formData.relaisDepartId) return;
    if (relayPrinterStatusById[formData.relaisDepartId] === 'READY') return;

    setFormData((prev) => ({ ...prev, relaisDepartId: '' }));
    toast({
      title: 'Relais de départ indisponible pour impression',
      description: 'Veuillez choisir un relais de départ avec imprimante disponible.',
      variant: 'destructive',
    });
  }, [isRelayPrintMode, formData.relaisDepartId, relayPrinterStatusById, toast]);

  if (createdParcel) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 pb-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-9 w-9 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold mb-1">Colis créé !</h2>
            <p className="text-slate-500 text-sm">Déposez le colis au relais et réglez en espèces.</p>
            {createdParcel.labelPrintMode === 'RELAY' && (
              <p className="text-xs text-blue-600 mt-2">Impression demandée au relais: des frais supplémentaires ont été ajoutés.</p>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Numéro de suivi</p>
            <p className="font-mono text-2xl font-bold text-emerald-600">{createdParcel.trackingNumber}</p>
          </div>

          {createdParcel.withdrawalCode && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-center mb-3">
              <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Code de retrait destinataire</p>
              <p className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-300">{createdParcel.withdrawalCode}</p>
              <p className="text-xs text-blue-500 mt-1">À communiquer uniquement au destinataire</p>
            </div>
          )}

          {createdParcel.qrCodeImage && (
            <div className="flex flex-col items-center mb-4">
              <p className="text-xs text-slate-500 mb-2">QR Code à présenter au relais</p>
              <div className="p-3 bg-white border rounded-lg shadow-sm">
                <img src={createdParcel.qrCodeImage} alt="QR Code colis" width={150} height={150} className="block" />
              </div>
            </div>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3 text-sm mb-6">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-0.5">📍 Relais de dépôt</p>
            <p className="text-amber-700 dark:text-amber-400">{relais.find((relay) => relay.id === formData.relaisDepartId)?.commerceName}</p>
          </div>

          {createdParcel.labelPrintMode === 'HOME' ? (
            <Button className="w-full bg-blue-600 hover:bg-blue-700 mb-3" onClick={printParcelLabel}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer l'étiquette à coller sur le colis
            </Button>
          ) : (
            <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              Étiquette à imprimer au relais de dépôt.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />Créer un autre colis
            </Button>
            <Button variant="outline" className="flex-1" onClick={onGoToCart}>
              <CreditCard className="h-4 w-4 mr-2" />Aller au panier
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={onGoToHistory}>
              <History className="h-4 w-4 mr-2" />Voir mon historique
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="text-2xl">Créer un nouveau colis</CardTitle>
          <CardDescription className="mx-auto max-w-2xl">Un formulaire plus simple, centré sur l'essentiel.</CardDescription>
          <div className="pt-2">
            <Link href="/faq" className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-800">
              <CircleHelp className="h-4 w-4" />Besoin d'aide ? Voir la FAQ
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-4 sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center gap-2 text-sm">
            <div className={`flex items-center gap-1.5 ${formData.villeDepart && formData.villeArrivee ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${formData.villeDepart && formData.villeArrivee ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
              Itinéraire
            </div>
            <div className="flex-1 h-px bg-slate-200" />
            <div className={`flex items-center gap-1.5 ${formData.relaisDepartId && formData.relaisArriveeId ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${formData.relaisDepartId && formData.relaisArriveeId ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
              Relais
            </div>
            <div className="flex-1 h-px bg-slate-200" />
            <div className={`flex items-center gap-1.5 ${formData.senderFirstName && formData.recipientFirstName ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${formData.senderFirstName && formData.recipientFirstName ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</span>
              Colis & identités
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">1</span>
                Itinéraire
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">Départ</Label>
                  <Select
                    value={formData.villeDepart}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, villeDepart: value, villeArrivee: '', relaisDepartId: '', relaisArriveeId: '' }));
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.villeDepart;
                        delete next.villeArrivee;
                        delete next.relaisDepartId;
                        delete next.relaisArriveeId;
                        return next;
                      });
                    }}
                  >
                    <SelectTrigger className={`h-10 ${fieldErrors.villeDepart ? 'border-red-500 focus:ring-red-500' : ''}`}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {departWilayas.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-slate-400">Aucune ligne configurée</div>
                      ) : (
                        departWilayas.map((wilaya) => <SelectItem key={wilaya.id} value={wilaya.id}>{wilaya.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                  {fieldErrors.villeDepart && <p className="text-xs text-red-600">{fieldErrors.villeDepart}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Arrivée</Label>
                  <Select
                    value={formData.villeArrivee}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, villeArrivee: value, relaisArriveeId: '' }));
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.villeArrivee;
                        delete next.relaisArriveeId;
                        return next;
                      });
                    }}
                    disabled={!formData.villeDepart}
                  >
                    <SelectTrigger className={`h-10 ${fieldErrors.villeArrivee ? 'border-red-500 focus:ring-red-500' : ''}`}><SelectValue placeholder={formData.villeDepart ? 'Sélectionner' : 'Choisir le départ d\'abord'} /></SelectTrigger>
                    <SelectContent>
                      {arriveeWilayas.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-slate-400">Aucune ligne depuis cette ville</div>
                      ) : (
                        arriveeWilayas.map((wilaya) => <SelectItem key={wilaya.id} value={wilaya.id}>{wilaya.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                  {fieldErrors.villeArrivee && <p className="text-xs text-red-600">{fieldErrors.villeArrivee}</p>}
                </div>
              </div>
            </div>

            {formData.villeDepart && formData.villeArrivee && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">2</span>
                  Points relais
                </h3>
                <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <Label className="text-sm">Adresse du domicile (pour trier les relais proches)</Label>
                  <AddressAutocompleteInput
                    value={homeAddress}
                    onChange={(value) => {
                      setHomeAddress(value);
                      setHomeCoords(null);
                    }}
                    onSelect={(suggestion) => {
                      setHomeAddress(suggestion.label);
                      setHomeCoords({ lat: suggestion.lat, lon: suggestion.lon });
                    }}
                    placeholder="Ex: Bab Ezzouar, Alger"
                    className="h-10"
                  />
                  <p className="text-xs text-slate-500">Astuce: choisissez votre adresse pour voir les relais les plus proches sur la carte.</p>
                  {nearestRelayDepart && homeCoords && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">Plus proche: {nearestRelayDepart.commerceName}</span>
                      <span className="rounded bg-slate-200 px-2 py-1">{(departureDistanceById[nearestRelayDepart.id] || 0).toFixed(1)} km</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => setFormData((prev) => ({ ...prev, relaisDepartId: nearestRelayDepart.id }))}
                      >
                        Choisir le plus proche
                      </Button>
                    </div>
                  )}
                </div>

                {homeCoords && relaisDepart.some((relay: any) => typeof relay.latitude === 'number' && typeof relay.longitude === 'number') && (
                  <div className="mb-4">
                    <RelaySelectionMap
                      home={homeCoords}
                      relays={relaisDepart}
                      selectedRelayId={formData.relaisDepartId}
                      nearestRelayId={nearestRelayDepart?.id || null}
                      onSelectRelay={(relayId) => setFormData((prev) => ({ ...prev, relaisDepartId: relayId }))}
                    />
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label className="text-sm">Relais départ</Label>
                    <Select value={formData.relaisDepartId} onValueChange={(value) => updateField('relaisDepartId', value)}>
                      <SelectTrigger className={`h-10 w-full min-w-0 ${fieldErrors.relaisDepartId ? 'border-red-500 focus:ring-red-500' : ''}`}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {relaisDepart.map((relay) => (
                          <SelectItem key={relay.id} value={relay.id}>
                            {relay.commerceName}
                            {Number.isFinite(departureDistanceById[relay.id]) ? ` - ${departureDistanceById[relay.id].toFixed(1)} km` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.relaisDepartId && <p className="text-xs text-red-600">{fieldErrors.relaisDepartId}</p>}
                    {selectedRelayDepart && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <p className="truncate font-medium text-slate-800">{selectedRelayDepart.commerceName}</p>
                        {nearestRelayDepart && selectedRelayDepart.id === nearestRelayDepart.id && homeCoords && (
                          <p className="mt-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Plus proche de votre domicile
                          </p>
                        )}
                        {homeCoords && Number.isFinite(departureDistanceById[selectedRelayDepart.id]) && (
                          <p className="mt-1 text-slate-500">Distance: {departureDistanceById[selectedRelayDepart.id].toFixed(1)} km</p>
                        )}
                        <p className="mt-1 break-words">{selectedRelayDepart.address}</p>
                        <p className="mt-1 text-slate-500">Horaires : {formatRelayHours(selectedRelayDepart)}</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-400">Dépôt obligatoire dans ce relais uniquement (aucun dépôt possible dans un autre relais, même ville).</p>
                    {relaisDepart.length === 0 && (
                      <p className="text-sm text-orange-500">
                        {isRelayPrintMode
                          ? 'Aucun relais avec imprimante disponible dans cette ville'
                          : 'Aucun relais disponible dans cette ville'}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <Label className="text-sm">Relais arrivée</Label>
                    <Select value={formData.relaisArriveeId} onValueChange={(value) => updateField('relaisArriveeId', value)}>
                      <SelectTrigger className={`h-10 w-full min-w-0 ${fieldErrors.relaisArriveeId ? 'border-red-500 focus:ring-red-500' : ''}`}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {relaisArrivee.map((relay) => (
                          <SelectItem key={relay.id} value={relay.id}>{relay.commerceName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.relaisArriveeId && <p className="text-xs text-red-600">{fieldErrors.relaisArriveeId}</p>}
                    {selectedRelayArrivee && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <p className="truncate font-medium text-slate-800">{selectedRelayArrivee.commerceName}</p>
                        <p className="mt-1 break-words">{selectedRelayArrivee.address}</p>
                        <p className="mt-1 text-slate-500">Horaires : {formatRelayHours(selectedRelayArrivee)}</p>
                      </div>
                    )}
                    {relaisArrivee.length === 0 && <p className="text-sm text-orange-500">Aucun relais disponible dans cette ville</p>}
                  </div>
                </div>
              </div>
            )}

            {formData.relaisDepartId && formData.relaisArriveeId && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">3</span>
                  Détails du colis
                </h3>
                <div className="grid gap-3 md:grid-cols-[180px_1fr] md:items-end">
                  <div className="space-y-2">
                    <Label className="text-sm">Poids (kg)</Label>
                    <Input className={`h-10 ${fieldErrors.weight ? 'border-red-500 focus-visible:ring-red-500' : ''}`} type="number" min="0.1" step="0.1" value={formData.weight} onChange={(event) => updateField('weight', event.target.value)} placeholder="2.5" />
                    {fieldErrors.weight && <p className="text-xs text-red-600">{fieldErrors.weight}</p>}
                  </div>
                  {calculatedPrice && (
                    <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      <p className="text-xs uppercase tracking-wide text-emerald-700">Montant estimé</p>
                      <p className="text-2xl font-bold">{calculatedPrice.finalClientPrice} DA</p>
                    </div>
                  )}
                </div>
                {estimatedDistanceKm && <p className="text-xs text-slate-500">Distance estimée automatiquement: {estimatedDistanceKm} km</p>}
                <div className="space-y-2">
                  <Label className="text-sm">Description</Label>
                  <Input className="h-10" value={formData.description} onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))} placeholder="Contenu du colis (optionnel)" />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Option d'impression de l'étiquette</Label>
                  <Select value={formData.labelPrintMode} onValueChange={(value) => setFormData((prev) => ({ ...prev, labelPrintMode: value as LabelPrintMode }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Choisir une option" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOME">Imprimer chez moi (sans frais)</SelectItem>
                      <SelectItem value="RELAY">Imprimer au relais (+{pricingConfig.pricingRelayPrintFee} DA)</SelectItem>
                    </SelectContent>
                  </Select>
                  {isRelayPrintMode && <p className="text-xs text-slate-500">Seuls les relais de départ avec imprimante disponible sont proposés.</p>}
                  <p className="text-xs text-slate-400">
                    Pas d'imprimante ? <Link href="/faq" className="text-emerald-600 underline hover:text-emerald-700">Le relais peut imprimer à votre place → FAQ</Link>
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Coordonnées</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm">Nom expéditeur</Label>
                      <Input className={`h-10 ${fieldErrors.senderLastName ? 'border-red-500 focus-visible:ring-red-500' : ''}`} value={formData.senderLastName} onChange={(event) => updateField('senderLastName', event.target.value)} />
                      {fieldErrors.senderLastName && <p className="text-xs text-red-600">{fieldErrors.senderLastName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Prénom expéditeur</Label>
                      <Input className={`h-10 ${fieldErrors.senderFirstName ? 'border-red-500 focus-visible:ring-red-500' : ''}`} value={formData.senderFirstName} onChange={(event) => updateField('senderFirstName', event.target.value)} />
                      {fieldErrors.senderFirstName && <p className="text-xs text-red-600">{fieldErrors.senderFirstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Tél. expéditeur</Label>
                      <Input className={`h-10 ${fieldErrors.senderPhone ? 'border-red-500 focus-visible:ring-red-500' : ''}`} value={formData.senderPhone} onChange={(event) => updateField('senderPhone', event.target.value)} placeholder="0550123456" />
                      {fieldErrors.senderPhone && <p className="text-xs text-red-600">{fieldErrors.senderPhone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Nom destinataire</Label>
                      <Input className={`h-10 ${fieldErrors.recipientLastName ? 'border-red-500 focus-visible:ring-red-500' : ''}`} value={formData.recipientLastName} onChange={(event) => updateField('recipientLastName', event.target.value)} />
                      {fieldErrors.recipientLastName && <p className="text-xs text-red-600">{fieldErrors.recipientLastName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Prénom destinataire</Label>
                      <Input className={`h-10 ${fieldErrors.recipientFirstName ? 'border-red-500 focus-visible:ring-red-500' : ''}`} value={formData.recipientFirstName} onChange={(event) => updateField('recipientFirstName', event.target.value)} />
                      {fieldErrors.recipientFirstName && <p className="text-xs text-red-600">{fieldErrors.recipientFirstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Tél. destinataire</Label>
                      <Input className={`h-10 ${fieldErrors.recipientPhone ? 'border-red-500 focus-visible:ring-red-500' : ''}`} value={formData.recipientPhone} onChange={(event) => updateField('recipientPhone', event.target.value)} placeholder="0660123456" />
                      {fieldErrors.recipientPhone && <p className="text-xs text-red-600">{fieldErrors.recipientPhone}</p>}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm">Email destinataire (optionnel)</Label>
                      <Input className="h-10" type="email" value={formData.recipientEmail} onChange={(event) => setFormData((prev) => ({ ...prev, recipientEmail: event.target.value }))} placeholder="destinataire@email.com" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {calculatedPrice && (
              <Card className="mx-auto max-w-2xl border-emerald-100 bg-slate-50 dark:bg-slate-800">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-semibold">Montant à payer</h4>
                      <p className="text-xs text-slate-500">Le montant final sera confirmé au dépôt du colis.</p>
                      {calculatedPrice.relayPrintFee > 0 && <p className="text-xs text-blue-600">Frais impression relais: +{calculatedPrice.relayPrintFee} DA</p>}
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">{calculatedPrice.finalClientPrice} DA</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {formData.relaisDepartId && (
              <div className="mx-auto max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
                <p className="font-semibold text-amber-800 dark:text-amber-300">⚠️ Relais de dépôt obligatoire</p>
                <p className="text-amber-700 dark:text-amber-400">
                  Vous devez remettre ce colis exclusivement à :
                  <span className="font-bold"> {relais.find((relay: any) => relay.id === formData.relaisDepartId)?.commerceName}</span>
                </p>
                <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">Aucun dépôt possible dans un autre relais, même ville.</p>
              </div>
            )}

            <div className="mx-auto max-w-2xl">
              <FormGlobalError message={submitError} />
            </div>

            <div className="mx-auto flex max-w-md gap-3">
              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                Créer le colis
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
