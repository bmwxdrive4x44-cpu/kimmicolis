'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import {
  DashboardEmptyState,
  DashboardHero,
  DashboardLoadingState,
  DashboardMetricCard,
  DashboardPanel,
  DashboardSection,
  DashboardShell,
  DashboardStatsGrid,
  dashboardMetaBadgeClass,
  dashboardTabsContentClass,
  dashboardTabsListClass,
  getDashboardTabsTriggerClass,
} from '@/components/dashboard/dashboard-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FormFieldError, FormGlobalError } from '@/components/ui/form-error';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WILAYAS, PARCEL_STATUS, TRAJET_STATUS } from '@/lib/constants';
import { parseLocaleFloat } from '@/lib/utils';
import { asArray, parseStoredStringArray } from '@/lib/safe-data';
import { Truck, Plus, Package, MapPin, DollarSign, Loader2, CheckCircle, Clock, Route, QrCode, Navigation, Scan, Wallet, ArrowUpFromLine, TrendingUp, History, Save, Pencil, User, Zap, Settings, BarChart2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransporterDashboardController } from '@/hooks/use-transporter-dashboard-controller';

export default function TransporterDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const {
    userId,
    userName,
    stats,
    kpiLoading,
    applicationStatus,
    isDashboardLoading,
    shouldRenderNull,
    completionRate,
    refreshStats,
    goToProfileCompletion,
  } = useTransporterDashboardController();

  if (isDashboardLoading) {
    return <DashboardLoadingState tone="transporteur" title="Chargement de votre espace transporteur" description="Synchronisation des missions, KPI et trajets..." />;
  }

  if (shouldRenderNull || !userId) {
    return null;
  }

  if (applicationStatus !== 'APPROVED') {
    const isRejected = applicationStatus === 'REJECTED';
    return (
      <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#f8fafc,_#ecfeff_42%,_#cffafe_100%)] dark:bg-slate-900">
        <Header />
        <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
          <DashboardShell tone="transporteur" className="mx-auto max-w-3xl">
            <DashboardPanel tone="transporteur">
              <Card>
                <CardHeader>
                  <CardTitle>{isRejected ? 'Dossier transporteur refusé' : 'Dossier transporteur en cours de validation'}</CardTitle>
                  <CardDescription>
                    {isRejected
                      ? 'Votre dossier n\'est pas encore validé. Mettez à jour vos justificatifs pour réactiver le service.'
                      : 'Vous ne pouvez pas utiliser les services transporteur tant que vos documents ne sont pas validés par un administrateur.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button onClick={goToProfileCompletion}>
                    Mettre à jour mon dossier
                  </Button>
                  <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                    Statut: {isRejected ? 'Refusé' : 'En attente'}
                  </Badge>
                </CardContent>
              </Card>
            </DashboardPanel>
          </DashboardShell>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#f8fafc,_#ecfeff_42%,_#cffafe_100%)] dark:bg-slate-900">
      <Header />
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <DashboardShell tone="transporteur" className="mx-auto max-w-[92rem]">
          <DashboardHero
            tone="transporteur"
            eyebrow="Mobilité terrain"
            title="Espace Transporteur"
            description="Pilotez vos trajets, missions, scans et revenus depuis une vue plus fluide, pensée pour une lecture rapide entre deux départs."
            meta={
              <>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>Bienvenue, {userName}</Badge>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>Profil actif</Badge>
              </>
            }
          />

          <DashboardSection
            tone="transporteur"
            eyebrow="Performance"
            title="KPI activité"
            description="Suivez la cadence business et vos résultats de livraison avec une lecture immédiate."
          >
            <DashboardStatsGrid>
              <DashboardMetricCard tone="transporteur" label="Mes trajets" value={stats.trajets} icon={<Route className="h-5 w-5" />} detail="trajets publies" />
              <DashboardMetricCard tone="transporteur" label="Missions totales" value={stats.totalMissions} icon={<Package className="h-5 w-5" />} detail={kpiLoading ? 'chargement KPI...' : `${stats.activeMissions} actives`} />
              <DashboardMetricCard tone="transporteur" label="Taux de completion" value={`${completionRate}%`} icon={<CheckCircle className="h-5 w-5" />} detail={`${stats.completedMissions} livrees`} />
              <DashboardMetricCard tone="transporteur" label="Gains" value={`${stats.earnings} DA`} icon={<DollarSign className="h-5 w-5" />} detail="missions livrees" />
            </DashboardStatsGrid>
          </DashboardSection>

          <DashboardSection
            tone="transporteur"
            eyebrow="Flux"
            title="Etats missions"
            description="Séparez clairement les missions assignées, en cours et finalisées."
          >
            <DashboardStatsGrid className="md:grid-cols-3 xl:grid-cols-3">
              <DashboardMetricCard tone="transporteur" label="Assignees" value={stats.assignedMissions} icon={<Clock className="h-5 w-5" />} detail="en attente de prise en charge" />
              <DashboardMetricCard tone="transporteur" label="En cours" value={stats.inProgressMissions} icon={<Truck className="h-5 w-5" />} detail="collecte ou transport" />
              <DashboardMetricCard tone="transporteur" label="Livrees" value={stats.completedMissions} icon={<CheckCircle className="h-5 w-5" />} detail="missions finalisees" />
            </DashboardStatsGrid>
          </DashboardSection>

          <DashboardSection
            tone="transporteur"
            eyebrow="Modules"
            title="Pilotage opérationnel"
            description="Accédez aux écrans missions, scan, portefeuille et profil dans un layout cohérent."
            contentClassName="bg-transparent p-0 border-0 shadow-none ring-0"
          >
            <DashboardPanel tone="transporteur">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className={`${dashboardTabsListClass} grid grid-cols-2 lg:grid-cols-7`}>
                <TabsTrigger value="overview" className={getDashboardTabsTriggerClass('transporteur')}><MapPin className="h-4 w-4 mr-1 hidden sm:inline" />Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="trajets" className={getDashboardTabsTriggerClass('transporteur')}><Route className="h-4 w-4 mr-1 hidden sm:inline" />Trajets</TabsTrigger>
                <TabsTrigger value="missions" className={getDashboardTabsTriggerClass('transporteur')}><Package className="h-4 w-4 mr-1 hidden sm:inline" />Missions</TabsTrigger>
                <TabsTrigger value="scan" className={getDashboardTabsTriggerClass('transporteur')}><QrCode className="h-4 w-4 mr-1 hidden sm:inline" />Scanner</TabsTrigger>
                <TabsTrigger value="wallet" className={getDashboardTabsTriggerClass('transporteur')}><Wallet className="h-4 w-4 mr-1 hidden sm:inline" />Portefeuille</TabsTrigger>
                <TabsTrigger value="auto-assign" className={getDashboardTabsTriggerClass('transporteur')}><Zap className="h-4 w-4 mr-1 hidden sm:inline" />Auto-assign</TabsTrigger>
                <TabsTrigger value="profil" className={getDashboardTabsTriggerClass('transporteur')}><Truck className="h-4 w-4 mr-1 hidden sm:inline" />Infos perso</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className={dashboardTabsContentClass}>
                <OverviewTab userId={userId} setActiveTab={setActiveTab} />
              </TabsContent>
              <TabsContent value="trajets" className={dashboardTabsContentClass}>
                <TrajetsTab userId={userId} />
              </TabsContent>
              <TabsContent value="missions" className={dashboardTabsContentClass}>
                <MissionsTab userId={userId} onRefreshStats={refreshStats} />
              </TabsContent>
              <TabsContent value="scan" className={dashboardTabsContentClass}>
                <ScanTab userId={userId} onRefreshStats={refreshStats} />
              </TabsContent>
              <TabsContent value="wallet" className={dashboardTabsContentClass}>
                <WalletTab userId={userId} />
              </TabsContent>
              <TabsContent value="auto-assign" className={dashboardTabsContentClass}>
                <AutoAssignTab userId={userId} />
              </TabsContent>
                <TabsContent value="profil" className={dashboardTabsContentClass}>
                  <ProfilTab userId={userId} userName={userName} />
                </TabsContent>
              </Tabs>
            </DashboardPanel>
          </DashboardSection>
        </DashboardShell>
      </main>
      <Footer />
    </div>
  );
}

// Overview Tab
function OverviewTab({ userId, setActiveTab }: { userId: string; setActiveTab: (tab: string) => void }) {
  const { toast } = useToast();
  const [availableMissions, setAvailableMissions] = useState<any[]>([]);
  const [myTrajets, setMyTrajets] = useState<any[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const [parcelsRes, trajetsRes] = await Promise.all([
        fetch('/api/parcels?available=true'),
        fetch(`/api/trajets?transporteurId=${userId}`),
      ]);
      const parcels = await parcelsRes.json();
      const trajetsData = await trajetsRes.json();
      const missions = Array.isArray(parcels) ? parcels.map((p: any) => ({ id: p.id, colis: p, colisId: p.id })) : [];
      setAvailableMissions(missions);
      setMyTrajets(Array.isArray(trajetsData) ? trajetsData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleAcceptMission = async (parcelId: string) => {
    setAcceptingId(parcelId);
    try {
      const response = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colisId: parcelId,
          transporteurId: userId,
        }),
      });
      
      if (response.ok) {
        toast({ title: 'Mission acceptée', description: 'Le colis vous a été assigné' });
        fetchData();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'accepter la mission', variant: 'destructive' });
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Missions disponibles</CardTitle>
          <CardDescription>Colis en attente de transport</CardDescription>
        </CardHeader>
        <CardContent>
          {availableMissions.length === 0 ? (
            <DashboardEmptyState title="Aucune mission disponible" description="De nouvelles opportunités apparaîtront ici dès qu'un colis est proposé." icon={<Package className="h-5 w-5" />} />
          ) : (
            <div className="space-y-3">
              {availableMissions.slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-start justify-between p-3 border rounded-lg gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold">{m.colis?.trackingNumber}</p>
                    <p className="text-xs text-slate-600">
                      {WILAYAS.find(w => w.id === m.colis?.villeDepart)?.name || m.colis?.villeDepart}
                      {' → '}
                      {WILAYAS.find(w => w.id === m.colis?.villeArrivee)?.name || m.colis?.villeArrivee}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(m.colis?.weight ? `${m.colis.weight} kg` : 'Poids non renseigné')} · Relais: {m.colis?.relaisDepart?.commerceName || '—'}
                    </p>
                    {m.colis?.netTransporteur > 0 && (
                      <p className="text-xs font-semibold text-emerald-600 mt-0.5">{m.colis.netTransporteur} DA</p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleAcceptMission(m.colisId)}
                    disabled={acceptingId === m.colisId}
                    className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                  >
                    {acceptingId === m.colisId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accepter'}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab('missions')}>
            Voir toutes les missions
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mes trajets à venir</CardTitle>
          <CardDescription>Trajets programmés</CardDescription>
        </CardHeader>
        <CardContent>
          {myTrajets.filter(t => t.status === 'PROGRAMME').length === 0 ? (
            <DashboardEmptyState title="Aucun trajet programmé" description="Créez un trajet pour recevoir des missions compatibles automatiquement." icon={<Route className="h-5 w-5" />} />
          ) : (
            <div className="space-y-3">
              {myTrajets.filter(t => t.status === 'PROGRAMME').map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold">{WILAYAS.find(w => w.id === t.villeDepart)?.name} → {WILAYAS.find(w => w.id === t.villeArrivee)?.name}</p>
                    <p className="text-xs text-slate-500">{new Date(t.dateDepart).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})} · Capacité restante: {Math.max((t.placesColis || 0) - (t.placesUtilisees || 0), 0)} colis</p>
                  </div>
                  <Badge variant="outline">Chargé {t.placesUtilisees}/{t.placesColis}</Badge>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab('trajets')}>
            Gérer mes trajets
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Trajets Tab
function TrajetsTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const WEEKDAY_OPTIONS = [
    { id: 6, label: 'Samedi' },
    { id: 0, label: 'Dimanche' },
    { id: 1, label: 'Lundi' },
    { id: 2, label: 'Mardi' },
    { id: 3, label: 'Mercredi' },
    { id: 4, label: 'Jeudi' },
    { id: 5, label: 'Vendredi' },
  ];
  const [trajets, setTrajets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    villeDepart?: string;
    villeArrivee?: string;
    dateDepart?: string;
    placesColis?: string;
    villesEtapes?: string;
    capacitePoidsKg?: string;
    capaciteSurfaceM2?: string;
    recurrenceDays?: string;
    recurrenceWeekdays?: string;
  }>({});
  const formatVillesEtapes = (value: unknown): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // not JSON, fallback to CSV
      }
      return raw.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
  };
  const [formData, setFormData] = useState({
    villeDepart: '',
    villeArrivee: '',
    dateDepart: '',
    placesColis: '10',
    villesEtapes: '',
    capacitePoidsKg: '',
    capaciteSurfaceM2: '',
    recurrenceMode: 'SINGLE',
    recurrenceDays: '7',
    recurrenceWeekdays: ['6', '0', '1', '2', '3'],
  });

  const setFormField = (key: keyof typeof formData, value: any) => {
    setSubmitError(null);
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleWeekday = (weekday: string, checked: boolean) => {
    const current = new Set(formData.recurrenceWeekdays);
    if (checked) current.add(weekday);
    else current.delete(weekday);
    setFormField('recurrenceWeekdays', Array.from(current));
  };

  const getRecurrenceLabel = (mode?: string) => {
    if (mode === 'DAILY') return 'Quotidien';
    if (mode === 'WORKDAYS_DZ') return 'Ouvrés DZ';
    if (mode === 'CUSTOM_DAYS') return 'Jours personnalisés';
    return 'Unique';
  };

  const getWeekdayShortLabel = (day: number) => {
    const map: Record<number, string> = {
      0: 'Dim',
      1: 'Lun',
      2: 'Mar',
      3: 'Mer',
      4: 'Jeu',
      5: 'Ven',
      6: 'Sam',
    };
    return map[day] || String(day);
  };

  const getRecurrenceDetails = (trajet: any) => {
    if (trajet?.recurrenceMode === 'WORKDAYS_DZ') {
      return 'Sam, Dim, Lun, Mar, Mer';
    }
    if (trajet?.recurrenceMode === 'CUSTOM_DAYS') {
      const days = Array.isArray(trajet?.recurrenceWeekdays)
        ? trajet.recurrenceWeekdays
            .map((d: unknown) => Number.parseInt(String(d), 10))
            .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
      if (days.length === 0) return null;
      return days.sort((a: number, b: number) => (a === 6 ? -1 : a) - (b === 6 ? -1 : b)).map(getWeekdayShortLabel).join(', ');
    }
    return null;
  };

  const validateCreateForm = () => {
    const errors: {
      villeDepart?: string;
      villeArrivee?: string;
      dateDepart?: string;
      placesColis?: string;
      villesEtapes?: string;
      capacitePoidsKg?: string;
      capaciteSurfaceM2?: string;
      recurrenceDays?: string;
      recurrenceWeekdays?: string;
    } = {};

    const villeDepart = formData.villeDepart.trim();
    const villeArrivee = formData.villeArrivee.trim();
    const dateDepart = formData.dateDepart.trim();
    const placesColis = parseInt(formData.placesColis, 10);
    const capacitePoidsKg = formData.capacitePoidsKg ? Number.parseFloat(formData.capacitePoidsKg) : null;
    const capaciteSurfaceM2 = formData.capaciteSurfaceM2 ? Number.parseFloat(formData.capaciteSurfaceM2) : null;
    const recurrenceDays = Number.parseInt(formData.recurrenceDays, 10);
    const selectedWeekdays = formData.recurrenceWeekdays.map((d) => Number.parseInt(d, 10)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    const now = Date.now();
    const dateMs = Date.parse(dateDepart);
    const etapes = formatVillesEtapes(formData.villesEtapes);

    if (!villeDepart) errors.villeDepart = 'La ville de départ est obligatoire.';
    if (!villeArrivee) errors.villeArrivee = 'La ville d\'arrivée est obligatoire.';
    if (villeDepart && villeArrivee && villeDepart === villeArrivee) {
      errors.villeArrivee = 'La ville d\'arrivée doit être différente de la ville de départ.';
    }

    if (!dateDepart) {
      errors.dateDepart = 'La date de départ est obligatoire.';
    } else if (Number.isNaN(dateMs)) {
      errors.dateDepart = 'La date de départ est invalide.';
    } else if (dateMs < now) {
      errors.dateDepart = 'La date de départ doit être dans le futur.';
    }

    if (!Number.isInteger(placesColis) || placesColis < 1 || placesColis > 200) {
      errors.placesColis = 'La capacité doit être un entier entre 1 et 200.';
    }

    if (capacitePoidsKg !== null && (!Number.isFinite(capacitePoidsKg) || capacitePoidsKg < 20 || capacitePoidsKg > 20000)) {
      errors.capacitePoidsKg = 'Le poids max doit être entre 20 et 20000 kg.';
    }

    if (capaciteSurfaceM2 !== null && (!Number.isFinite(capaciteSurfaceM2) || capaciteSurfaceM2 < 0.5 || capaciteSurfaceM2 > 100)) {
      errors.capaciteSurfaceM2 = 'La surface utile doit être entre 0.5 et 100 m2.';
    }

    if (capacitePoidsKg === null && capaciteSurfaceM2 === null) {
      errors.capacitePoidsKg = 'Renseignez au moins le poids max ou la surface utile.';
      errors.capaciteSurfaceM2 = 'Renseignez au moins le poids max ou la surface utile.';
    }

    if (formData.recurrenceMode !== 'SINGLE' && (!Number.isInteger(recurrenceDays) || recurrenceDays < 2 || recurrenceDays > 30)) {
      errors.recurrenceDays = 'La récurrence doit être entre 2 et 30 jours.';
    }

    if (formData.recurrenceMode === 'CUSTOM_DAYS' && selectedWeekdays.length === 0) {
      errors.recurrenceWeekdays = 'Sélectionnez au moins un jour.';
    }

    if (etapes.some((e) => e === villeDepart || e === villeArrivee)) {
      errors.villesEtapes = 'Les villes étapes ne doivent pas répéter la ville de départ ou d\'arrivée.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitError('Veuillez corriger les champs en rouge.');
      toast({ title: 'Erreur', description: 'Veuillez corriger les champs en rouge.', variant: 'destructive' });
      return false;
    }

    setSubmitError(null);
    return true;
  };

  useEffect(() => { fetchTrajets(); }, [userId]);

  const fetchTrajets = async () => {
    try {
      const response = await fetch(`/api/trajets?transporteurId=${userId}`);
      const data = await response.json().catch(() => null);
      setTrajets(asArray<any>(data));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTrajet = async (trajetId: string, status: string) => {
    setUpdatingId(trajetId);
    try {
      const res = await fetch(`/api/trajets/${trajetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const labels: Record<string, string> = { EN_COURS: 'Trajet démarré', TERMINE: 'Trajet terminé', ANNULE: 'Trajet annulé' };
        toast({ title: labels[status] || 'Statut mis à jour' });
        fetchTrajets();
      } else {
        toast({ title: 'Erreur', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});
    if (!validateCreateForm()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/trajets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          transporteurId: userId,
          placesColis: parseInt(formData.placesColis),
          recurrenceDays: parseInt(formData.recurrenceDays, 10),
          recurrenceWeekdays: formData.recurrenceWeekdays.map((d) => Number.parseInt(d, 10)),
          capacitePoidsKg: formData.capacitePoidsKg ? Number.parseFloat(formData.capacitePoidsKg) : null,
          capaciteSurfaceM2: formData.capaciteSurfaceM2 ? Number.parseFloat(formData.capaciteSurfaceM2) : null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data?.field) {
          setFieldErrors((prev) => ({ ...prev, [data.field]: data?.details || data?.error || 'Valeur invalide' }));
        }
        if (Array.isArray(data?.fields)) {
          const next: typeof fieldErrors = {};
          if (data.fields.includes('villeDepart')) next.villeDepart = 'La ville de départ est obligatoire.';
          if (data.fields.includes('villeArrivee')) next.villeArrivee = 'La ville d\'arrivée est obligatoire.';
          if (data.fields.includes('dateDepart')) next.dateDepart = 'La date de départ est obligatoire.';
          if (data.fields.includes('placesColis')) next.placesColis = 'La capacité colis est obligatoire.';
          if (data.fields.includes('capacitePoidsKg')) next.capacitePoidsKg = 'Le poids max est invalide.';
          if (data.fields.includes('capaciteSurfaceM2')) next.capaciteSurfaceM2 = 'La surface utile est invalide.';
          if (data.fields.includes('recurrenceDays')) next.recurrenceDays = 'Le nombre de jours est invalide.';
          if (data.fields.includes('recurrenceWeekdays')) next.recurrenceWeekdays = 'Sélectionnez au moins un jour.';
          setFieldErrors((prev) => ({ ...prev, ...next }));
        }
        throw new Error(data?.details || data?.error || 'Impossible d\'enregistrer le trajet');
      }

      const createdCount = Number(data?.createdCount || 1);
      toast({
        title: createdCount > 1 ? 'Trajets enregistrés' : 'Trajet enregistré',
        description: createdCount > 1
          ? `${createdCount} trajets ont été publiés automatiquement.`
          : 'Le trajet a bien été publié.',
      });
      fetchTrajets();
      setFormData({
        villeDepart: '',
        villeArrivee: '',
        dateDepart: '',
        placesColis: '10',
        villesEtapes: '',
        capacitePoidsKg: '',
        capaciteSurfaceM2: '',
        recurrenceMode: 'SINGLE',
        recurrenceDays: '7',
        recurrenceWeekdays: ['6', '0', '1', '2', '3'],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d\'enregistrer le trajet';
      setSubmitError(message);
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Publier un trajet</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormGlobalError message={submitError} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ville de départ <span className="text-red-500">*</span></Label>
                <Select value={formData.villeDepart} onValueChange={(v) => setFormField('villeDepart', v)}>
                  <SelectTrigger className={fieldErrors.villeDepart ? 'border-red-400' : ''}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormFieldError message={fieldErrors.villeDepart} />
              </div>
              <div className="space-y-2">
                <Label>Ville d'arrivée <span className="text-red-500">*</span></Label>
                <Select value={formData.villeArrivee} onValueChange={(v) => setFormField('villeArrivee', v)}>
                  <SelectTrigger className={fieldErrors.villeArrivee ? 'border-red-400' : ''}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormFieldError message={fieldErrors.villeArrivee} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Date de départ <span className="text-red-500">*</span></Label>
                <Input type="datetime-local" value={formData.dateDepart} onChange={(e) => setFormField('dateDepart', e.target.value)} className={fieldErrors.dateDepart ? 'border-red-400' : ''} />
                <FormFieldError message={fieldErrors.dateDepart} />
              </div>
              <div className="space-y-2">
                <Label>Capacité équivalente (petits colis) <span className="text-red-500">*</span></Label>
                <Input type="number" min={1} step={1} value={formData.placesColis} onChange={(e) => setFormField('placesColis', e.target.value)} placeholder="Ex: 10" className={fieldErrors.placesColis ? 'border-red-400' : ''} />
                <p className="text-xs text-slate-500">Indication de volume en équivalent petits colis. Pour les colis volumineux, renseignez aussi la surface/poids ci-dessous.</p>
                <FormFieldError message={fieldErrors.placesColis} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Poids max utile (kg)</Label>
                <Input
                  type="number"
                  min={20}
                  max={20000}
                  step={10}
                  value={formData.capacitePoidsKg}
                  onChange={(e) => setFormField('capacitePoidsKg', e.target.value)}
                  placeholder="Ex: 600"
                  className={fieldErrors.capacitePoidsKg ? 'border-red-400' : ''}
                />
                <FormFieldError message={fieldErrors.capacitePoidsKg} />
              </div>
              <div className="space-y-2">
                <Label>Surface utile estimée (m2)</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.1}
                  value={formData.capaciteSurfaceM2}
                  onChange={(e) => setFormField('capaciteSurfaceM2', e.target.value)}
                  placeholder="Ex: 2.4"
                  className={fieldErrors.capaciteSurfaceM2 ? 'border-red-400' : ''}
                />
                <p className="text-xs text-slate-500">Exemple utilitaire léger: 2.0 a 3.5 m2 utiles.</p>
                <FormFieldError message={fieldErrors.capaciteSurfaceM2} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Publication</Label>
                <Select value={formData.recurrenceMode} onValueChange={(v) => setFormField('recurrenceMode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">Publication unique</SelectItem>
                    <SelectItem value="DAILY">Navette quotidienne (auto)</SelectItem>
                    <SelectItem value="WORKDAYS_DZ">Jours ouvrés DZ (sam-mer, hors jeu/ven)</SelectItem>
                    <SelectItem value="CUSTOM_DAYS">Jours personnalisés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.recurrenceMode !== 'SINGLE' && (
                <div className="space-y-2">
                  <Label>Nombre de jours à générer</Label>
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    step={1}
                    value={formData.recurrenceDays}
                    onChange={(e) => setFormField('recurrenceDays', e.target.value)}
                    className={fieldErrors.recurrenceDays ? 'border-red-400' : ''}
                  />
                  <p className="text-xs text-slate-500">
                    {formData.recurrenceMode === 'WORKDAYS_DZ'
                      ? 'Exemple: 7 pour générer 7 départs en jours ouvrés algériens (jeudi/vendredi exclus).'
                      : 'Exemple: 7 pour publier automatiquement la navette des 7 prochains jours.'}
                  </p>
                  <FormFieldError message={fieldErrors.recurrenceDays} />
                </div>
              )}
            </div>
            {formData.recurrenceMode === 'CUSTOM_DAYS' && (
              <div className="space-y-2">
                <Label>Jours de départ</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const checked = formData.recurrenceWeekdays.includes(String(day.id));
                    return (
                      <label key={day.id} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleWeekday(String(day.id), Boolean(v))}
                        />
                        <span>{day.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500">Tip: pour l'Algérie, évitez jeudi/vendredi si vous voulez uniquement les jours ouvrés.</p>
                <FormFieldError message={fieldErrors.recurrenceWeekdays} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Villes étapes (optionnel, séparées par des virgules)</Label>
              <Input value={formData.villesEtapes} onChange={(e) => setFormField('villesEtapes', e.target.value)} placeholder="Ex: blida, medea" className={fieldErrors.villesEtapes ? 'border-red-400' : ''} />
              <FormFieldError message={fieldErrors.villesEtapes} />
            </div>
            <Button type="submit" disabled={isCreating} className="bg-emerald-600 hover:bg-emerald-700">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Publier le trajet
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mes trajets ({trajets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Date départ</TableHead>
                  <TableHead>Capacité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trajets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {WILAYAS.find(w => w.id === t.villeDepart)?.name} → {WILAYAS.find(w => w.id === t.villeArrivee)?.name}
                      {formatVillesEtapes(t.villesEtapes).length > 0 && (
                        <p className="text-xs text-slate-400">via {formatVillesEtapes(t.villesEtapes).join(', ')}</p>
                      )}
                      <div className="mt-1">
                        <Badge variant="outline" className="text-xs">
                          Récurrence: {getRecurrenceLabel(t.recurrenceMode)}
                        </Badge>
                        {getRecurrenceDetails(t) && (
                          <p className="mt-1 text-xs text-slate-500">
                            Jours: {getRecurrenceDetails(t)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(t.dateDepart).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{Math.max((t.placesColis || 0) - (t.placesUtilisees || 0), 0)} dispo</p>
                      <p className="text-xs text-slate-500">Chargé {t.placesUtilisees}/{t.placesColis}</p>
                      {(t.capacitePoidsKg || t.capaciteSurfaceM2) && (
                        <p className="text-xs text-slate-500">
                          {t.capacitePoidsKg ? `${t.capacitePoidsKg} kg` : ''}
                          {t.capacitePoidsKg && t.capaciteSurfaceM2 ? ' · ' : ''}
                          {t.capaciteSurfaceM2 ? `${t.capaciteSurfaceM2} m2` : ''}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${TRAJET_STATUS.find(s => s.id === t.status)?.color} text-white`}>
                        {TRAJET_STATUS.find(s => s.id === t.status)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {t.status === 'PROGRAMME' && (
                          <>
                            <Button size="sm" variant="outline" disabled={updatingId === t.id} onClick={() => handleUpdateTrajet(t.id, 'EN_COURS')}>
                              {updatingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3 mr-1" />}
                              Démarrer
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={updatingId === t.id} onClick={() => handleUpdateTrajet(t.id, 'ANNULE')}>
                              Annuler
                            </Button>
                          </>
                        )}
                        {t.status === 'EN_COURS' && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={updatingId === t.id} onClick={() => handleUpdateTrajet(t.id, 'TERMINE')}>
                            {updatingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                            Terminer
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const MISSION_STATUS_LABELS: Record<string, string> = {
  ASSIGNE: 'Assignée',
  EN_COURS: 'En cours',
  LIVRE: 'Arrivé au relais',
};

// Missions Tab
function MissionsTab({ userId, onRefreshStats }: { userId: string; onRefreshStats?: (background?: boolean) => void }) {
  const { toast } = useToast();
  const [missions, setMissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { fetchMissions(); }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const intervalId = window.setInterval(() => {
      fetchMissions();
      onRefreshStats?.(true);
    }, 15000);

    const handleFocus = () => {
      fetchMissions();
      onRefreshStats?.(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId, onRefreshStats]);

  const fetchMissions = async () => {
    try {
      const response = await fetch(`/api/missions?transporteurId=${userId}`);
      const data = await response.json().catch(() => null);
      setMissions(asArray<any>(data));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/missions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const labels: Record<string, string> = { EN_COURS: 'Transport démarré', LIVRE: 'Arrivée au relais confirmée' };
        toast({ title: labels[status] || 'Statut mis à jour' });
        fetchMissions();
        if (status === 'LIVRE') onRefreshStats?.(true);
      } else {
        toast({ title: 'Erreur lors de la mise à jour', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredMissions = filter === 'all' ? missions : missions.filter(m => m.status === filter);

  return (
    <div className="max-w-4xl mx-auto">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestion des missions</CardTitle>
            <CardDescription>{missions.length} missions</CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="ASSIGNE">Assignées</SelectItem>
              <SelectItem value="EN_COURS">En cours</SelectItem>
              <SelectItem value="LIVRE">Arrivées relais</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : (
          <div className="space-y-4">
            {filteredMissions.map((m) => (
              <div key={m.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold text-sm">{m.colis?.trackingNumber}</p>
                      <p className="text-sm text-slate-600">
                        {WILAYAS.find(w => w.id === m.colis?.villeDepart)?.name || m.colis?.villeDepart}
                        {' → '}
                        {WILAYAS.find(w => w.id === m.colis?.villeArrivee)?.name || m.colis?.villeArrivee}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(m.colis?.weight ? `${m.colis.weight} kg` : 'Poids non renseigné')}
                        {m.colis?.netTransporteur > 0 ? ` · ${m.colis.netTransporteur} DA` : ''}
                      </p>
                      {(m.colis?.relaisDepart || m.colis?.relaisArrivee) && (
                        <p className="text-xs text-slate-400">
                          {m.colis?.relaisDepart?.commerceName} → {m.colis?.relaisArrivee?.commerceName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant="outline" className={m.status === 'LIVRE' ? 'border-green-500 text-green-700' : m.status === 'EN_COURS' ? 'border-blue-500 text-blue-700' : 'border-orange-400 text-orange-700'}>
                      {MISSION_STATUS_LABELS[m.status] || m.status}
                    </Badge>
                    {m.status === 'ASSIGNE' && (
                      <Button size="sm" disabled={processingId === m.id} onClick={() => handleStatusChange(m.id, 'EN_COURS')} className="bg-blue-600 hover:bg-blue-700">
                        {processingId === m.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Navigation className="h-3 w-3 mr-1" />}
                        Démarrer
                      </Button>
                    )}
                    {m.status === 'EN_COURS' && (
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={processingId === m.id} onClick={() => handleStatusChange(m.id, 'LIVRE')}>
                        {processingId === m.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                        Confirmer arrivée relais
                      </Button>
                    )}
                  </div>
                </div>
                {(m.colis?.senderFirstName || m.colis?.recipientFirstName) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-slate-500">
                    <div>
                      <span className="font-medium">Expéditeur :</span> {m.colis?.senderFirstName} {m.colis?.senderLastName}
                      {m.colis?.senderPhone && <span className="block text-slate-400">{m.colis.senderPhone}</span>}
                    </div>
                    <div>
                      <span className="font-medium">Destinataire :</span> {m.colis?.recipientFirstName} {m.colis?.recipientLastName}
                      {m.colis?.recipientPhone && <span className="block text-slate-400">{m.colis.recipientPhone}</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

// Scan Tab
function ScanTab({ userId, onRefreshStats }: { userId: string; onRefreshStats?: (background?: boolean) => void }) {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<string>('');
  const [parcel, setParcel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleScan = async () => {
    if (!scanResult) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/parcels?tracking=${scanResult}`);
      const data = await response.json();
      if (!response.ok || data?.error) {
        toast({ title: 'Erreur', description: 'Colis non trouvé', variant: 'destructive' });
        setParcel(null);
      } else {
        const foundParcel = Array.isArray(data) ? data[0] : data;
        if (!foundParcel) {
          toast({ title: 'Erreur', description: 'Colis non trouvé', variant: 'destructive' });
          setParcel(null);
          return;
        }
        setParcel(foundParcel);
        toast({ title: 'Colis trouvé', description: `Suivi: ${foundParcel.trackingNumber}` });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Colis non trouvé', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!parcel) return;
    const activeMission = asArray<any>(parcel.missions).find((mission) => mission.transporteurId === userId);
    if (!activeMission) {
      toast({ title: 'Mission introuvable', description: 'Aucune mission active liée à ce colis pour ce transporteur', variant: 'destructive' });
      return;
    }

    const missionStatus = status === 'EN_TRANSPORT' ? 'EN_COURS' : status === 'ARRIVE_RELAIS_DESTINATION' ? 'LIVRE' : status;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/missions/${activeMission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: missionStatus }),
      });
      
      if (response.ok) {
        toast({ title: 'Mission mise à jour', description: `Le colis est maintenant: ${PARCEL_STATUS.find(s => s.id === status)?.label}` });
        const refreshedParcelRes = await fetch(`/api/parcels?tracking=${parcel.trackingNumber}`);
        const refreshedParcelData = await refreshedParcelRes.json().catch(() => null);
        const refreshedParcel = Array.isArray(refreshedParcelData) ? refreshedParcelData[0] : refreshedParcelData;
        setParcel(refreshedParcel || { ...parcel, status });
        onRefreshStats?.(true);
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour le statut', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Scan className="h-5 w-5" />Scanner QR Code</CardTitle>
        <CardDescription>Scannez le QR code d'un colis pour le traiter</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input
            placeholder="Entrez le numéro de suivi (ex: SCXXXXXXXXX)"
            value={scanResult}
            onChange={(e) => setScanResult(e.target.value.toUpperCase())}
            className="font-mono"
          />
          <Button onClick={handleScan} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
            Rechercher
          </Button>
        </div>

        {parcel && !parcel.error && (
          <Card className="bg-slate-50 dark:bg-slate-800">
            <CardContent className="py-4 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono font-bold text-lg">{parcel.trackingNumber}</p>
                  <p className="text-sm text-slate-600">
                    {WILAYAS.find(w => w.id === parcel.villeDepart)?.name || parcel.villeDepart}
                    {' → '}
                    {WILAYAS.find(w => w.id === parcel.villeArrivee)?.name || parcel.villeArrivee}
                  </p>
                  <p className="text-xs text-slate-400">Poids : {parcel.weight ? `${parcel.weight} kg` : 'Non renseigné'}</p>
                </div>
                <Badge className={`${PARCEL_STATUS.find(s => s.id === parcel.status)?.color} text-white shrink-0`}>
                  {PARCEL_STATUS.find(s => s.id === parcel.status)?.label}
                </Badge>
              </div>

              {/* Relais */}
              {(parcel.relaisDepart || parcel.relaisArrivee) && (
                <div className="grid gap-3 text-xs lg:grid-cols-2">
                  <div className="min-w-0 p-2 bg-white dark:bg-slate-700 rounded border">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Relais départ</p>
                    <p className="truncate">{parcel.relaisDepart?.commerceName}</p>
                    <p className="text-slate-400">{parcel.relaisDepart?.ville}</p>
                    <p className="text-slate-400 break-words">{parcel.relaisDepart?.address}</p>
                  </div>
                  <div className="min-w-0 p-2 bg-white dark:bg-slate-700 rounded border">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Relais arrivée</p>
                    <p className="truncate">{parcel.relaisArrivee?.commerceName}</p>
                    <p className="text-slate-400">{parcel.relaisArrivee?.ville}</p>
                    <p className="text-slate-400 break-words">{parcel.relaisArrivee?.address}</p>
                  </div>
                </div>
              )}

              {/* Expéditeur / Destinataire */}
              {(parcel.senderFirstName || parcel.recipientFirstName) && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-white dark:bg-slate-700 rounded border">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Expéditeur</p>
                    <p>{parcel.senderFirstName} {parcel.senderLastName}</p>
                    {parcel.senderPhone && <p className="text-slate-400">{parcel.senderPhone}</p>}
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-700 rounded border">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Destinataire</p>
                    <p>{parcel.recipientFirstName} {parcel.recipientLastName}</p>
                    {parcel.recipientPhone && <p className="text-slate-400">{parcel.recipientPhone}</p>}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {['RECU_RELAIS', 'DEPOSITED_RELAY', 'PAID_RELAY'].includes(parcel.status) && (
                  <Button 
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleUpdateStatus('EN_TRANSPORT')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Truck className="h-4 w-4 mr-1" />}
                    Prendre en charge
                  </Button>
                )}
                {parcel.status === 'EN_TRANSPORT' && (
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleUpdateStatus('ARRIVE_RELAIS_DESTINATION')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Arrivé au relais destination
                  </Button>
                )}
                {['ARRIVE_RELAIS_DESTINATION', 'LIVRE'].includes(parcel.status) && (
                  <Badge className="bg-green-100 text-green-700 px-4 py-2">✓ Mission terminée au relais d'arrivée</Badge>
                )}
              </div>

              {/* Historique tracking */}
              {Array.isArray(parcel.trackingHistory) && parcel.trackingHistory.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Historique</p>
                  <div className="space-y-1">
                    {parcel.trackingHistory.map((h: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-slate-500">{new Date(h.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                        <span className="text-slate-700 dark:text-slate-300">{PARCEL_STATUS.find(s => s.id === h.status)?.label || h.status}</span>
                        {h.notes && <span className="text-slate-400">· {h.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

// Wallet Tab — Portefeuille transporteur
function WalletTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; amount: number }[]>([]);
  const [gainsInfo, setGainsInfo] = useState<{ pending: number; available: number; total: number }>({ pending: 0, available: 0, total: 0 });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [missionFilter, setMissionFilter] = useState<'all' | 'LIVRE' | 'ASSIGNE' | 'EN_COURS'>('all');

  const fetchWallet = async () => {
    setIsLoading(true);
    try {
      const [walletRes, gainsRes] = await Promise.all([
        fetch(`/api/wallet?transporteurId=${userId}`),
        fetch(`/api/transporteur/gains?transporteurId=${userId}`),
      ]);
      const walletData = await walletRes.json().catch(() => ({}));
      const gainsData = await gainsRes.json().catch(() => ({}));
      setWallet(walletData?.wallet ?? null);
      setMissions(asArray<any>(gainsData?.missions ?? walletData?.missions));
      setMonthly(asArray<{ month: string; amount: number }>(gainsData?.monthly));
      setGainsInfo({
        pending: gainsData?.wallet?.pending ?? 0,
        available: gainsData?.wallet?.available ?? walletData?.wallet?.availableEarnings ?? 0,
        total: gainsData?.wallet?.total ?? 0,
      });
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchWallet(); }, [userId]);

  const handleWithdraw = async () => {
    const amount = parseLocaleFloat(withdrawAmount);
    if (!amount || amount <= 0) { toast({ title: 'Montant invalide', variant: 'destructive' }); return; }
    const available = wallet?.availableEarnings ?? 0;
    if (amount > available) {
      toast({ title: 'Solde insuffisant', description: `Disponible : ${available.toFixed(0)} DA`, variant: 'destructive' });
      return;
    }
    setIsWithdrawing(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transporteurId: userId, amount }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Erreur', description: data.error, variant: 'destructive' }); }
      else {
        toast({ title: 'Retrait enregistré', description: `${amount.toFixed(0)} DA retiré avec succès` });
        setWithdrawAmount('');
        fetchWallet();
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  const filteredMissions = missionFilter === 'all' ? missions : missions.filter((m: any) => m.status === missionFilter);
  const available = wallet?.availableEarnings ?? 0;
  const withdrawn = wallet?.totalWithdrawn ?? 0;
  const financialSummary = useMemo(() => {
    const completedMissions = missions.filter((mission: any) => mission.status === 'LIVRE');

    return completedMissions.reduce(
      (acc, mission: any) => {
        acc.count += 1;
        acc.clientTotal += Number(mission.colis?.prixClient ?? 0);
        acc.relayTotal += Number(mission.colis?.commissionRelais ?? 0);
        acc.adminTotal += Number(mission.colis?.commissionPlateforme ?? 0);
        acc.netTotal += Number(mission.colis?.netTransporteur ?? 0);
        return acc;
      },
      { count: 0, clientTotal: 0, relayTotal: 0, adminTotal: 0, netTotal: 0 }
    );
  }, [missions]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Solde cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 border-yellow-200">
          <CardContent className="pt-6 text-center">
            <Clock className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
            <p className="text-xs text-yellow-700 mb-1">En attente</p>
            <p className="text-2xl font-bold text-yellow-700">{gainsInfo.pending.toFixed(0)} DA</p>
            <p className="text-xs text-yellow-500 mt-1">Missions en cours ou non financées</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 border-emerald-200">
          <CardContent className="pt-6 text-center">
            <Wallet className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
            <p className="text-xs text-emerald-700 mb-1">Disponible</p>
            <p className="text-2xl font-bold text-emerald-700">{available.toFixed(0)} DA</p>
            <p className="text-xs text-emerald-500 mt-1">Mission terminée et cash relayé</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 border-blue-200">
          <CardContent className="pt-6 text-center">
            <ArrowUpFromLine className="h-5 w-5 text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-blue-700 mb-1">Total retiré</p>
            <p className="text-2xl font-bold text-blue-700">{withdrawn.toFixed(0)} DA</p>
            <p className="text-xs text-blue-500 mt-1">Versements effectués</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 border-purple-200">
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-5 w-5 text-purple-600 mx-auto mb-2" />
            <p className="text-xs text-purple-700 mb-1">Total gains confirmés</p>
            <p className="text-2xl font-bold text-purple-700">{gainsInfo.total.toFixed(0)} DA</p>
            <p className="text-xs text-purple-500 mt-1">Missions terminées à l'arrivée</p>
          </CardContent>
        </Card>
      </div>

      {/* Retrait */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ArrowUpFromLine className="h-5 w-5 text-emerald-600" />Demander un retrait</CardTitle>
          <CardDescription>Solde disponible : <span className="font-semibold text-emerald-700">{available.toFixed(0)} DA</span></CardDescription>
        </CardHeader>
        <CardContent>
          {available <= 0 ? (
            <p className="text-slate-500 text-sm">Aucun gain disponible pour le moment. Complétez des livraisons pour débloquer vos gains.</p>
          ) : (
            <div className="flex gap-3 max-w-sm">
              <Input
                type="number"
                placeholder={`Max : ${available.toFixed(0)} DA`}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="100"
                max={available}
              />
              <Button onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount} className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0">
                {isWithdrawing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                Retirer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détail du calcul</CardTitle>
          <CardDescription>Le net transporteur est calculé pour chaque colis avant paiement, avec des taux réglables par l'administrateur.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>Net transporteur = tarif client - commission admin - commission relais.</p>
          <p>Le montant passe en attente quand la mission démarre, puis devient disponible quand la mission est terminée au relais d'arrivée et que le cash du relais de départ a été reversé.</p>
          <p>Quand l'administrateur modifie les taux dans les paramètres, ces nouvelles valeurs s'appliquent aux nouveaux colis créés ensuite.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Résumé financier global</CardTitle>
          <CardDescription>Totaux calculés sur les missions terminées à l'arrivée.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500">Missions</p>
              <p className="text-2xl font-bold">{financialSummary.count}</p>
            </div>
            <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500">Tarif client</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{financialSummary.clientTotal.toFixed(0)} DA</p>
            </div>
            <div className="rounded-lg border p-4 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200">
              <p className="text-xs text-emerald-700">Commission relais</p>
              <p className="text-2xl font-bold text-emerald-700">{financialSummary.relayTotal.toFixed(0)} DA</p>
            </div>
            <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <p className="text-xs text-blue-700">Commission admin</p>
              <p className="text-2xl font-bold text-blue-700">{financialSummary.adminTotal.toFixed(0)} DA</p>
            </div>
            <div className="rounded-lg border p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200">
              <p className="text-xs text-purple-700">Net transporteur</p>
              <p className="text-2xl font-bold text-purple-700">{financialSummary.netTotal.toFixed(0)} DA</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gains mensuels */}
      {monthly.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Gains mensuels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...monthly].reverse().map(({ month, amount }) => {
                const maxAmount = Math.max(...monthly.map(m => m.amount), 1);
                const pct = Math.round((amount / maxAmount) * 100);
                return (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 w-16 shrink-0">{month}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                      <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-emerald-700 w-20 text-right shrink-0">{amount.toFixed(0)} DA</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique missions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Historique des missions ({missions.length})</CardTitle>
            <Select value={missionFilter} onValueChange={(v: any) => setMissionFilter(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="LIVRE">Terminées à l'arrivée</SelectItem>
                <SelectItem value="EN_COURS">En cours</SelectItem>
                <SelectItem value="ASSIGNE">Assignées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMissions.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Aucune mission</p>
          ) : (
            <div className="space-y-2">
              {filteredMissions.slice(0, 30).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {WILAYAS.find(w => w.id === m.colis?.villeDepart)?.name || m.colis?.villeDepart}
                      {' → '}
                      {WILAYAS.find(w => w.id === m.colis?.villeArrivee)?.name || m.colis?.villeArrivee}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">#{m.colis?.trackingNumber}</p>
                    <p className="text-xs text-slate-400">
                      {(m.colis?.weight ? `${m.colis.weight} kg` : 'Poids non renseigné')}
                      {' · '}
                      {new Date(m.completedAt ?? m.updatedAt ?? m.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })}
                    </p>
                    <p className="text-xs text-slate-500">
                      Tarif client: {(m.colis?.prixClient ?? 0).toFixed(0)} DA
                      {' · '}
                      Relais: {(m.colis?.commissionRelais ?? 0).toFixed(0)} DA
                      {' · '}
                      Admin: {(m.colis?.commissionPlateforme ?? 0).toFixed(0)} DA
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-bold text-emerald-600">{(m.colis?.netTransporteur ?? 0).toFixed(0)} DA</p>
                    <Badge className={`text-xs mt-1 ${m.status === 'LIVRE' ? 'bg-green-100 text-green-700' : m.status === 'EN_COURS' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {m.status === 'LIVRE' ? 'Terminée' : m.status === 'EN_COURS' ? 'En cours' : 'Assignée'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Auto-assign Tab — Préférences & automation
function AutoAssignTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [form, setForm] = useState({
    autoAssignEnabled: false,
    autoAssignSchedule: 'DAILY_8AM',
    maxDailyMissions: 10,
    maxActiveParallel: 5,
    maxWeightKg: '',
    acceptsCOD: true,
    acceptsPriority: true,
    acceptsBulk: false,
    preferredCities: [] as string[],
    excludedCities: [] as string[],
    scoreWeightDistance: 30,
    scoreWeightCapacity: 25,
    scoreWeightTiming: 20,
    scoreWeightEarnings: 25,
  });

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [prefsRes, statusRes, analyticsRes] = await Promise.all([
        fetch('/api/transporters/preferences'),
        fetch('/api/transporters/auto-assign'),
        fetch(`/api/transporters/analytics?transporteurId=${userId}`),
      ]);
      const prefsData = await prefsRes.json();
      const statusData = statusRes.ok ? await statusRes.json() : null;
      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : null;

      if (prefsData && !prefsData.error) {
        setPrefs(prefsData);
        setForm({
          autoAssignEnabled: prefsData.autoAssignEnabled ?? false,
          autoAssignSchedule: prefsData.autoAssignSchedule || 'DAILY_8AM',
          maxDailyMissions: prefsData.maxDailyMissions ?? 10,
          maxActiveParallel: prefsData.maxActiveParallel ?? 5,
          maxWeightKg: prefsData.maxWeightKg ? String(prefsData.maxWeightKg) : '',
          acceptsCOD: prefsData.acceptsCOD ?? true,
          acceptsPriority: prefsData.acceptsPriority ?? true,
          acceptsBulk: prefsData.acceptsBulk ?? false,
          preferredCities: parseStoredStringArray(prefsData.preferredCities),
          excludedCities: parseStoredStringArray(prefsData.excludedCities),
          scoreWeightDistance: prefsData.scoreWeightDistance ?? 30,
          scoreWeightCapacity: prefsData.scoreWeightCapacity ?? 25,
          scoreWeightTiming: prefsData.scoreWeightTiming ?? 20,
          scoreWeightEarnings: prefsData.scoreWeightEarnings ?? 25,
        });
      }
      setStatus(statusData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error fetching auto-assign data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [userId]);

  const handleSave = async () => {
    const totalWeight =
      form.scoreWeightDistance + form.scoreWeightCapacity +
      form.scoreWeightTiming + form.scoreWeightEarnings;
    if (totalWeight <= 0) {
      toast({ title: 'Erreur', description: 'La somme des poids de scoring doit être > 0', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/transporters/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Préférences sauvegardées', description: form.autoAssignEnabled ? 'Auto-assign activé ✓' : 'Auto-assign désactivé' });
        await fetchAll();
      } else {
        const data = await res.json();
        toast({ title: 'Erreur', description: data.error || 'Impossible de sauvegarder', variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerNow = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch('/api/transporters/auto-assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: form.maxDailyMissions }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: `${data.summary?.success ?? 0} colis assignés`,
          description: `${data.summary?.failed ?? 0} échec(s) · ${data.summary?.activeMissions ?? 0} missions actives`,
        });
        await fetchAll();
      } else {
        toast({ title: 'Impossible de déclencher', description: data.error, variant: 'destructive' });
      }
    } finally {
      setIsTriggering(false);
    }
  };

  const addCity = (list: 'preferredCities' | 'excludedCities', value: string) => {
    const city = value.trim();
    if (!city) return;
    if (form[list].includes(city)) return;
    setForm(f => ({ ...f, [list]: [...f[list], city] }));
    if (list === 'preferredCities') setCityInput('');
    else setExcludeInput('');
  };

  const removeCity = (list: 'preferredCities' | 'excludedCities', city: string) => {
    setForm(f => ({ ...f, [list]: f[list].filter(c => c !== city) }));
  };

  const scheduleLabel = (s: string) => {
    if (s === 'DAILY_8AM') return 'Tous les jours à 8h';
    if (s === 'DAILY_6PM') return 'Tous les jours à 18h';
    if (s === 'WEEKLY') return 'Une fois par semaine (lundi)';
    return 'Manuel uniquement';
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;

  const totalScoreWeight = form.scoreWeightDistance + form.scoreWeightCapacity + form.scoreWeightTiming + form.scoreWeightEarnings;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Statut en temps réel */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={`border-2 ${form.autoAssignEnabled ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200'}`}>
          <CardContent className="pt-4 pb-4 text-center">
            <Zap className={`h-6 w-6 mx-auto mb-1 ${form.autoAssignEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
            <p className="text-xs font-medium">{form.autoAssignEnabled ? 'Auto-assign actif' : 'Auto-assign inactif'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{scheduleLabel(form.autoAssignSchedule)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Package className="h-6 w-6 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600">{status?.activeCount ?? '—'}</p>
            <p className="text-xs text-slate-500">Missions actives</p>
            <p className="text-xs text-slate-400">max {form.maxActiveParallel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold text-orange-600">{status?.todayCount ?? '—'}</p>
            <p className="text-xs text-slate-500">Assignées aujourd'hui</p>
            <p className="text-xs text-slate-400">max {form.maxDailyMissions}/jour</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <BarChart2 className="h-6 w-6 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold text-purple-600">{prefs?.successRate?.toFixed(0) ?? '100'}%</p>
            <p className="text-xs text-slate-500">Taux de succès</p>
            <p className="text-xs text-slate-400">{analytics?.totalCompleted ?? 0} livrées</p>
          </CardContent>
        </Card>
      </div>

      {/* Activation */}
      <Card data-testid="auto-assign-activation-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-emerald-600" />Activation & Programme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border-2 rounded-lg border-dashed">
            <div>
              <p className="font-semibold">Auto-assign activé</p>
              <p className="text-sm text-slate-500">Reçoit automatiquement des colis selon vos préférences</p>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, autoAssignEnabled: !f.autoAssignEnabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.autoAssignEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.autoAssignEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Fréquence d'attribution automatique</Label>
              <Select value={form.autoAssignSchedule} onValueChange={(v) => setForm(f => ({ ...f, autoAssignSchedule: v }))}>
                <SelectTrigger data-testid="auto-assign-schedule-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY_8AM">Tous les jours à 8h du matin</SelectItem>
                  <SelectItem value="DAILY_6PM">Tous les jours à 18h</SelectItem>
                  <SelectItem value="WEEKLY">Une fois par semaine (lundi 8h)</SelectItem>
                  <SelectItem value="MANUAL">Manuel uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Poids max accepté (kg, optionnel)</Label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={form.maxWeightKg}
                onChange={(e) => setForm(f => ({ ...f, maxWeightKg: e.target.value }))}
                placeholder="Ex: 80 (laisser vide = illimité)"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Maximum de missions par jour</Label>
              <Input
                type="number" min={1} max={100}
                value={form.maxDailyMissions}
                onChange={(e) => setForm(f => ({ ...f, maxDailyMissions: parseInt(e.target.value) || 10 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Maximum de missions en parallèle</Label>
              <Input
                type="number" min={1} max={50}
                value={form.maxActiveParallel}
                onChange={(e) => setForm(f => ({ ...f, maxActiveParallel: parseInt(e.target.value) || 5 }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { key: 'acceptsCOD', label: 'Accepter paiement à la livraison (COD)' },
              { key: 'acceptsPriority', label: 'Accepter colis prioritaires (clients Pro)' },
              { key: 'acceptsBulk', label: 'Accepter expéditions groupées (bulk)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={(form as any)[key]}
                  onCheckedChange={(v) => setForm(f => ({ ...f, [key]: Boolean(v) }))}
                />
                {label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Géographie */}
      <Card data-testid="auto-assign-zones-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-600" />Zones préférées</CardTitle>
          <CardDescription>Optimisez votre attribution en définissant vos zones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Villes préférées</Label>
            <div className="flex gap-2">
              <Input
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCity('preferredCities', cityInput))}
                placeholder="Ex: Alger, Oran, Blida…"
              />
              <Button variant="outline" onClick={() => addCity('preferredCities', cityInput)}>Ajouter</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.preferredCities.map(city => (
                <Badge key={city} className="bg-emerald-100 text-emerald-700 gap-1 pr-1">
                  {city}
                  <button onClick={() => removeCity('preferredCities', city)} className="ml-1 hover:text-red-600"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {form.preferredCities.length === 0 && <p className="text-sm text-slate-400">Aucune ville préférée (toutes les villes acceptées)</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Villes exclues</Label>
            <div className="flex gap-2">
              <Input
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCity('excludedCities', excludeInput))}
                placeholder="Villes à éviter absolument…"
              />
              <Button variant="outline" onClick={() => addCity('excludedCities', excludeInput)}>Exclure</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.excludedCities.map(city => (
                <Badge key={city} className="bg-red-100 text-red-700 gap-1 pr-1">
                  {city}
                  <button onClick={() => removeCity('excludedCities', city)} className="ml-1 hover:text-red-800"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {form.excludedCities.length === 0 && <p className="text-sm text-slate-400">Aucune ville exclue</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring weights */}
      <Card data-testid="auto-assign-criteria-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-slate-600" />Critères de priorité</CardTitle>
          <CardDescription>
            Définissez ce qui compte le plus dans l'attribution (total : <span className={totalScoreWeight === 0 ? 'text-red-500 font-bold' : 'font-bold'}>{totalScoreWeight}</span>)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalScoreWeight === 0 && (
            <div data-testid="scoring-zero-warning" className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              La somme des critères doit être supérieure à 0
            </div>
          )}
          {[
            { key: 'scoreWeightDistance', label: 'Distance route', desc: 'Préférer les routes directes' },
            { key: 'scoreWeightCapacity', label: 'Capacité disponible', desc: 'Préférer les trajets avec place' },
            { key: 'scoreWeightTiming', label: 'Timing départ', desc: 'Préférer les départs proches' },
            { key: 'scoreWeightEarnings', label: 'Potentiel de gains', desc: 'Préférer les colis mieux rémunérés' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between">
                <div>
                  <Label className="text-sm">{label}</Label>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
                <span className="font-mono font-bold text-sm w-8 text-right">{(form as any)[key]}</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={(form as any)[key]}
                onChange={(e) => setForm(f => ({ ...f, [key]: parseInt(e.target.value) }))}
                className="w-full accent-emerald-600"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Analytics */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart2 className="h-5 w-5 text-purple-600" />Analytics auto-assign</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{analytics.totalAssigned ?? 0}</p>
                <p className="text-sm text-slate-500 mt-1">Colis assignés (total)</p>
              </div>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{analytics.totalCompleted ?? 0}</p>
                <p className="text-sm text-slate-500 mt-1">Livrés avec succès</p>
              </div>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{analytics.avgEarningsPerMission?.toFixed(0) ?? 0} DA</p>
                <p className="text-sm text-slate-500 mt-1">Gain moyen/mission</p>
              </div>
            </div>

            {analytics.topRoutes && analytics.topRoutes.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-600 mb-2">Routes les plus fréquentes</p>
                <div className="space-y-2">
                  {analytics.topRoutes.slice(0, 5).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{r.villeDepart} → {r.villeArrivee}</span>
                      <Badge variant="outline">{r.count} missions</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analytics.monthlyStats && analytics.monthlyStats.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-600 mb-2">Missions par mois</p>
                <div className="space-y-1">
                  {analytics.monthlyStats.map((m: any) => {
                    const max = Math.max(...analytics.monthlyStats.map((x: any) => x.count), 1);
                    return (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-16 shrink-0">{m.month}</span>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
                          <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${(m.count / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right">{m.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {status?.lastCheck && (
              <p className="text-xs text-slate-400 mt-4">
                Dernière vérification : {new Date(status.lastCheck).toLocaleString('fr-FR')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={isSaving || totalScoreWeight === 0} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer les préférences
        </Button>
        {form.autoAssignEnabled && (
          <Button variant="outline" onClick={handleTriggerNow} disabled={isTriggering || !status?.canAssignMore}>
            {isTriggering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Déclencher maintenant
          </Button>
        )}
        <Button variant="ghost" onClick={fetchAll} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>
    </div>
  );
}

// Profil Tab
function ProfilTab({ userId, userName }: { userId: string; userName: string }) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    personalAddress: '',
    fullName: '',
    vehicle: '',
    license: '',
    experience: '',
    description: '',
  });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profRes, userRes] = await Promise.all([
        fetch(`/api/transporters?userId=${userId}`),
        fetch(`/api/users/${userId}`),
      ]);
      const profData = await profRes.json();
      const uData = await userRes.json();
      setUserData(uData);
      const p = Array.isArray(profData) && profData.length > 0 ? profData[0] : null;
      setProfile(p);
      setForm({
        firstName: uData?.firstName || '',
        lastName: uData?.lastName || '',
        email: uData?.email || '',
        phone: uData?.phone || '',
        personalAddress: uData?.address || '',
        fullName: p?.fullName || uData?.name || '',
        vehicle: p?.vehicle || '',
        license: p?.license || '',
        experience: String(p?.experience ?? ''),
        description: p?.description || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const handleSave = async () => {
    if (passwordForm.password && passwordForm.password !== passwordForm.confirm) {
      toast({ title: 'Erreur', description: 'Les mots de passe ne correspondent pas', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const userPayload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        address: form.personalAddress,
      };
      if (passwordForm.password) userPayload.password = passwordForm.password;

      const userRes = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload),
      });

      if (profile?.id) {
        await fetch(`/api/transporters/${profile.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: form.fullName || `${form.firstName} ${form.lastName}`.trim(),
            phone: form.phone,
            vehicle: form.vehicle,
            license: form.license,
            experience: parseInt(form.experience) || 0,
            description: form.description,
          }),
        });
      }

      if (userRes.ok) {
        toast({ title: 'Profil mis à jour' });
        setIsEditing(false);
        setPasswordForm({ password: '', confirm: '' });
        await fetchData();
      } else {
        toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;

  const statusConfig: Record<string, { label: string; color: string }> = {
    APPROVED: { label: 'Approuvé', color: 'bg-green-100 text-green-700 border-green-300' },
    PENDING:  { label: 'En attente de validation', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    REJECTED: { label: 'Refusé', color: 'bg-red-100 text-red-700 border-red-300' },
  };
  const s = profile?.status ? statusConfig[profile.status] : null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-600" />
                Mon profil
              </CardTitle>
              <CardDescription>Informations personnelles et professionnelles</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {s && <Badge className={`${s.color} border text-sm`}>{s.label}</Badge>}
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Modifier
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profile ? (
            <p className="text-slate-500">Aucun profil trouvé.</p>
          ) : isEditing ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value, fullName: `${e.target.value} ${form.lastName}`.trim() })} />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value, fullName: `${form.firstName} ${e.target.value}`.trim() })} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Adresse personnelle</Label>
                  <Input value={form.personalAddress} onChange={e => setForm({ ...form, personalAddress: e.target.value })} placeholder="Ex: 12 Rue Didouche Mourad" />
                </div>
                <div className="space-y-2">
                  <Label>Véhicule</Label>
                  <Input value={form.vehicle} onChange={e => setForm({ ...form, vehicle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Permis</Label>
                  <Input value={form.license} onChange={e => setForm({ ...form, license: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Expérience (années)</Label>
                  <Input type="number" min={0} value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nouveau mot de passe (optionnel)</Label>
                  <Input type="password" value={passwordForm.password} onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Confirmer mot de passe</Label>
                  <Input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Enregistrer
                </Button>
                <Button variant="outline" onClick={() => { setIsEditing(false); fetchData(); }}>Annuler</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Prénom</p>
                <p className="font-medium">{userData?.firstName || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Nom</p>
                <p className="font-medium">{userData?.lastName || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Email</p>
                <p className="font-medium">{userData?.email || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Téléphone</p>
                <p className="font-medium">{profile.phone || userData?.phone || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">N° RC (CNRC)</p>
                <p className="font-medium font-mono">{userData?.siret || '—'}</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Adresse personnelle</p>
                <p className="font-medium">{userData?.address || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Véhicule</p>
                <p className="font-medium">{profile.vehicle || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Permis</p>
                <p className="font-medium">{profile.license || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Expérience</p>
                <p className="font-medium">{profile.experience || '—'}</p>
              </div>
              {profile.description && (
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Description</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{profile.description}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
