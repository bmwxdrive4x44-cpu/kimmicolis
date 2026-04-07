'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FormGlobalError } from '@/components/ui/form-error';
import { useToast } from '@/hooks/use-toast';

type CsvParcel = {
  senderFirstName: string;
  senderLastName: string;
  senderPhone: string;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  weight: number;
  description?: string;
};

type RelayLite = {
  id: string;
  commerceName: string;
  ville: string;
};

type AvailableLine = {
  villeDepart: string;
  villeArrivee: string;
  isActive?: boolean;
};

type ImportSummary = {
  total: number;
  successCount: number;
  failureCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
};

function parseCsv(content: string): CsvParcel[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

  const findHeader = (candidates: string[]) => headers.findIndex((h) => candidates.includes(h));

  const idx = {
    senderFirstName: findHeader(['senderfirstname', 'sender_first_name', 'expediteurprenom', 'expediteur_prenom']),
    senderLastName: findHeader(['senderlastname', 'sender_last_name', 'expediteurnom', 'expediteur_nom']),
    senderPhone: findHeader(['senderphone', 'sender_phone', 'expediteurtelephone', 'expediteur_telephone']),
    recipientFirstName: findHeader(['recipientfirstname', 'recipient_first_name', 'destinataireprenom', 'destinataire_prenom']),
    recipientLastName: findHeader(['recipientlastname', 'recipient_last_name', 'destinatairenom', 'destinataire_nom']),
    recipientPhone: findHeader(['recipientphone', 'recipient_phone', 'destinatairetelephone', 'destinataire_telephone']),
    weight: findHeader(['weight', 'poids']),
    description: findHeader(['description', 'contenu']),
  };

  const required = [
    idx.senderFirstName,
    idx.senderLastName,
    idx.senderPhone,
    idx.recipientFirstName,
    idx.recipientLastName,
    idx.recipientPhone,
    idx.weight,
  ];

  if (required.some((i) => i < 0)) {
    throw new Error('Colonnes CSV manquantes. Requis: senderFirstName,senderLastName,senderPhone,recipientFirstName,recipientLastName,recipientPhone,weight');
  }

  const rows: CsvParcel[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim());
    const weight = Number.parseFloat(String(cols[idx.weight] || '').replace(',', '.'));

    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`Poids invalide a la ligne ${i + 1}`);
    }

    rows.push({
      senderFirstName: cols[idx.senderFirstName] || '',
      senderLastName: cols[idx.senderLastName] || '',
      senderPhone: cols[idx.senderPhone] || '',
      recipientFirstName: cols[idx.recipientFirstName] || '',
      recipientLastName: cols[idx.recipientLastName] || '',
      recipientPhone: cols[idx.recipientPhone] || '',
      weight,
      description: idx.description >= 0 ? (cols[idx.description] || '') : '',
    });
  }

  return rows;
}

