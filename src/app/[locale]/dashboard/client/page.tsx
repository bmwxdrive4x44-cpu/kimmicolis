'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import {
  DashboardHero,
  DashboardMetricCard,
  DashboardPanel,
  DashboardShell,
  DashboardStatsGrid,
  dashboardTabsListClass,
  getDashboardTabsTriggerClass,
} from '@/components/dashboard/dashboard-shell';
import { WILAYAS, PARCEL_STATUS } from '@/lib/constants';
import { normalizeRole } from '@/lib/roles';
import { Package, Plus, History, MapPin, Loader2, CreditCard, Search, Truck, CheckCircle, Clock, QrCode, Printer, User, Pencil, Save, AlertTriangle, XCircle, MessageSquare, Smartphone, Building2, Trash2, CircleHelp } from 'lucide-react';
import { PRO_DISCOUNT_TIERS, getProBatchDiscountRate, getProBatchDiscountTier } from '@/lib/pricing';
import { useToast } from '@/hooks/use-toast';
import { ParcelDeleteButton, ParcelEditDialog } from '@/components/dashboard/parcel-edit-dialog';
import { CreateParcelForm } from '@/components/dashboard/client/create-parcel-form';

const LABEL_STORAGE_KEY = 'swiftcolis.parcel-labels';

// Helper function for role-based dashboard path
function getRoleBasedDashboardPath(role: string, locale: string): string {
  switch (role) {
    case 'ADMIN': return `/${locale}/dashboard/admin`;
    case 'TRANSPORTER': return `/${locale}/dashboard/transporter`;
    case 'RELAIS': return `/${locale}/dashboard/relais`;
    case 'ENSEIGNE': return `/${locale}/dashboard/enseigne`;
    case 'CLIENT':
    default: return `/${locale}/dashboard/client`;
  }
}

