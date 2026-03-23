'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WILAYAS, PARCEL_STATUS, RELAIS_STATUS, DEFAULT_RELAY_COMMISSION, RELAY_BLOCK_THRESHOLD_DA } from '@/lib/constants';
import { Store, Package, QrCode, DollarSign, Loader2, CheckCircle, Clock, Scan, ArrowDownToLine, AlertCircle, Save, BanknoteIcon, TrendingUp, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function getRoleBasedDashboardPath(role: string, locale: string): string {
  switch (role) {
    case 'ADMIN': return `/${locale}/dashboard/admin`;
    case 'TRANSPORTER': return `/${locale}/dashboard/transporter`;
    case 'RELAIS': return `/${locale}/dashboard/relais`;
    default: return `/${locale}/dashboard/client`;
  }
}

export default function RelaisDashboard() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [relaisInfo, setRelaisInfo] = useState<any>(null);
  const [stats, setStats] = useState({ pending: 0, received: 0, handedOver: 0, earnings: 0 });
  const [financials, setFinancials] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    }
  }, [status, router, locale]);

  // Fetch relais info when session is ready
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      // Redirect if not RELAIS role
      if (session.user.role !== 'RELAIS') {
        const paths: Record<string, string> = {
          'ADMIN': `/${locale}/dashboard/admin`,
          'TRANSPORTER': `/${locale}/dashboard/transporter`,
          'CLIENT': `/${locale}/dashboard/client`,
        };
        const path = paths[session.user.role] || `/${locale}/dashboard/client`;
        window.location.href = path;
        return;
      }
      fetchRelaisInfo();
    }
  }, [status, session, locale]);

  const fetchRelaisInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/relais?userId=${session?.user?.id}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const relais = data[0];
        setRelaisInfo(relais);
        
        // Fetch stats
        try {
          const statsRes = await fetch(`/api/relais/${relais.id}/stats`);
          const statsData = await statsRes.json();
          setStats(statsData);
        } catch { /* Use defaults */ }

        // Fetch financials
        try {
          const finRes = await fetch(`/api/relais/financials?relaisId=${relais.id}`);
          if (finRes.ok) setFinancials(await finRes.json());
        } catch { /* Use defaults */ }
      } else {
        setError('Aucun point relais associé à votre compte. Veuillez contacter l\'administrateur.');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (status === 'unauthenticated' || !session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Redirection...</p>
        </div>
      </div>
    );
  }

  // Wrong role
  if (session.user.role !== 'RELAIS') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Redirection vers votre espace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Espace Point Relais</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {relaisInfo?.commerceName || session.user.name}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Blocked Banner */}
        {relaisInfo?.isBlocked && (
          <Card className="mb-8 border-red-400 bg-red-50 dark:bg-red-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <ShieldAlert className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-bold text-red-700 dark:text-red-400">⛔ Compte bloqué automatiquement</p>
                  <p className="text-sm text-red-600">Le solde non reversé dépasse le seuil autorisé. Veuillez contacter l&apos;administrateur pour un reversement.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Banner */}
        {relaisInfo && relaisInfo.status === 'PENDING' && (
          <Card className="mb-8 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Clock className="h-6 w-6 text-orange-600" />
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-400">Inscription en attente de validation</p>
                  <p className="text-sm text-orange-600 dark:text-orange-500">Votre demande est en cours d&apos;examen par l&apos;administrateur</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Déposés</CardTitle>
              <ArrowDownToLine className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.received}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total encaissé</CardTitle>
              <BanknoteIcon className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {(financials?.totalEncaisse ?? 0).toFixed(0)} DA
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solde à reverser</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${relaisInfo?.isBlocked ? 'text-red-600' : 'text-amber-600'}`}>
                {(financials?.balance ?? 0).toFixed(0)} DA
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="overview"><Store className="h-4 w-4 mr-2" />Vue d&apos;ensemble</TabsTrigger>
            <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-2" />Scanner</TabsTrigger>
            <TabsTrigger value="financials"><DollarSign className="h-4 w-4 mr-2" />Financier</TabsTrigger>
            <TabsTrigger value="settings"><Package className="h-4 w-4 mr-2" />Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab relaisInfo={relaisInfo} setActiveTab={setActiveTab} />
          </TabsContent>
          <TabsContent value="scan">
            <ScanTab relaisId={relaisInfo?.id} onUpdate={fetchRelaisInfo} />
          </TabsContent>
          <TabsContent value="financials">
            <FinancialsTab relaisInfo={relaisInfo} financials={financials} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab relaisInfo={relaisInfo} onUpdate={fetchRelaisInfo} />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

// Overview Tab
function OverviewTab({ relaisInfo, setActiveTab }: { relaisInfo: any; setActiveTab: (tab: string) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Information du relais</CardTitle>
        </CardHeader>
        <CardContent>
          {relaisInfo ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Commerce:</span>
                <span className="font-semibold">{relaisInfo.commerceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Adresse:</span>
                <span>{relaisInfo.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ville:</span>
                <span>{WILAYAS.find(w => w.id === relaisInfo.ville)?.name || relaisInfo.ville}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Statut:</span>
                <Badge className={`${RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.color} text-white`}>
                  {RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.label}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">Chargement...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commissions par format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionPetit || DEFAULT_RELAY_COMMISSION.PETIT} DA</p>
              <p className="text-sm text-slate-500">Petit colis</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionMoyen || DEFAULT_RELAY_COMMISSION.MOYEN} DA</p>
              <p className="text-sm text-slate-500">Moyen colis</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionGros || DEFAULT_RELAY_COMMISSION.GROS} DA</p>
              <p className="text-sm text-slate-500">Gros colis</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="justify-start h-auto py-4" onClick={() => setActiveTab('scan')}>
              <BanknoteIcon className="h-5 w-5 mr-3 text-blue-500" />
              <div className="text-left">
                <p className="font-semibold">Valider paiement cash</p>
                <p className="text-sm text-slate-500">Client paie au comptoir</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4" onClick={() => setActiveTab('scan')}>
              <QrCode className="h-5 w-5 mr-3 text-emerald-500" />
              <div className="text-left">
                <p className="font-semibold">Scanner dépôt colis</p>
                <p className="text-sm text-slate-500">Confirmer dépôt physique</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4" onClick={() => setActiveTab('financials')}>
              <TrendingUp className="h-5 w-5 mr-3 text-amber-500" />
              <div className="text-left">
                <p className="font-semibold">Tableau financier</p>
                <p className="text-sm text-slate-500">Solde, encaissements</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Scan Tab – full new workflow
function ScanTab({ relaisId, onUpdate }: { relaisId: string | undefined; onUpdate: () => void }) {
  const { toast } = useToast();
  const [trackingInput, setTrackingInput] = useState('');
  const [parcel, setParcel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [cashAmount, setCashAmount] = useState('');

  const handleSearch = async () => {
    if (!trackingInput.trim()) return;
    setIsLoading(true);
    setParcel(null);
    try {
      const response = await fetch(`/api/parcels?tracking=${trackingInput.trim().toUpperCase()}`);
      const data = await response.json();
      if (data && Array.isArray(data) && data.length > 0) {
        setParcel(data[0]);
        setCashAmount(String(data[0].prixClient ?? ''));
      } else if (data && !Array.isArray(data) && data.trackingNumber) {
        setParcel(data);
        setCashAmount(String(data.prixClient ?? ''));
      } else {
        toast({ title: 'Introuvable', description: 'Aucun colis avec ce numéro', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de rechercher le colis', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const performAction = async (action: string, extraData?: Record<string, unknown>) => {
    if (!parcel || !relaisId) return;
    setIsActioning(true);
    try {
      const response = await fetch('/api/relais/scan-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: parcel.trackingNumber,
          relaisId,
          action,
          ...extraData,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast({ title: 'Erreur', description: result.error ?? 'Action échouée', variant: 'destructive' });
        return;
      }
      toast({ title: '✅ Succès', description: result.message });
      setParcel({ ...parcel, status: result.newStatus });
      onUpdate();
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'effectuer l\'action', variant: 'destructive' });
    } finally {
      setIsActioning(false);
    }
  };

  const statusLabel = (s: string) => PARCEL_STATUS.find(p => p.id === s)?.label ?? s;
  const statusColor = (s: string) => PARCEL_STATUS.find(p => p.id === s)?.color ?? 'bg-gray-400';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scan className="h-5 w-5" />Scanner / Rechercher un colis</CardTitle>
          <CardDescription>Saisissez le numéro de suivi ou scannez le QR code du colis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Numéro de suivi (ex: SC1234567890)"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="font-mono"
            />
            <Button onClick={handleSearch} disabled={isLoading || !trackingInput}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Rechercher
            </Button>
          </div>
        </CardContent>
      </Card>

      {parcel && (
        <Card className="border-2 border-emerald-200 dark:border-emerald-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-xl">{parcel.trackingNumber}</p>
                <p className="text-slate-500 text-sm">{parcel.villeDepart} → {parcel.villeArrivee} · {parcel.format}</p>
              </div>
              <Badge className={`${statusColor(parcel.status)} text-white px-3 py-1`}>
                {statusLabel(parcel.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Parcel info */}
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <p className="text-slate-500">Client</p>
                <p className="font-semibold">{parcel.client?.name ?? 'N/A'}</p>
                <p>{parcel.client?.phone ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500">Montant à encaisser</p>
                <p className="font-bold text-lg text-emerald-700">{parcel.prixClient?.toFixed(0) ?? 0} DA</p>
                <p className="text-xs text-slate-400">Commission relais: {parcel.commissionRelais?.toFixed(0) ?? 0} DA</p>
              </div>
              <div>
                <p className="text-slate-500">Format / Poids</p>
                <p className="font-semibold">{parcel.format}</p>
                {parcel.weight && <p>{parcel.weight} kg</p>}
              </div>
            </div>

            {/* ─── ACTION BUTTONS based on current status ─── */}

            {/* STEP 1: Validate cash payment (CREATED → PAID_RELAY) */}
            {(parcel.status === 'CREATED' || parcel.status === 'PAID') && parcel.relaisDepartId === relaisId && (
              <div className="border border-blue-200 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
                <p className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <BanknoteIcon className="h-4 w-4" /> Étape 1 — Valider le paiement cash
                </p>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label>Montant encaissé (DA)</Label>
                    <Input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={isActioning || !cashAmount}
                    onClick={() => performAction('validate_payment', { cashAmount: parseFloat(cashAmount) })}
                  >
                    {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BanknoteIcon className="h-4 w-4 mr-2" />}
                    Valider paiement
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Confirm physical deposit (PAID_RELAY → DEPOSITED_RELAY) */}
            {(parcel.status === 'PAID_RELAY' || parcel.status === 'RECU_RELAIS') && parcel.relaisDepartId === relaisId && (
              <div className="border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 space-y-3">
                <p className="font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                  <QrCode className="h-4 w-4" /> Étape 2 — Confirmer le dépôt physique
                </p>
                <p className="text-sm text-yellow-700">Après scan, le colis sera disponible pour les transporteurs</p>
                <Button
                  className="bg-yellow-600 hover:bg-yellow-700"
                  disabled={isActioning}
                  onClick={() => performAction('deposit_scan')}
                >
                  {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                  Scanner dépôt
                </Button>
              </div>
            )}

            {/* Parcel waiting for transporter */}
            {(parcel.status === 'DEPOSITED_RELAY' || parcel.status === 'ASSIGNED' || parcel.status === 'PICKED_UP') && (
              <div className="border border-slate-200 bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <p className="text-slate-600 text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {parcel.status === 'DEPOSITED_RELAY' && 'Colis déposé — en attente d\'un transporteur'}
                  {parcel.status === 'ASSIGNED' && 'Transporteur assigné — en attente de prise en charge'}
                  {parcel.status === 'PICKED_UP' && 'Colis en route vers le relais de destination'}
                </p>
              </div>
            )}

            {/* STEP 5: Receive from transporter at destination relay (PICKED_UP → ARRIVED_RELAY) */}
            {(parcel.status === 'PICKED_UP' || parcel.status === 'EN_TRANSPORT' || parcel.status === 'ARRIVE_RELAIS_DESTINATION') && parcel.relaisArriveeId === relaisId && (
              <div className="border border-teal-200 bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 space-y-3">
                <p className="font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4" /> Réceptionner le colis du transporteur
                </p>
                <Button
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={isActioning}
                  onClick={() => performAction('receive_transporter')}
                >
                  {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
                  Confirmer réception transporteur
                </Button>
              </div>
            )}

            {/* STEP 6: Deliver to client (ARRIVED_RELAY → DELIVERED) */}
            {(parcel.status === 'ARRIVED_RELAY' || parcel.status === 'ARRIVE_RELAIS_DESTINATION') && parcel.relaisArriveeId === relaisId && (
              <div className="border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 space-y-3">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Remettre le colis au client
                </p>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={isActioning}
                  onClick={() => performAction('deliver_client')}
                >
                  {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Colis remis au client
                </Button>
              </div>
            )}

            {/* Final state */}
            {(parcel.status === 'DELIVERED' || parcel.status === 'LIVRE') && (
              <div className="border border-green-200 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-green-700 font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Colis livré avec succès
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Financials Tab
function FinancialsTab({ relaisInfo, financials }: { relaisInfo: any; financials: any }) {
  const balance = financials?.balance ?? 0;
  const totalEncaisse = financials?.totalEncaisse ?? 0;
  const totalReverse = financials?.totalReverse ?? 0;
  const blockRisk = financials?.blockRiskPercent ?? 0;

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">Total encaissé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{totalEncaisse.toFixed(0)} DA</p>
            <p className="text-xs text-slate-500 mt-1">Cash reçu des clients</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total reversé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{totalReverse.toFixed(0)} DA</p>
            <p className="text-xs text-slate-500 mt-1">Envoyé à la plateforme</p>
          </CardContent>
        </Card>
        <Card className={balance > RELAY_BLOCK_THRESHOLD_DA * 0.8 ? 'border-red-300' : 'border-amber-200'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium ${balance > RELAY_BLOCK_THRESHOLD_DA * 0.8 ? 'text-red-700' : 'text-amber-700'}`}>
              Solde à reverser
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${balance > RELAY_BLOCK_THRESHOLD_DA * 0.8 ? 'text-red-600' : 'text-amber-600'}`}>
              {balance.toFixed(0)} DA
            </p>
            <p className="text-xs text-slate-500 mt-1">Seuil: {RELAY_BLOCK_THRESHOLD_DA.toLocaleString()} DA</p>
          </CardContent>
        </Card>
      </div>

      {/* Block Risk Progress */}
      {blockRisk > 50 && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-900/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-orange-700">Risque de blocage: {blockRisk.toFixed(0)}%</p>
                <div className="w-full bg-orange-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full"
                    style={{ width: `${Math.min(blockRisk, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-orange-600 mt-1">
                  Reversez {(balance * 0.5).toFixed(0)} DA ou plus pour réduire le risque
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des transactions</CardTitle>
          <CardDescription>Encaissements et reversements</CardDescription>
        </CardHeader>
        <CardContent>
          {financials?.transactions?.length > 0 ? (
            <div className="space-y-2">
              {financials.transactions.slice(0, 20).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">
                      {tx.type === 'COLLECTED' ? '📥 Encaissement' : '📤 Reversement'}
                      {tx.colis && <span className="text-slate-400 ml-2 font-mono text-xs">{tx.colis.trackingNumber}</span>}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    {tx.description && <p className="text-xs text-slate-400">{tx.description}</p>}
                  </div>
                  <p className={`font-bold ${tx.type === 'COLLECTED' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {tx.type === 'COLLECTED' ? '+' : '-'}{tx.amount.toFixed(0)} DA
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">Aucune transaction enregistrée</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Settings Tab
function SettingsTab({ relaisInfo, onUpdate }: { relaisInfo: any; onUpdate: () => void }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    commerceName: '',
    address: '',
    ville: '',
    phone: '',
  });

  useEffect(() => {
    if (relaisInfo) {
      setFormData({
        commerceName: relaisInfo.commerceName || '',
        address: relaisInfo.address || '',
        ville: relaisInfo.ville || '',
        phone: relaisInfo.user?.phone || '',
      });
    }
  }, [relaisInfo]);

  const handleSave = async () => {
    if (!relaisInfo?.id) {
      toast({ title: 'Erreur', description: 'Relais non trouvé', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const relaisResponse = await fetch(`/api/relais/${relaisInfo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commerceName: formData.commerceName,
          address: formData.address,
          ville: formData.ville,
        }),
      });

      if (!relaisResponse.ok) {
        const error = await relaisResponse.json();
        throw new Error(error.details || 'Failed to save relais');
      }

      if (relaisInfo.user?.id && formData.phone !== relaisInfo.user?.phone) {
        await fetch(`/api/users/${relaisInfo.user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formData.phone }),
        });
      }

      toast({ title: 'Succès', description: 'Paramètres sauvegardés' });
      onUpdate();
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de sauvegarder',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres du point relais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nom du commerce</Label>
            <Input value={formData.commerceName} onChange={(e) => setFormData({ ...formData, commerceName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Adresse</Label>
            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Ville</Label>
            <Select value={formData.ville} onValueChange={(v) => setFormData({ ...formData, ville: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WILAYAS.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Sauvegarder
        </Button>
      </CardContent>
    </Card>
  );
}