export function EnseigneCsvImportCard({ clientId }: { clientId: string }) {
  const { toast } = useToast();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parcels, setParcels] = useState<CsvParcel[]>([]);

  const [villeDepart, setVilleDepart] = useState('');
  const [villeArrivee, setVilleArrivee] = useState('');
  const [relaisDepartId, setRelaisDepartId] = useState('');
  const [relaisArriveeId, setRelaisArriveeId] = useState('');
  const [relaisDepartList, setRelaisDepartList] = useState<RelayLite[]>([]);
  const [relaisArriveeList, setRelaisArriveeList] = useState<RelayLite[]>([]);

  const [availableLines, setAvailableLines] = useState<AvailableLine[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(true);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const canSubmit = useMemo(() => {
    return parcels.length > 0 && villeDepart && villeArrivee && relaisDepartId && relaisArriveeId && !isUploading;
  }, [parcels.length, villeDepart, villeArrivee, relaisDepartId, relaisArriveeId, isUploading]);

  const departureCities = useMemo(() => {
    return Array.from(new Set(availableLines.map((line) => line.villeDepart?.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [availableLines]);

  const arrivalCities = useMemo(() => {
    if (!villeDepart) return [];
    return Array.from(
      new Set(
        availableLines
          .filter((line) => line.villeDepart?.trim() === villeDepart)
          .map((line) => line.villeArrivee?.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [availableLines, villeDepart]);

  useEffect(() => {
    let cancelled = false;

    const loadLines = async () => {
      setIsLoadingLines(true);
      try {
        const response = await fetch('/api/lignes');
        const data = (await response.json().catch(() => [])) as AvailableLine[];
        if (cancelled) return;
        const active = Array.isArray(data) ? data.filter((line) => line?.isActive !== false) : [];
        setAvailableLines(active);
      } catch {
        if (cancelled) return;
        setAvailableLines([]);
      } finally {
        if (!cancelled) setIsLoadingLines(false);
      }
    };

    void loadLines();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (villeArrivee && !arrivalCities.includes(villeArrivee)) {
      setVilleArrivee('');
      setRelaisArriveeList([]);
      setRelaisArriveeId('');
    }
  }, [arrivalCities, villeArrivee]);

  const fetchRelaysByCity = async (city: string): Promise<RelayLite[]> => {
    if (!city) return [];
    const res = await fetch(`/api/relais?status=APPROVED&ville=${encodeURIComponent(city)}`);
    const data = (await res.json().catch(() => [])) as RelayLite[];
    return Array.isArray(data) ? data : [];
  };

  const onFileChange = async (file: File | null) => {
    setSubmitError(null);
    if (!file) {
      setParcels([]);
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) throw new Error('Le fichier CSV ne contient aucune ligne exploitable.');
      if (parsed.length > 50) throw new Error('Maximum 50 colis par import.');
      setParcels(parsed);
      toast({ title: 'CSV charge', description: `${parsed.length} colis detectes.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV invalide';
      setSubmitError(message);
      setParcels([]);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitError(null);
    setIsUploading(true);
    setSummary(null);

    try {
      const response = await fetch('/api/enseignes/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          villeDepart,
          villeArrivee,
          relaisDepartId,
          relaisArriveeId,
          parcels,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Import bulk echoue');

      const nextSummary = data?.summary as ImportSummary | undefined;
      if (nextSummary) setSummary(nextSummary);

      toast({
        title: 'Import termine',
        description: `${nextSummary?.successCount ?? 0} lignes OK / ${nextSummary?.failureCount ?? 0} lignes KO.`,
      });

      setParcels([]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Import impossible');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const header = 'senderFirstName,senderLastName,senderPhone,recipientFirstName,recipientLastName,recipientPhone,weight,description';
    const sample1 = 'Karim,Benaissa,0555000001,Leila,Hamdi,0666000001,2.5,Accessoires mode';
    const sample2 = 'Nadia,Mansouri,0555000002,Yacine,Meziani,0666000002,1.2,Produit cosmetique';
    const content = [header, sample1, sample2].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_enseigne.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Import CSV (bulk)</h3>
      <p className="mt-1 text-sm text-slate-600">
        Workflow simple: choisissez la route, chargez le CSV, lancez l import.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Ville de depart</Label>
          <Select
            value={villeDepart}
            onValueChange={async (value) => {
              setVilleDepart(value);
              setVilleArrivee('');
              setRelaisArriveeList([]);
              setRelaisArriveeId('');
              setRelaisDepartId('');

              try {
                const relays = await fetchRelaysByCity(value);
                setRelaisDepartList(relays);
              } catch {
                setRelaisDepartList([]);
              }
            }}
            disabled={isLoadingLines}
          >
            <SelectTrigger><SelectValue placeholder={isLoadingLines ? 'Chargement...' : 'Choisir'} /></SelectTrigger>
            <SelectContent>
              {departureCities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ville d arrivee</Label>
          <Select
            value={villeArrivee}
            onValueChange={async (value) => {
              setVilleArrivee(value);
              setRelaisArriveeId('');
              try {
                const relays = await fetchRelaysByCity(value);
                setRelaisArriveeList(relays);
              } catch {
                setRelaisArriveeList([]);
              }
            }}
            disabled={isLoadingLines || !villeDepart || arrivalCities.length === 0}
          >
            <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>
              {arrivalCities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
            </SelectContent>
          </Select>
          {!isLoadingLines && villeDepart && arrivalCities.length === 0 && (
            <p className="text-xs text-amber-600">Aucune destination active disponible pour cette ville.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Relais depart</Label>
          <Select value={relaisDepartId} onValueChange={setRelaisDepartId}>
            <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>
              {relaisDepartList.map((r) => <SelectItem key={r.id} value={r.id}>{r.commerceName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Relais arrivee</Label>
          <Select value={relaisArriveeId} onValueChange={setRelaisArriveeId}>
            <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>
              {relaisArriveeList.map((r) => <SelectItem key={r.id} value={r.id}>{r.commerceName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label>Fichier CSV</Label>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void onFileChange(e.target.files?.[0] || null)}
        />
      </div>

      <FormGlobalError message={submitError} className="mt-4" />

      {parcels.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Apercu ({parcels.length} lignes)</p>
          <div className="max-h-64 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediteur</TableHead>
                  <TableHead>Destinataire</TableHead>
                  <TableHead>Poids</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcels.slice(0, 8).map((row, idx) => (
                  <TableRow key={`${row.senderPhone}-${row.recipientPhone}-${idx}`}>
                    <TableCell>{row.senderFirstName} {row.senderLastName}</TableCell>
                    <TableCell>{row.recipientFirstName} {row.recipientLastName}</TableCell>
                    <TableCell>{row.weight} kg</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {parcels.length > 8 && <p className="text-xs text-slate-500">Apercu limite aux 8 premieres lignes.</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={handleSubmit} disabled={!canSubmit} className="bg-emerald-600 hover:bg-emerald-700">
          {isUploading ? 'Import en cours...' : 'Lancer import'}
        </Button>
        <Button type="button" variant="outline" onClick={downloadTemplate}>
          Telecharger modele CSV
        </Button>
      </div>

      {summary && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Resultat: {summary.successCount}/{summary.total} OK, {summary.failureCount} KO
          </p>
          <p>Statut: {summary.status}</p>
        </div>
      )}
    </section>
  );
}