function ClientDashboardContent() {
  const locale = useLocale();

  const { data: session, status, update } = useSession({
    required: true,
    onUnauthenticated() {
      // If user becomes unauthenticated, enforce login redirect
      window.location.replace(`/${locale}/auth/login`);
    },
  });

  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = useMemo(() => {
    if (searchParams.get('track')) return 'track';
    const tab = searchParams.get('tab');
    const allowed = ['create', 'track', 'payment', 'history', 'profil', 'litiges', 'bulk-pro'];
    return allowed.includes(tab || '') ? (tab as string) : 'create';
  }, [searchParams]);
  const initialTracking = useMemo(() => searchParams.get('track') || '', [searchParams]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [stats, setStats] = useState({ created: 0, inTransit: 0, delivered: 0, totalSpent: 0 });
  const [cartCount, setCartCount] = useState(0);
  const [implicitPro, setImplicitPro] = useState({ eligible: false, validParcelsCount: 0, remaining: 5, threshold: 5, windowDays: 90 });

  async function fetchStats() {
    try {
      const [parcelsRes, loyaltyRes] = await Promise.all([
        fetch(`/api/parcels?clientId=${session?.user?.id}`),
        fetch('/api/loyalty/status'),
      ]);

      const parcelsPayload = await parcelsRes.json();
      const parcels = Array.isArray(parcelsPayload) ? parcelsPayload : [];
      const loyalty = await loyaltyRes.json();

      setCartCount(parcels.filter((p: any) => p.status === 'CREATED').length);
      
      setStats({
        created: parcels.filter((p: any) => ['CREATED', 'PAID', 'PAID_RELAY'].includes(p.status)).length,
        inTransit: parcels.filter((p: any) => ['DEPOSITED_RELAY', 'RECU_RELAIS', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION'].includes(p.status)).length,
        delivered: parcels.filter((p: any) => p.status === 'LIVRE').length,
        totalSpent: parcels.reduce((sum: number, p: any) => sum + (p.prixClient || 0), 0),
      });

      if (loyaltyRes.ok) {
        setImplicitPro({
          eligible: Boolean(loyalty.eligible),
          validParcelsCount: Number(loyalty.validParcelsCount || 0),
          remaining: Number(loyalty.remaining || 0),
          threshold: Number(loyalty.threshold || 5),
          windowDays: Number(loyalty.windowDays || 90),
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }

  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] Session status:', status);
    console.log('[Dashboard] Session data:', session);
  }, [status, session]);

  useEffect(() => {
    // Retry session update if no user in session after authentication
    if (status === 'authenticated' && !session?.user) {
      console.warn('[Dashboard] Authenticated but no user object; forcing session update');
      update();
    }
  }, [status, session, update]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const track = searchParams.get('track') || '';

    const timeoutRef = setTimeout(() => {
      if (track) {
        setTrackingNumber(track);
        setActiveTab('track');
        return;
      }

      if (tab && ['create', 'track', 'payment', 'history', 'profil', 'litiges', 'bulk-pro'].includes(tab)) {
        setActiveTab(tab);
      }
    }, 0);

    return () => clearTimeout(timeoutRef);
  }, [searchParams]);

  // Redirect if wrong role
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      const userRole = normalizeRole(session.user.role);
      if (userRole !== 'CLIENT') {
        const path = getRoleBasedDashboardPath(userRole, locale);
        if (path !== window.location.pathname) {
          router.replace(path);
        }
      }
    }
  }, [status, session, locale, router]);

  useEffect(() => {
    const timeoutRef = setTimeout(() => {
      if (session?.user?.id) {
        void fetchStats();
      }
    }, 0);

    return () => clearTimeout(timeoutRef);
  }, [session?.user?.id]);

  useEffect(() => {
    const timeoutRef = setTimeout(() => {
      if (activeTab === 'payment' && session?.user?.id) {
        void fetchStats();
      }
    }, 0);

    return () => clearTimeout(timeoutRef);
  }, [activeTab, session?.user?.id]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Connexion en cours...</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated' && !session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-600 font-bold mb-4">Erreur : session utilisateur introuvable</p>
          <p className="text-slate-600 mb-4">Veuillez rafraîchir ou vous reconnecter.</p>
          <Button onClick={() => update()}>Réessayer</Button>
          <Button variant="outline" className="ml-3" onClick={() => router.push(`/${locale}/auth/login`)}>
            Aller à la connexion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <DashboardShell tone="client" className="mx-auto max-w-7xl">
          <DashboardHero
            tone="client"
            eyebrow="Expédition personnelle"
            title="Mon Espace Client"
            description="Préparez vos colis, suivez les étapes de transit et gardez une vue claire sur vos paiements dans une interface plus éditoriale et plus lisible."
            meta={
              <>
                <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700">Bienvenue, {session.user.name}</Badge>
                <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700">Panier: {cartCount}</Badge>
                <Link href="/faq">
                  <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700 hover:border-sky-200 hover:text-sky-700">
                    <CircleHelp className="mr-1 h-3.5 w-3.5" />Aide / FAQ
                  </Badge>
                </Link>
                {implicitPro.eligible ? (
                  <>
                    <Badge className="bg-violet-600 text-white border-violet-700">Tarif fidele actif</Badge>
                    <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700">
                      Fidelite: {implicitPro.validParcelsCount}/{implicitPro.threshold} colis valides sur {implicitPro.windowDays}j
                    </Badge>
                  </>
                ) : (
                  <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700">
                    Tarif fidele: encore {implicitPro.remaining} colis ({implicitPro.validParcelsCount}/{implicitPro.threshold})
                  </Badge>
                )}
              </>
            }
          />

          <DashboardStatsGrid>
            <DashboardMetricCard tone="client" label="Colis créés" value={stats.created} icon={<Package className="h-5 w-5" />} />
            <DashboardMetricCard tone="client" label="En transit" value={stats.inTransit} icon={<Truck className="h-5 w-5" />} />
            <DashboardMetricCard tone="client" label="Livrés" value={stats.delivered} icon={<CheckCircle className="h-5 w-5" />} />
            <DashboardMetricCard tone="client" label="Total dépensé" value={`${stats.totalSpent} DA`} icon={<CreditCard className="h-5 w-5" />} />
          </DashboardStatsGrid>

          <DashboardPanel tone="client">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className={`${dashboardTabsListClass} grid grid-cols-2 ${implicitPro.eligible ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
                <TabsTrigger value="create" className={`${getDashboardTabsTriggerClass('client')} flex items-center gap-2`}>
              <Plus className="h-4 w-4" />
              Créer un colis
            </TabsTrigger>
                <TabsTrigger value="track" className={`${getDashboardTabsTriggerClass('client')} flex items-center gap-2`}>
              <MapPin className="h-4 w-4" />
              Suivi
            </TabsTrigger>
                <TabsTrigger value="payment" className={`${getDashboardTabsTriggerClass('client')} flex items-center gap-2`}>
              <CreditCard className="h-4 w-4" />
              Panier ({cartCount})
            </TabsTrigger>
                <TabsTrigger value="history" className={`${getDashboardTabsTriggerClass('client')} flex items-center gap-2`}>
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
                <TabsTrigger value="profil" className={`${getDashboardTabsTriggerClass('client')} flex items-center gap-2`}>
              <User className="h-4 w-4" />
              Infos perso
            </TabsTrigger>
                <TabsTrigger value="litiges" className={`${getDashboardTabsTriggerClass('client')} flex items-center gap-2`}>
              <AlertTriangle className="h-4 w-4" />
              Litiges
            </TabsTrigger>
                {implicitPro.eligible && (
                  <TabsTrigger value="bulk-pro" className={`${getDashboardTabsTriggerClass('client')} flex items-center gap-2`}>
                    <Building2 className="h-4 w-4" />
                    Expédition fidelite
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="create">
                <CreateParcelForm
                  userId={session.user.id}
                  onCreated={fetchStats}
                  onGoToHistory={() => { fetchStats(); setActiveTab('history'); }}
                  onGoToCart={() => { fetchStats(); setActiveTab('payment'); }}
                />
              </TabsContent>

              <TabsContent value="track">
                <TrackingTab initialTracking={trackingNumber} setTrackingNumber={setTrackingNumber} />
              </TabsContent>

              <TabsContent value="payment">
                <PaymentTab userId={session.user.id} />
              </TabsContent>

              <TabsContent value="history">
                <ParcelHistory
                  userId={session.user.id}
                  onTrack={(tn: string) => { setTrackingNumber(tn); setActiveTab('track'); }}
                />
              </TabsContent>
              <TabsContent value="profil">
                <ProfilClientTab userId={session.user.id} />
              </TabsContent>
              <TabsContent value="litiges">
                <LitigesTab userId={session.user.id} />
              </TabsContent>
              {implicitPro.eligible && (
                <TabsContent value="bulk-pro">
                  <BulkProCreateForm userId={session.user.id} onCreated={fetchStats} />
                </TabsContent>
              )}
            </Tabs>
          </DashboardPanel>
        </DashboardShell>
      </main>
      <Footer />
    </div>
  );
}

// Tracking Tab
function TrackingTab({ initialTracking, setTrackingNumber }: { initialTracking: string; setTrackingNumber: (v: string) => void }) {
  const { toast } = useToast();
  const [tracking, setTracking] = useState(initialTracking);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!tracking.trim()) return;
    setIsLoading(true);
    setNotFound(false);
    try {
      const response = await fetch(`/api/parcels?tracking=${tracking.trim().toUpperCase()}`);
      if (!response.ok) {
        throw new Error('Erreur de recherche du colis');
      }
      const data = await response.json();
      // API returns array or single object depending on auth context
      const parcel = Array.isArray(data) ? (data[0] ?? null) : (data?.error ? null : data);
      setResult(parcel);
      if (!parcel) {
        setNotFound(true);
        toast({ title: 'Introuvable', description: 'Aucun colis trouvé pour ce numéro', variant: 'destructive' });
      } else {
        toast({ title: 'Colis trouvé', description: `Suivi: ${parcel.trackingNumber}` });
      }
    } catch (error) {
      console.error('Error tracking parcel:', error);
      setNotFound(true);
      toast({ title: 'Erreur', description: 'Impossible de rechercher ce colis', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialTracking) handleSearch();
  }, [initialTracking]);

  const statusOrder = ['CREATED', 'PAID_RELAY', 'DEPOSITED_RELAY', 'RECU_RELAIS', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION', 'LIVRE'];
  const statusRank = useMemo(
    () => Object.fromEntries(statusOrder.map((status, index) => [status, index])) as Record<string, number>,
    []
  );

  const effectiveStatus = useMemo(() => {
    if (!result) return null;
    const historyStatuses = Array.isArray(result.trackingHistory)
      ? result.trackingHistory.map((h: any) => h?.status).filter(Boolean)
      : [];
    const candidates = [result.status, ...historyStatuses].filter(Boolean) as string[];
    if (candidates.length === 0) return result.status;

    let best = result.status as string;
    let bestRank = statusRank[best] ?? -1;

    for (const candidate of candidates) {
      const rank = statusRank[candidate] ?? -1;
      if (rank > bestRank) {
        best = candidate;
        bestRank = rank;
      }
    }
    return best;
  }, [result, statusRank]);

  const currentStatusIndex = effectiveStatus ? statusOrder.indexOf(effectiveStatus) : -1;

  const milestoneSteps = [
    { id: 'CREATED', label: 'Cree' },
    { id: 'DEPOSITED_RELAY', label: 'Depose relais' },
    { id: 'EN_TRANSPORT', label: 'En route' },
    { id: 'ARRIVE_RELAIS_DESTINATION', label: 'Arrive relais' },
    { id: 'LIVRE', label: 'Livre' },
  ] as const;

  const currentMilestoneIndex = milestoneSteps.reduce((best, step, index) => {
    const stepRank = statusRank[step.id] ?? -1;
    return currentStatusIndex >= stepRank ? index : best;
  }, 0);

  const stageLabel = currentStatusIndex >= statusOrder.indexOf('ARRIVE_RELAIS_DESTINATION')
    ? 'Arrivé au relais'
    : currentStatusIndex >= statusOrder.indexOf('EN_TRANSPORT')
      ? 'En transport'
      : 'Créé';

  const currentStatusLabel = PARCEL_STATUS.find((s) => s.id === effectiveStatus)?.label || effectiveStatus;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suivi de colis</CardTitle>
        <CardDescription>Entrez le numéro de suivi pour localiser votre colis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input
            placeholder="SCXXXXXXXXX"
            value={tracking}
            onChange={(e) => { setTracking(e.target.value.toUpperCase()); setTrackingNumber(e.target.value.toUpperCase()); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="font-mono"
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {notFound && (
          <div className="text-center py-8 text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun colis trouvé pour ce numéro de suivi.</p>
            <p className="text-xs mt-2">
              Numéro perdu ou inconnu ? <Link href="/faq" className="text-emerald-600 underline hover:text-emerald-700">Consulter la FAQ</Link>
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Header: tracking + statut */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Numéro de suivi</p>
                  <p className="font-mono font-bold text-xl">{result.trackingNumber}</p>
                </div>
                <Badge className={`${PARCEL_STATUS.find(s => s.id === effectiveStatus)?.color || 'bg-slate-600'} text-white shrink-0`}>
                  {currentStatusLabel}
                </Badge>
              </div>

              {/* Route */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Départ</p>
                  <p className="font-semibold text-sm">{WILAYAS.find(w => w.id === result.villeDepart)?.name || result.villeDepart}</p>
                  {result.relaisDepart?.commerceName && (
                    <p className="text-xs text-slate-400">{result.relaisDepart.commerceName}</p>
                  )}
                </div>
                {currentStatusIndex >= statusOrder.indexOf('ARRIVE_RELAIS_DESTINATION') ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : currentStatusIndex >= statusOrder.indexOf('EN_TRANSPORT') ? (
                  <Truck className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <Truck className="h-5 w-5 text-slate-400 shrink-0" />
                )}
                <div className="flex-1 text-right">
                  <p className="text-xs text-slate-500">Arrivée</p>
                  <p className="font-semibold text-sm">{WILAYAS.find(w => w.id === result.villeArrivee)?.name || result.villeArrivee}</p>
                  {result.relaisArrivee?.commerceName && (
                    <p className="text-xs text-slate-400">{result.relaisArrivee.commerceName}</p>
                  )}
                </div>
              </div>

              {/* Timeline à jalons nommés */}
              <div className="mt-2 grid grid-cols-5 items-start gap-2">
                {milestoneSteps.map((step, index) => {
                  const done = index <= currentMilestoneIndex;
                  const active = index === currentMilestoneIndex;
                  return (
                    <div key={step.id} className="flex flex-col items-center text-center">
                      <div className="w-full flex items-center">
                        <span className={`h-0.5 flex-1 ${index === 0 ? 'opacity-0' : done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        <span
                          className={`h-3.5 w-3.5 rounded-full border-2 ${
                            done
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600'
                          } ${active ? 'ring-2 ring-emerald-200' : ''}`}
                        />
                        <span className={`h-0.5 flex-1 ${index === milestoneSteps.length - 1 ? 'opacity-0' : index < currentMilestoneIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      </div>
                      <span className={`mt-2 text-[11px] ${active ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-center text-xs text-slate-500">
                Etape actuelle: <span className="font-semibold text-slate-700">{stageLabel}</span>
              </div>
            </div>

            {/* Historique réel des événements */}
            {result.trackingHistory && result.trackingHistory.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border rounded-lg p-4">
                <p className="text-sm font-semibold mb-3">Historique des événements</p>
                <div className="space-y-3">
                  {[...result.trackingHistory].reverse().map((h: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                        {i < result.trackingHistory.length - 1 && <span className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 mt-1" style={{minHeight:'16px'}} />}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-sm font-medium">{PARCEL_STATUS.find(s => s.id === h.status)?.label || h.status}</p>
                        {h.notes && <p className="text-xs text-slate-500">{h.notes}</p>}
                        <p className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* QR Code image si disponible */}
            {result.qrCodeImage && (
              <div className="flex flex-col items-center">
                <p className="text-xs text-slate-500 mb-2">QR Code</p>
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <img src={result.qrCodeImage} alt="QR Code" width={120} height={120} className="block" />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Panier Tab - Show parcels created but unpaid
function PaymentTab({ userId }: { userId: string }) {
  const { push } = useRouter();
  const locale = useLocale();
  const [parcels, setParcels] = useState<any[]>([]);
  const [relaisMap, setRelaisMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const [parcelRes, relaisRes] = await Promise.all([
        fetch(`/api/parcels?clientId=${userId}&status=CREATED`),
        fetch('/api/relais?status=APPROVED'),
      ]);
      const parcelPayload = await parcelRes.json();
      const relaisPayload = await relaisRes.json();
      const parcelData = Array.isArray(parcelPayload) ? parcelPayload : [];
      const relaisData = Array.isArray(relaisPayload) ? relaisPayload : [];
      
      // Map relais by ID for quick lookup
      const map = relaisData.reduce((acc: Record<string, any>, r: any) => {
        acc[r.id] = r;
        return acc;
      }, {});
      
      setParcels(parcelData);
      setRelaisMap(map);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Panier de paiement</CardTitle>
        <CardDescription>Colis créés mais non payés, conservés pour paiement ultérieur au relais de départ</CardDescription>
        <CardDescription>Payez en ligne (CIB, Edahabia, Baridi Mob) ou en espèces au relais de départ</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-sky-900">FAQ paiement rapide</p>
              <div className="mt-2 space-y-2 text-sm text-sky-800">
                <p><span className="font-medium">Quand je paie ?</span> Après création du colis, depuis le panier ou au relais de départ selon le mode choisi.</p>
                <p><span className="font-medium">Puis-je payer au relais ?</span> Oui, le panier conserve les colis créés en attente de règlement au relais de dépôt.</p>
              </div>
            </div>
            <Link href="/faq" className="shrink-0 text-sm font-medium text-sky-700 hover:text-sky-900">
              Voir la FAQ
            </Link>
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : parcels.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-slate-600 mb-4">Votre panier est vide (aucun colis créé en attente de paiement)</p>
            <Button variant="outline" onClick={() => push(`/${locale}/dashboard/client?tab=create`)}>
              Créer un nouveau colis
            </Button>
            <p className="text-xs text-slate-400 mt-3">
              Comment ça marche ? <Link href="/faq" className="text-emerald-600 underline hover:text-emerald-700">Voir la FAQ</Link>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {parcels.map((parcel) => {
              const relaisDept = relaisMap[parcel.relaisDepartId];
              return (
                <Card key={parcel.id} className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">N° Suivi</p>
                        <p className="font-mono font-bold text-sm">{parcel.trackingNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Poids</p>
                        <p className="font-semibold">{parcel.weight ? `${parcel.weight} kg` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Itinéraire</p>
                        <p className="text-sm">
                          {WILAYAS.find(w => w.id === parcel.villeDepart)?.name} →{' '}
                          {WILAYAS.find(w => w.id === parcel.villeArrivee)?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Montant</p>
                        <p className="text-lg font-bold text-green-600">{parcel.prixClient.toFixed(2)} DA</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Horaires relais</p>
                        <p className="text-sm">
                          {relaisDept?.openTime && relaisDept?.closeTime 
                            ? `${relaisDept.openTime} - ${relaisDept.closeTime}`
                            : 'Horaires non renseignés'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded p-3 mb-4 border border-blue-100 dark:border-blue-900">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        📍 <span className="font-semibold">Relais de départ:</span> {relaisDept?.commerceName || 'Non disponible'}
                      </p>
                      {relaisDept?.address && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 break-words">
                          {relaisDept.address}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        disabled={payingId === parcel.id}
                        onClick={async () => {
                          setPayingId(parcel.id);
                          try {
                            const res = await fetch('/api/payments', {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ colisId: parcel.id, amount: parcel.prixClient }),
                            });
                            const data = await res.json();
                            if (!res.ok) { toast({ title: 'Erreur', description: data.error, variant: 'destructive' }); return; }
                            push(`/${locale}/payment/checkout?paymentId=${data.paymentId}`);
                          } catch { toast({ title: 'Erreur réseau', variant: 'destructive' }); }
                          finally { setPayingId(null); }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {payingId === parcel.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
                        Payer en ligne
                      </Button>
                      <ParcelEditDialog parcel={parcel} buttonLabel="Modifier" onSaved={fetchData} />
                      <ParcelDeleteButton parcel={parcel} onSaved={fetchData} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Parcel History
function ParcelHistory({ userId, onTrack }: { userId: string; onTrack: (tn: string) => void }) {
  const { toast } = useToast();
  const [colis, setColis] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchColis(); }, [userId]);

  const fetchColis = async () => {
    try {
      const response = await fetch(`/api/parcels?clientId=${userId}`);
      const payload = await response.json();
      setColis(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Error fetching parcels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = filter === 'all' ? colis : colis.filter(c => c.status === filter);

  const printStoredOrLiveLabel = (parcel: any) => {
    try {
      const allStored = JSON.parse(localStorage.getItem(LABEL_STORAGE_KEY) || '{}');
      const saved = allStored[parcel.trackingNumber] || {};

      const villeDepartId = saved.villeDepart || parcel.villeDepart;
      const villeArriveeId = saved.villeArrivee || parcel.villeArrivee;
      const villeDepart = WILAYAS.find(w => w.id === villeDepartId)?.name || villeDepartId || '—';
      const villeArrivee = WILAYAS.find(w => w.id === villeArriveeId)?.name || villeArriveeId || '—';
      const dateCreation = new Date(saved.createdAt || parcel.createdAt || new Date().toISOString()).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const senderFirstName = saved.senderFirstName || '';
      const senderLastName = saved.senderLastName || '';
      const senderPhone = saved.senderPhone || '';
      const recipientFirstName = saved.recipientFirstName || parcel.recipientFirstName || '';
      const recipientLastName = saved.recipientLastName || parcel.recipientLastName || '';
      const recipientPhone = saved.recipientPhone || parcel.recipientPhone || '';

      const departRelayName = saved.relaisDepartName || parcel.relaisDepart?.commerceName || '—';
      const departRelayAddress = saved.relaisDepartAddress || parcel.relaisDepart?.address || '';
      const arriveeRelayName = saved.relaisArriveeName || parcel.relaisArrivee?.commerceName || '—';
      const arriveeRelayAddress = saved.relaisArriveeAddress || parcel.relaisArrivee?.address || '';

      const html = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8" />
  <title>Étiquette - ${parcel.trackingNumber}</title>
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
      <div class="tracking-number">${parcel.trackingNumber}</div>
    </div>
  </div>
  <div class="route-banner">${villeDepart} &rarr; ${villeArrivee}</div>
  <div class="info-grid">
    <div class="info-box sender">
      <div class="info-box-title">&#128228; Expéditeur</div>
      <div class="info-name">${senderLastName} ${senderFirstName}</div>
      <div class="info-phone">&#128241; ${senderPhone}</div>
      <div class="info-city">&#128205; ${villeDepart}</div>
    </div>
    <div class="info-box recipient">
      <div class="info-box-title">&#128229; Destinataire</div>
      <div class="info-name">${recipientLastName} ${recipientFirstName}</div>
      <div class="info-phone">&#128241; ${recipientPhone}</div>
      <div class="info-city">&#128205; ${villeArrivee}</div>
    </div>
  </div>
  <div class="relay-grid">
    <div class="relay-box">
      <div class="relay-box-title">Relais dépôt</div>
      <div class="relay-name">${departRelayName}</div>
      <div class="relay-address">${departRelayAddress}</div>
    </div>
    <div class="relay-box">
      <div class="relay-box-title">Relais destination</div>
      <div class="relay-name">${arriveeRelayName}</div>
      <div class="relay-address">${arriveeRelayAddress}</div>
    </div>
  </div>
  ${(saved.withdrawalCode || parcel.withdrawalCode) ? `
  <div class="withdrawal-box">
    <div class="withdrawal-label">&#128273; Code de retrait destinataire</div>
    <div class="withdrawal-code">${saved.withdrawalCode || parcel.withdrawalCode}</div>
    <div class="withdrawal-note">À communiquer uniquement au destinataire</div>
  </div>` : ''}
  <div class="bottom-row">
    ${(saved.qrCodeImage || parcel.qrCodeImage) ? `
    <div class="qr-block">
      <img src="${saved.qrCodeImage || parcel.qrCodeImage}" alt="QR Code" />
      <div class="qr-label">Scanner au relais</div>
    </div>` : '<div></div>'}
    <div class="meta-block">
      ${(saved.weight || parcel.weight) ? `<p><span class="meta-bold">Poids :</span> ${saved.weight || parcel.weight} kg</p>` : ''}
      ${(saved.description || parcel.description) ? `<p><span class="meta-bold">Contenu :</span> ${saved.description || parcel.description}</p>` : ''}
      <p><span class="meta-bold">Date :</span> ${dateCreation}</p>
      <p><span class="meta-bold">Prix :</span> ${saved.prixClient || parcel.prixClient || ''} DA</p>
    </div>
  </div>
  <div class="instructions">
    &#9888;&#65039; À déposer exclusivement au relais indiqué &bull; Règlement en espèces au dépôt &bull; Conserver ce numéro de suivi
  </div>
</div>
</body></html>`;

      const win = window.open('', '_blank', 'width=900,height=1200');
      if (win) {
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
        } else {
          win.addEventListener('load', triggerPrint, { once: true });
        }
      }
    } catch (error) {
      console.error('Error generating label from history:', error);
      toast({ title: 'Erreur', description: 'Impossible de générer l\'étiquette', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Historique de mes colis</CardTitle>
            <CardDescription>{filtered.length} colis{filter !== 'all' ? ' filtrés' : ''} sur {colis.length}</CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {PARCEL_STATUS.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{colis.length === 0 ? 'Aucun colis pour le moment' : 'Aucun colis pour ce filtre'}</p>
            {colis.length === 0 && (
              <p className="text-xs mt-2">
                <Link href="/faq" className="text-emerald-600 underline hover:text-emerald-700">Comment créer mon premier colis ? → FAQ</Link>
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Suivi</TableHead>
                <TableHead>Trajet</TableHead>
                <TableHead>Poids</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell className="font-mono font-medium text-sm">{c.trackingNumber}</TableCell>
                  <TableCell className="text-sm">
                    {WILAYAS.find(w => w.id === c.villeDepart)?.name} → {WILAYAS.find(w => w.id === c.villeArrivee)?.name}
                  </TableCell>
                  <TableCell>{c.weight ? `${c.weight} kg` : '—'}</TableCell>
                  <TableCell className="font-semibold">{c.prixClient} DA</TableCell>
                  <TableCell>
                    <Badge className={`${PARCEL_STATUS.find(s => s.id === c.status)?.color} text-white text-xs`}>
                      {PARCEL_STATUS.find(s => s.id === c.status)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onTrack(c.trackingNumber)}>
                        <MapPin className="h-3 w-3 mr-1" />Suivre
                      </Button>
                      <ParcelEditDialog parcel={c} buttonLabel="Modifier" onSaved={fetchColis} />
                      <ParcelDeleteButton parcel={c} onSaved={fetchColis} />
                      <Button type="button" size="sm" variant="outline" onClick={() => printStoredOrLiveLabel(c)}>
                        <Printer className="h-3 w-3 mr-1" />Étiquette
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Profil Tab — Client particulier
function ProfilClientTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!form.firstName.trim()) errors.firstName = 'Le prénom est obligatoire';
    if (!form.lastName.trim()) errors.lastName = 'Le nom est obligatoire';
    if (!form.email.trim()) {
      errors.email = 'L\'email est obligatoire';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Format d\'email invalide';
    }
    if (!form.phone.trim()) errors.phone = 'Le téléphone est obligatoire';
    if (!form.address.trim()) errors.address = 'L\'adresse est obligatoire';

    const shouldValidatePassword = passwordTouched || confirmTouched;

    if (shouldValidatePassword) {
      if (!passwordForm.password && passwordForm.confirm) {
        errors.password = 'Saisissez un mot de passe avant la confirmation';
      }
      if (passwordForm.password) {
        if (passwordForm.password.length < 8) {
          errors.password = 'Le mot de passe doit contenir au moins 8 caractères';
        }
        if (!passwordForm.confirm) {
          errors.confirm = 'Veuillez confirmer le mot de passe';
        } else if (passwordForm.password !== passwordForm.confirm) {
          errors.confirm = 'Les mots de passe ne correspondent pas';
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/users/${userId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUserData(data);
      setForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
      });
      setPasswordForm({ password: '', confirm: '' });
      setPasswordTouched(false);
      setConfirmTouched(false);
      setFormErrors({});
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({ title: 'Erreur', description: 'Veuillez corriger les champs obligatoires', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        address: form.address,
      };
      if (passwordTouched && passwordForm.password) payload.password = passwordForm.password;
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({ title: 'Profil mis à jour' });
        setIsEditing(false);
        setFormErrors({});
        setPasswordForm({ password: '', confirm: '' });
        setPasswordTouched(false);
        setConfirmTouched(false);
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'Erreur', description: err.error || 'Impossible de sauvegarder', variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-600" />
                Mon profil
              </CardTitle>
              <CardDescription>Vos informations personnelles</CardDescription>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 border rounded px-3 py-1.5 transition-colors"
              >
                <Pencil className="h-4 w-4" /> Modifier
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input
                    value={form.firstName}
                    onChange={e => {
                      setForm({ ...form, firstName: e.target.value });
                      if (formErrors.firstName) setFormErrors((prev) => ({ ...prev, firstName: '' }));
                    }}
                    aria-invalid={Boolean(formErrors.firstName)}
                    className={formErrors.firstName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {formErrors.firstName && <p className="text-xs text-red-600">{formErrors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input
                    value={form.lastName}
                    onChange={e => {
                      setForm({ ...form, lastName: e.target.value });
                      if (formErrors.lastName) setFormErrors((prev) => ({ ...prev, lastName: '' }));
                    }}
                    aria-invalid={Boolean(formErrors.lastName)}
                    className={formErrors.lastName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {formErrors.lastName && <p className="text-xs text-red-600">{formErrors.lastName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input
                    value={form.phone}
                    onChange={e => {
                      setForm({ ...form, phone: e.target.value });
                      if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    placeholder="Ex: 0555123456"
                    aria-invalid={Boolean(formErrors.phone)}
                    className={formErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {formErrors.phone && <p className="text-xs text-red-600">{formErrors.phone}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => {
                      setForm({ ...form, email: e.target.value });
                      if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    aria-invalid={Boolean(formErrors.email)}
                    className={formErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {formErrors.email && <p className="text-xs text-red-600">{formErrors.email}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Adresse *</Label>
                  <Input
                    value={form.address}
                    onChange={e => {
                      setForm({ ...form, address: e.target.value });
                      if (formErrors.address) setFormErrors((prev) => ({ ...prev, address: '' }));
                    }}
                    placeholder="Ex: 12 Rue Didouche Mourad"
                    aria-invalid={Boolean(formErrors.address)}
                    className={formErrors.address ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {formErrors.address && <p className="text-xs text-red-600">{formErrors.address}</p>}
                </div>
              </div>
              <hr />
              <p className="text-sm font-medium text-slate-600">Changer de mot de passe (optionnel)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={passwordForm.password}
                    onChange={e => {
                      setPasswordForm({ ...passwordForm, password: e.target.value });
                      setPasswordTouched(true);
                      if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    aria-invalid={Boolean(formErrors.password)}
                    className={formErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {formErrors.password && <p className="text-xs text-red-600">{formErrors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Confirmer le mot de passe</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={e => {
                      setPasswordForm({ ...passwordForm, confirm: e.target.value });
                      setConfirmTouched(true);
                      if (formErrors.confirm) setFormErrors((prev) => ({ ...prev, confirm: '' }));
                    }}
                    aria-invalid={Boolean(formErrors.confirm)}
                    className={formErrors.confirm ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {formErrors.confirm && <p className="text-xs text-red-600">{formErrors.confirm}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-60 transition-colors"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setFormErrors({});
                    setForm({
                      firstName: userData?.firstName || '',
                      lastName: userData?.lastName || '',
                      email: userData?.email || '',
                      phone: userData?.phone || '',
                      address: userData?.address || '',
                    });
                    setPasswordForm({ password: '', confirm: '' });
                    setPasswordTouched(false);
                    setConfirmTouched(false);
                    setFormErrors({});
                  }}
                  className="px-4 py-2 text-sm border rounded hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
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
                <p className="font-medium">{userData?.phone || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Type de compte</p>
                <span className="inline-flex items-center gap-1 text-sm border rounded px-2 py-0.5 text-slate-600">Client particulier</span>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Adresse</p>
                <p className="font-medium">{userData?.address || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Membre depuis</p>
                <p className="text-sm text-slate-600">
                  {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LitigesTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [parcels, setParcels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedColisId, setSelectedColisId] = useState('');
  const [reason, setReason] = useState('OTHER');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const REASONS: Record<string, string> = {
    LOST: 'Colis perdu',
    DAMAGED: 'Colis endommagé',
    DELAYED: 'Retard excessif',
    WRONG_ADDRESS: 'Mauvaise adresse',
    OTHER: 'Autre problème',
  };

  useEffect(() => {
    const fetchParcels = async () => {
      try {
        const res = await fetch(`/api/parcels?clientId=${userId}`);
        const data = await res.json();
        setParcels(Array.isArray(data) ? data : []);
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    };
    fetchParcels();
  }, [userId]);

  const disputedParcels = parcels.filter((p) => p.status === 'EN_DISPUTE');
  const eligibleParcels = parcels.filter((p) =>
    ['PAID', 'DEPOSITED_RELAY', 'RECU_RELAIS', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION'].includes(p.status)
  );

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColisId || !description.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colisId: selectedColisId, reason, description }),
      });
      if (res.ok) {
        toast({ title: 'Litige ouvert', description: 'Notre équipe va examiner votre demande.' });
        setShowForm(false);
        setDescription('');
        setSelectedColisId('');
        // Refresh parcels
        const updated = await fetch(`/api/parcels?clientId=${userId}`);
        const updatedData = await updated.json();
        setParcels(Array.isArray(updatedData) ? updatedData : []);
      } else {
        toast({ title: 'Erreur', description: 'Impossible d\'ouvrir le litige.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'ouvrir le litige.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Litiges &amp; Réclamations</h2>
          <p className="text-sm text-slate-500">Signalez un problème avec l'un de vos colis</p>
        </div>
        {!showForm && eligibleParcels.length > 0 && (
          <Button onClick={() => setShowForm(true)} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Ouvrir un litige
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Nouveau litige</CardTitle>
            <CardDescription>Sélectionnez le colis concerné et décrivez le problème</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitDispute} className="space-y-4">
              <div className="space-y-2">
                <Label>Colis concerné</Label>
                <Select value={selectedColisId} onValueChange={setSelectedColisId} required>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un colis" /></SelectTrigger>
                  <SelectContent>
                    {eligibleParcels.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.trackingNumber} — {p.villeDepart} → {p.villeArrivee}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motif</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez le problème en détail..."
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting || !selectedColisId || !description.trim()} className="bg-red-600 hover:bg-red-700">
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Soumettre
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {disputedParcels.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun litige ouvert</h3>
            <p className="text-slate-500 text-sm">Tous vos colis se portent bien.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {disputedParcels.map((p) => (
            <Card key={p.id} className="border-red-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold">{p.trackingNumber}</p>
                    <p className="text-sm text-slate-500">{p.villeDepart} → {p.villeArrivee}</p>
                  </div>
                  <Badge className="bg-red-100 text-red-700 border-red-300">En litige</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BulkProCreateForm — Expedition fidelite (eligibilite implicite)
// ─────────────────────────────────────────────────────────────────────────────
interface BulkRow {
  id: string;
  weight: string;
  description: string;
  senderFirstName: string;
  senderLastName: string;
  senderPhone: string;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  recipientEmail: string;
}

function newRow(): BulkRow {
  return {
    id: Math.random().toString(36).slice(2),
    weight: '',
    description: '',
    senderFirstName: '',
    senderLastName: '',
    senderPhone: '',
    recipientFirstName: '',
    recipientLastName: '',
    recipientPhone: '',
    recipientEmail: '',
  };
}

function BulkProCreateForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const { toast } = useToast();
  const [relais, setRelais] = useState<any[]>([]);
  const [lignesActives, setLignesActives] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [shared, setShared] = useState({
    villeDepart: '',
    villeArrivee: '',
    relaisDepartId: '',
    relaisArriveeId: '',
  });
  const [rows, setRows] = useState<BulkRow[]>([newRow()]);

  useEffect(() => {
    fetch('/api/relais?status=APPROVED').then(r => r.json()).then(setRelais).catch(() => {});
    fetch('/api/lignes').then(r => r.json()).then(d => { if (Array.isArray(d)) setLignesActives(d.filter((l: any) => l.isActive !== false)); }).catch(() => {});
  }, []);

  const activeRelayCityIds = useMemo(() => relais.filter((r: any) => r.status === 'APPROVED' && r.operationalStatus === 'ACTIF').map((r: any) => r.ville), [relais]);

  const availableDepartVilles = useMemo(() => {
    if (activeRelayCityIds.length === 0) return [];
    if (lignesActives.length === 0) return WILAYAS.filter(w => activeRelayCityIds.includes(w.id));
    const ids = new Set(lignesActives.flatMap((l: any) => [l.villeDepart, ...(l.villesEtapes || []), l.villeArrivee]));
    return WILAYAS.filter(w => ids.has(w.id) && activeRelayCityIds.includes(w.id));
  }, [activeRelayCityIds, lignesActives]);

  const availableArriveeVilles = useMemo(() => {
    if (activeRelayCityIds.length === 0) return [];
    if (lignesActives.length === 0) return WILAYAS.filter(w => w.id !== shared.villeDepart && activeRelayCityIds.includes(w.id));
    const ids = new Set(lignesActives.flatMap((l: any) => [l.villeDepart, ...(l.villesEtapes || []), l.villeArrivee]));
    return WILAYAS.filter(w => w.id !== shared.villeDepart && ids.has(w.id) && activeRelayCityIds.includes(w.id));
  }, [activeRelayCityIds, lignesActives, shared.villeDepart]);

  const relaisDepart = useMemo(() => relais.filter((r: any) => r.status === 'APPROVED' && r.operationalStatus === 'ACTIF' && r.ville === shared.villeDepart), [relais, shared.villeDepart]);
  const relaisArrivee = useMemo(() => relais.filter((r: any) => r.status === 'APPROVED' && r.operationalStatus === 'ACTIF' && r.ville === shared.villeArrivee), [relais, shared.villeArrivee]);

  const count = rows.length;
  const discountRate = getProBatchDiscountRate(count);
  const activeTier = getProBatchDiscountTier(count);

  const updateRow = (id: string, field: keyof BulkRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    if (rows.length < 50) setRows(prev => [...prev, newRow()]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSubmit = async () => {
    if (!shared.villeDepart || !shared.villeArrivee || !shared.relaisDepartId || !shared.relaisArriveeId) {
      toast({ title: 'Champs manquants', description: 'Remplissez les informations communes (ville + relais)', variant: 'destructive' });
      return;
    }
    const incomplete = rows.find(r => !r.weight || !r.senderFirstName || !r.senderLastName || !r.senderPhone || !r.recipientFirstName || !r.recipientLastName || !r.recipientPhone);
    if (incomplete) {
      toast({ title: 'Colis incomplet', description: 'Tous les champs expéditeur/destinataire sont requis', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/parcels/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: userId,
          ...shared,
          parcels: rows.map(r => ({
            weight: parseFloat(r.weight),
            description: r.description || 'Colis',
            senderFirstName: r.senderFirstName,
            senderLastName: r.senderLastName,
            senderPhone: r.senderPhone,
            recipientFirstName: r.recipientFirstName,
            recipientLastName: r.recipientLastName,
            recipientPhone: r.recipientPhone,
            recipientEmail: r.recipientEmail || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
      setResults(data.parcels);
      onCreated();
      toast({ title: `${data.count} colis créés`, description: data.discountPercent > 0 ? `Remise fidelite appliquee : -${data.discountPercent}%` : undefined });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintAll = (parcels: any[]) => {
    const labelsHtml = parcels.map(p => `
      <div style="page-break-after:always;padding:24px;font-family:sans-serif;border:2px solid #222;width:400px;margin:auto">
        <h2 style="text-align:center;font-size:18px;margin-bottom:8px">SwiftColis — Étiquette</h2>
        <p><strong>N° suivi :</strong> ${p.trackingNumber}</p>
        <p><strong>De :</strong> ${p.villeDepart}</p>
        <p><strong>À :</strong> ${p.villeArrivee}</p>
        <p><strong>Poids :</strong> ${p.poids ?? p.weight} kg</p>
        <p><strong>Prix :</strong> ${p.prixClient ?? p.clientPrice} DA</p>
        <p><strong>Description :</strong> ${p.description}</p>
      </div>
    `).join('');
    const win = window.open('', '_blank');
    if (!win) { toast({ title: 'Fenêtre bloquée', description: 'Autorisez les popups pour imprimer', variant: 'destructive' }); return; }
    win.document.write(`<html><head><title>Etiquettes fidelite</title><style>body{margin:0}</style></head><body>${labelsHtml}</body></html>`);
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
    } else {
      win.addEventListener('load', triggerPrint, { once: true });
    }
  };

  if (results) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{results.length} colis créés avec succès</h3>
          <div className="flex gap-2">
            <Button onClick={() => handlePrintAll(results)} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Imprimer toutes les étiquettes
            </Button>
            <Button onClick={() => { setResults(null); setRows([newRow()]); setShared({ villeDepart: '', villeArrivee: '', relaisDepartId: '', relaisArriveeId: '' }); }} size="sm">
              Nouvelle expédition
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° suivi</TableHead>
                <TableHead>Expéditeur</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Poids</TableHead>
                <TableHead>Prix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.trackingNumber}</TableCell>
                  <TableCell>{p.senderFirstName} {p.senderLastName}</TableCell>
                  <TableCell>{p.recipientFirstName} {p.recipientLastName}</TableCell>
                  <TableCell>{p.poids ?? p.weight} kg</TableCell>
                  <TableCell className="font-semibold">{p.prixClient ?? p.clientPrice} DA</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Discount preview */}
      <div className="rounded-lg bg-violet-50 border border-violet-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-600" />
            <span className="font-semibold text-violet-800">Tarifs degressifs fidelite</span>
          </div>
          <span className="text-sm font-medium text-violet-700">{count} colis — {discountRate > 0 ? `-${Math.round(discountRate * 100)}%` : 'Pas de remise'}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PRO_DISCOUNT_TIERS.map(tier => (
            <span key={tier.minCount} className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${activeTier?.minCount === tier.minCount ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border'}`}>
              {tier.label}
            </span>
          ))}
        </div>
      </div>

      {/* Shared fields */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium text-slate-700 mb-4">Informations communes</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ville de départ</Label>
            <Select value={shared.villeDepart} onValueChange={v => setShared(s => ({ ...s, villeDepart: v, relaisDepartId: '' }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{availableDepartVilles.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Relais de dépôt</Label>
            <Select value={shared.relaisDepartId} onValueChange={v => setShared(s => ({ ...s, relaisDepartId: v }))} disabled={!shared.villeDepart}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{relaisDepart.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.commerceName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ville d'arrivée</Label>
            <Select value={shared.villeArrivee} onValueChange={v => setShared(s => ({ ...s, villeArrivee: v, relaisArriveeId: '' }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{availableArriveeVilles.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Relais de livraison</Label>
            <Select value={shared.relaisArriveeId} onValueChange={v => setShared(s => ({ ...s, relaisArriveeId: v }))} disabled={!shared.villeArrivee}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{relaisArrivee.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.commerceName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
          <span className="font-medium text-slate-700">Colis ({count}/50)</span>
          <Button size="sm" variant="outline" onClick={addRow} disabled={rows.length >= 50}>
            <Plus className="h-4 w-4 mr-1" />Ajouter un colis
          </Button>
        </div>
        <div className="divide-y">
          {rows.map((row, idx) => (
            <div key={row.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Colis #{idx + 1}</span>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Poids (kg)</Label>
                  <Input type="number" min="0.1" step="0.1" value={row.weight} onChange={e => updateRow(row.id, 'weight', e.target.value)} placeholder="0.5" className="h-9" />
                </div>
                <div className="space-y-1 col-span-1 sm:col-span-3">
                  <Label className="text-xs">Description</Label>
                  <Input value={row.description} onChange={e => updateRow(row.id, 'description', e.target.value)} placeholder="Contenu du colis" className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 bg-slate-50 rounded p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expéditeur</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={row.senderLastName} onChange={e => updateRow(row.id, 'senderLastName', e.target.value)} placeholder="Nom" className="h-8 text-xs" />
                    <Input value={row.senderFirstName} onChange={e => updateRow(row.id, 'senderFirstName', e.target.value)} placeholder="Prénom" className="h-8 text-xs" />
                  </div>
                  <Input value={row.senderPhone} onChange={e => updateRow(row.id, 'senderPhone', e.target.value)} placeholder="Téléphone" className="h-8 text-xs" />
                </div>
                <div className="space-y-2 bg-slate-50 rounded p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Destinataire</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={row.recipientLastName} onChange={e => updateRow(row.id, 'recipientLastName', e.target.value)} placeholder="Nom" className="h-8 text-xs" />
                    <Input value={row.recipientFirstName} onChange={e => updateRow(row.id, 'recipientFirstName', e.target.value)} placeholder="Prénom" className="h-8 text-xs" />
                  </div>
                  <Input value={row.recipientPhone} onChange={e => updateRow(row.id, 'recipientPhone', e.target.value)} placeholder="Téléphone" className="h-8 text-xs" />
                  <Input type="email" value={row.recipientEmail} onChange={e => updateRow(row.id, 'recipientEmail', e.target.value)} placeholder="Email (optionnel)" className="h-8 text-xs" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isLoading} className="bg-violet-600 hover:bg-violet-700 text-white min-w-40">
          {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Création...</> : <><Building2 className="h-4 w-4 mr-2" />Créer {count} colis</>}
        </Button>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );
}

export default function ClientDashboard() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ClientDashboardContent />
    </Suspense>
  );
}
