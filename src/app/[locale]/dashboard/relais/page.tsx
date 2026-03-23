'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { WILAYAS, PARCEL_STATUS, RELAIS_STATUS, DEFAULT_RELAY_COMMISSION, RELAY_CASH_ALERT_THRESHOLD } from '@/lib/constants';
import { Store, Package, QrCode, DollarSign, Loader2, CheckCircle, Clock, Scan, ArrowDownToLine, ArrowUpFromLine, Settings, BarChart3, AlertCircle, Save, AlertTriangle, CreditCard, History, BanknoteIcon } from 'lucide-react';
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
  const [cashInfo, setCashInfo] = useState({ cashCollected: 0, cashReversed: 0, balance: 0, totalCommissions: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    }
  }, [status, router, locale]);

  const fetchRelaisInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/relais?userId=${session?.user?.id}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const relais = data[0];
        console.log('[Relais Dashboard] Info relais chargée:', { id: relais.id, name: relais.commerceName });

        if (!relais.commerceName?.trim() || !relais.address?.trim() || !relais.ville?.trim()) {
          router.push(`/${locale}/complete-profile/relais`);
          return;
        }

        setRelaisInfo(relais);
        console.log('[Relais Dashboard] State relaisInfo mise à jour');
        
        // Fetch stats and cash in parallel
        const [statsRes, cashRes] = await Promise.all([
          fetch(`/api/relais/${relais.id}/stats`).catch(() => null),
          fetch(`/api/relais-cash?relaisId=${relais.id}`).catch(() => null),
        ]);
        if (statsRes?.ok) setStats(await statsRes.json());
        if (cashRes?.ok) setCashInfo(await cashRes.json());
      } else {
        console.warn('[Relais Dashboard] Aucun relais trouvé pour cet utilisateur');
        router.push(`/${locale}/complete-profile/relais`);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, locale, router]);

  // Fetch relais info when session is ready
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      if (session.user.role !== 'RELAIS') {
        const paths: Record<string, string> = {
          'ADMIN': `/${locale}/dashboard/admin`,
          'TRANSPORTER': `/${locale}/dashboard/transporter`,
          'CLIENT': `/${locale}/dashboard/client`,
        };
        window.location.href = paths[session.user.role] || `/${locale}/dashboard/client`;
        return;
      }
      fetchRelaisInfo();
    }
  }, [status, session, locale, fetchRelaisInfo]);

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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Espace Point Relais</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Store className="h-4 w-4" />
              {relaisInfo?.commerceName || session.user.name}
              {relaisInfo && (
                <Badge className={`${RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.color} text-white ml-2`}>
                  {RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.label}
                </Badge>
              )}
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {relaisInfo?.status === 'PENDING' && (
          <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Clock className="h-6 w-6 text-orange-600" />
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-400">Inscription en attente de validation</p>
                  <p className="text-sm text-orange-600">Votre demande est en cours d'examen par l'administrateur</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {relaisInfo?.status === 'REJECTED' && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-700">Inscription refusée</p>
                  <p className="text-sm text-red-600">Veuillez contacter le support pour plus d'informations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {cashInfo.balance >= RELAY_CASH_ALERT_THRESHOLD && (
          <Card className="mb-6 border-red-300 bg-red-50 dark:bg-red-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-700">Solde cash élevé — reversal requis</p>
                  <p className="text-sm text-red-600">Vous détenez {cashInfo.balance.toFixed(0)} DA. Vous devez reverser la somme à la plateforme.</p>
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
              <p className="text-xs text-slate-500">colis à traiter</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reçus / Déposés</CardTitle>
              <ArrowDownToLine className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.received}</div>
              <p className="text-xs text-slate-500">total reçus</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash en main</CardTitle>
              <BanknoteIcon className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${cashInfo.balance >= RELAY_CASH_ALERT_THRESHOLD ? 'text-red-600' : 'text-emerald-600'}`}>
                {cashInfo.balance.toFixed(0)} DA
              </div>
              <p className="text-xs text-slate-500">à reverser</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commissions</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{cashInfo.totalCommissions.toFixed(0)} DA</div>
              <p className="text-xs text-slate-500">total gagné</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Synthèse colis</CardTitle>
            <CardDescription>Vue agrégée cohérente avec les autres dashboards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Créés</p>
                  <Package className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-2xl font-bold mt-1">{stats.pending}</p>
              </div>
              <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600 dark:text-slate-400">En transit</p>
                  <ArrowDownToLine className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-2xl font-bold mt-1">{stats.received}</p>
              </div>
              <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Livrés</p>
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold mt-1">{stats.handedOver}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1 hidden sm:inline" />Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-1 hidden sm:inline" />Scanner QR</TabsTrigger>
            <TabsTrigger value="cash"><CreditCard className="h-4 w-4 mr-1 hidden sm:inline" />Caisse</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1 hidden sm:inline" />Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab relaisInfo={relaisInfo} setActiveTab={setActiveTab} cashInfo={cashInfo} />
          </TabsContent>
          <TabsContent value="scan">
            <ScanTab relaisId={relaisInfo?.id} userId={session.user.id} onRefresh={fetchRelaisInfo} />
          </TabsContent>
          <TabsContent value="cash">
            <CashTab relaisId={relaisInfo?.id} cashInfo={cashInfo} userId={session.user.id} onRefresh={fetchRelaisInfo} />
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
function OverviewTab({ relaisInfo, setActiveTab, cashInfo }: { relaisInfo: any; setActiveTab: (tab: string) => void; cashInfo: any }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Information du relais</CardTitle></CardHeader>
        <CardContent>
          {relaisInfo ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Commerce</span><span className="font-semibold">{relaisInfo.commerceName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Adresse</span><span>{relaisInfo.address}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ville</span><span>{WILAYAS.find(w => w.id === relaisInfo.ville)?.name || relaisInfo.ville}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Statut</span>
                <Badge className={`${RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.color} text-white`}>
                  {RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.label}
                </Badge>
              </div>
            </div>
          ) : <p className="text-slate-500 text-center py-4">Chargement...</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Résumé financier</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Total encaissé</span><span className="font-bold">{cashInfo.cashCollected.toFixed(0)} DA</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total reversé</span><span className="font-bold text-blue-600">{cashInfo.cashReversed.toFixed(0)} DA</span></div>
          <div className="flex justify-between border-t pt-2"><span className="font-semibold">Solde à reverser</span><span className="font-bold text-orange-600">{cashInfo.balance.toFixed(0)} DA</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Commissions relais</span><span className="font-bold text-emerald-600">{cashInfo.totalCommissions.toFixed(0)} DA</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commissions par format</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionPetit || DEFAULT_RELAY_COMMISSION.PETIT} DA</p>
              <p className="text-xs text-slate-500 mt-1">Petit</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionMoyen || DEFAULT_RELAY_COMMISSION.MOYEN} DA</p>
              <p className="text-xs text-slate-500 mt-1">Moyen</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionGros || DEFAULT_RELAY_COMMISSION.GROS} DA</p>
              <p className="text-xs text-slate-500 mt-1">Gros</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Actions rapides</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => setActiveTab('scan')}>
              <QrCode className="h-5 w-5 mr-3 text-emerald-600" />
              <div className="text-left"><p className="font-semibold">Scanner un colis</p><p className="text-xs text-slate-500">Valider paiement ou dépôt</p></div>
            </Button>
            <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => setActiveTab('cash')}>
              <CreditCard className="h-5 w-5 mr-3 text-blue-600" />
              <div className="text-left"><p className="font-semibold">Gérer la caisse</p><p className="text-xs text-slate-500">Voir et reverser le cash</p></div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Scan Tab — MVP workflow
function ScanTab({ relaisId, userId, onRefresh }: { relaisId: string | undefined; userId: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [tracking, setTracking] = useState('');
  const [parcel, setParcel] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deliveryCheck, setDeliveryCheck] = useState({
    recipientFirstName: '',
    recipientLastName: '',
    recipientPhone: '',
    withdrawalCode: '',
  });

  const handleSearch = async () => {
    if (!tracking.trim()) return;
    setIsSearching(true);
    setParcel(null);
    try {
      const res = await fetch(`/api/qr/${tracking.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Introuvable', description: data.error || 'Colis non trouvé', variant: 'destructive' });
      } else {
        setParcel(data);
        setDeliveryCheck({
          recipientFirstName: '',
          recipientLastName: '',
          recipientPhone: '',
          withdrawalCode: '',
        });
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!parcel || !relaisId) return;

    if (action === 'deliver') {
      if (
        !deliveryCheck.recipientFirstName.trim() ||
        !deliveryCheck.recipientLastName.trim() ||
        !deliveryCheck.recipientPhone.trim() ||
        !deliveryCheck.withdrawalCode.trim()
      ) {
        toast({
          title: 'Vérification requise',
          description: 'Nom, prénom, téléphone et code de retrait sont obligatoires',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/qr/${parcel.trackingNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          relaisId,
          userId,
          ...(action === 'deliver' ? deliveryCheck : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Succès', description: data.message });
        setParcel((prev: any) => ({ ...prev, status: data.parcel?.status ?? prev.status }));
        onRefresh();
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const currentStatus = parcel?.status;
  const isDepRelay = parcel?.relaisDepart?.id === relaisId;
  const isArrRelay = parcel?.relaisArrivee?.id === relaisId;
  const statusInfo = PARCEL_STATUS.find(s => s.id === currentStatus);

  type ActionDef = { action: string; label: string; description: string; color: string; icon: React.ComponentType<{ className?: string }> };
  const availableActions: ActionDef[] = [];

  if (parcel) {
    if (currentStatus === 'CREATED' && isDepRelay) {
      availableActions.push({
        action: 'validate_payment',
        label: 'Valider le paiement cash',
        description: `Encaisser ${parcel.prixClient ?? '—'} DA du client`,
        color: 'bg-blue-600 hover:bg-blue-700',
        icon: BanknoteIcon,
      });
    }
    if (currentStatus === 'PAID_RELAY' && isDepRelay) {
      availableActions.push({
        action: 'deposit',
        label: 'Confirmer le dépôt du colis',
        description: 'Le colis est physiquement remis au relais',
        color: 'bg-yellow-600 hover:bg-yellow-700',
        icon: ArrowDownToLine,
      });
    }
    if (currentStatus === 'ARRIVE_RELAIS_DESTINATION' && isArrRelay) {
      availableActions.push({
        action: 'deliver',
        label: 'Remettre au destinataire',
        description: 'Confirmer que le client a récupéré son colis',
        color: 'bg-emerald-600 hover:bg-emerald-700',
        icon: CheckCircle,
      });
    }
  }

  const STATUS_FLOW = ['CREATED', 'PAID_RELAY', 'DEPOSITED_RELAY', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION', 'LIVRE'];
  const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Créé', PAID_RELAY: 'Payé', DEPOSITED_RELAY: 'Déposé',
    EN_TRANSPORT: 'Transport', ARRIVE_RELAIS_DESTINATION: 'Arrivé', LIVRE: 'Livré',
  };

  const [receptionTracking, setReceptionTracking] = useState('');
  const [receptionParcel, setReceptionParcel] = useState<any>(null);
  const [isReceptionSearching, setIsReceptionSearching] = useState(false);
  const [isReceptionProcessing, setIsReceptionProcessing] = useState(false);

  const handleReceptionSearch = async () => {
    if (!receptionTracking.trim()) return;
    setIsReceptionSearching(true);
    setReceptionParcel(null);
    try {
      const res = await fetch(`/api/qr/${receptionTracking.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Introuvable', description: data.error || 'Colis non trouvé', variant: 'destructive' });
      } else {
        setReceptionParcel(data);
        toast({ title: 'Colis trouvé', description: `Suivi: ${data.trackingNumber}` });
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' });
    } finally {
      setIsReceptionSearching(false);
    }
  };

  const handleValidateReceptionPayment = async () => {
    if (!receptionParcel) return;
    if (!relaisId) {
      toast({ title: 'Erreur', description: 'ID relais non trouvé. Rechargez la page.', variant: 'destructive' });
      return;
    }
    if (receptionParcel.relaisDepart?.id !== relaisId) {
      toast({
        title: 'Relais incorrect',
        description: `Ce colis doit être traité au relais de départ: ${receptionParcel.relaisDepart?.commerceName ?? 'inconnu'}`,
        variant: 'destructive',
      });
      return;
    }
    
    // Step 1: Validate payment
    setIsReceptionProcessing(true);
    try {
      console.log('[Reception] Étape 1: Validation paiement cash', {
        tracking: receptionParcel.trackingNumber,
        prixClient: receptionParcel.prixClient,
        relaisId,
        parcelRelaisDeparId: receptionParcel.relaisDepart?.id,
        parcelRelaisDeparName: receptionParcel.relaisDepart?.commerceName,
      });

      const res1 = await fetch(`/api/qr/${receptionParcel.trackingNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate_payment',
          relaisId,
          userId,
        }),
      });
      
      const data1 = await res1.json();
      console.log('[Reception] Réponse étape 1:', { status: res1.status, data: data1 });
      
      if (!res1.ok) {
        toast({ title: 'Erreur paiement', description: data1.error || 'Impossibilité de valider le paiement', variant: 'destructive' });
        setIsReceptionProcessing(false);
        return;
      }

      // Step 2: Deposit — only if payment validation succeeded
      console.log('[Reception] Étape 2: Dépôt du colis');
      
      const res2 = await fetch(`/api/qr/${receptionParcel.trackingNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deposit',
          relaisId,
          userId,
        }),
      });
      
      const data2 = await res2.json();
      console.log('[Reception] Réponse étape 2:', { status: res2.status, data: data2 });
      
      if (!res2.ok) {
        toast({ 
          title: 'Avertissement', 
          description: `Paiement validé mais dépôt échoué: ${data2.error}. Relais peut réessayer le dépôt.`,
          variant: 'destructive'
        });
        // Still refresh since payment was recorded
        setReceptionTracking('');
        setReceptionParcel(null);
        onRefresh();
      } else {
        toast({ 
          title: 'Succès', 
          description: `✓ Paiement encaissé + Dépôt enregistré (${receptionParcel.trackingNumber})`,
        });
        setReceptionTracking('');
        setReceptionParcel(null);
        onRefresh();
      }
    } catch (err) {
      console.error('[Reception] Erreur:', err);
      toast({ title: 'Erreur réseau', description: String(err), variant: 'destructive' });
    } finally {
      setIsReceptionProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Reception & Payment Section */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-700">
        <CardHeader className="bg-emerald-50 dark:bg-emerald-950">
          <CardTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
            <BanknoteIcon className="h-5 w-5" />
            Réception du Colis + Paiement Espèces
          </CardTitle>
          <CardDescription className="text-emerald-700 dark:text-emerald-300">
            Validez la réception et le paiement en espèces du client
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="Numéro de suivi du client (ex: SCXXXXXXXXX)"
              value={receptionTracking}
              onChange={(e) => setReceptionTracking(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleReceptionSearch()}
              className="font-mono"
            />
            <Button 
              onClick={handleReceptionSearch} 
              disabled={isReceptionSearching || !receptionTracking.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isReceptionSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4 mr-2" />}
              Chercher
            </Button>
          </div>

          {receptionParcel && (
            <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800 space-y-3">
              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Numéro de suivi:</span>
                  <span className="font-mono font-bold">{receptionParcel.trackingNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Client:</span>
                  <span className="font-semibold">{receptionParcel.client?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Format:</span>
                  <Badge variant="outline">{receptionParcel.format}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">De / Pour:</span>
                  <span className="text-sm">{receptionParcel.villeDepart} → {receptionParcel.villeArrivee}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Montant à encaisser:</span>
                  <span className="text-2xl font-bold text-emerald-600">{receptionParcel.prixClient?.toFixed(0) ?? '—'} DA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Statut:</span>
                  <Badge className={`${PARCEL_STATUS.find(s => s.id === receptionParcel.status)?.color} text-white`}>
                    {PARCEL_STATUS.find(s => s.id === receptionParcel.status)?.label}
                  </Badge>
                </div>
              </div>

              {receptionParcel.status === 'CREATED' && receptionParcel.relaisDepart?.id === relaisId && (
                <Button 
                  onClick={handleValidateReceptionPayment} 
                  disabled={isReceptionProcessing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base"
                >
                  {isReceptionProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Valider Réception + Paiement
                    </>
                  )}
                </Button>
              )}
              {receptionParcel.status === 'CREATED' && receptionParcel.relaisDepart?.id !== relaisId && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded text-sm text-amber-700 dark:text-amber-300">
                  Ce colis ne peut pas être encaissé dans ce point relais. Relais de départ attendu :
                  {' '}
                  <strong>{receptionParcel.relaisDepart?.commerceName ?? 'inconnu'}</strong>.
                </div>
              )}
              {receptionParcel.status !== 'CREATED' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded text-sm text-blue-700 dark:text-blue-300">
                  Ce colis ne peut pas être validé à cette étape (Statut: {PARCEL_STATUS.find(s => s.id === receptionParcel.status)?.label})
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scan className="h-5 w-5" />Scanner / Rechercher un colis</CardTitle>
          <CardDescription>Entrez le numéro de suivi ou scannez le QR code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Numéro de suivi (ex: SCXXXXXXXXX)"
              value={tracking}
              onChange={(e) => setTracking(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="font-mono"
            />
            <Button onClick={handleSearch} disabled={isSearching || !tracking.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Rechercher
            </Button>
          </div>

          {parcel && (
            <Card className="bg-slate-50 dark:bg-slate-800 border-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-mono font-bold text-xl">{parcel.trackingNumber}</p>
                    <p className="text-slate-500 text-sm">{parcel.villeDepart} → {parcel.villeArrivee}</p>
                  </div>
                  <Badge className={`${statusInfo?.color ?? 'bg-slate-500'} text-white px-3 py-1`}>
                    {statusInfo?.label ?? currentStatus}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-3 mb-6 text-sm">
                  <div><p className="text-slate-500 mb-1">Client</p><p className="font-semibold">{parcel.client?.name}</p><p>{parcel.client?.phone}</p></div>
                  <div><p className="text-slate-500 mb-1">Format / Prix</p><p className="font-semibold">{parcel.format}</p><p className="text-emerald-700 font-bold">{parcel.prixClient} DA</p></div>
                  <div>
                    <p className="text-slate-500 mb-1">Commission relais</p>
                    <p className="font-bold text-emerald-600">{parcel.commissionRelais} DA</p>
                    <p className="text-xs text-slate-400">{isDepRelay ? '📍 Relais départ' : isArrRelay ? '📍 Relais arrivée' : ''}</p>
                  </div>
                </div>

                {(parcel.recipientFirstName || parcel.recipientLastName || parcel.recipientPhone) && (
                  <div className="mb-6 rounded-lg border bg-white dark:bg-slate-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Destinataire attendu</p>
                    <p className="font-semibold">{parcel.recipientLastName} {parcel.recipientFirstName}</p>
                    <p className="text-sm text-slate-600">{parcel.recipientPhone}</p>
                  </div>
                )}

                {/* Barre de progression statuts */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6">
                  {STATUS_FLOW.map((s, idx) => {
                    const cIdx = STATUS_FLOW.indexOf(currentStatus);
                    const sIdx = STATUS_FLOW.indexOf(s);
                    const done = sIdx < cIdx;
                    const active = s === currentStatus;
                    return (
                      <div key={s} className="flex items-center gap-1 flex-shrink-0">
                        <div className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {STATUS_LABELS[s] ?? s}
                        </div>
                        {idx < STATUS_FLOW.length - 1 && <div className={`w-3 h-0.5 flex-shrink-0 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                      </div>
                    );
                  })}
                </div>

                {availableActions.length > 0 ? (
                  <div className="space-y-3">
                    {currentStatus === 'ARRIVE_RELAIS_DESTINATION' && isArrRelay && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-3">
                        <p className="font-semibold text-amber-900 dark:text-amber-100">Double sécurité obligatoire avant remise</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Nom destinataire</Label>
                            <Input
                              value={deliveryCheck.recipientLastName}
                              onChange={(e) => setDeliveryCheck(prev => ({ ...prev, recipientLastName: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Prénom destinataire</Label>
                            <Input
                              value={deliveryCheck.recipientFirstName}
                              onChange={(e) => setDeliveryCheck(prev => ({ ...prev, recipientFirstName: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Téléphone destinataire</Label>
                            <Input
                              value={deliveryCheck.recipientPhone}
                              onChange={(e) => setDeliveryCheck(prev => ({ ...prev, recipientPhone: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Code de retrait (4 ou 6 chiffres)</Label>
                            <Input
                              value={deliveryCheck.withdrawalCode}
                              onChange={(e) => setDeliveryCheck(prev => ({ ...prev, withdrawalCode: e.target.value.replace(/\D/g, '') }))}
                              maxLength={6}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {availableActions.map((a) => {
                      const Icon = a.icon;
                      return (
                        <Button key={a.action} className={`w-full justify-start h-auto py-4 text-white ${a.color}`} onClick={() => handleAction(a.action)} disabled={isUpdating}>
                          {isUpdating ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <Icon className="h-5 w-5 mr-3" />}
                          <div className="text-left"><p className="font-semibold">{a.label}</p><p className="text-xs opacity-90">{a.description}</p></div>
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 bg-white dark:bg-slate-900 rounded-lg border">
                    {currentStatus === 'LIVRE'
                      ? <div className="flex flex-col items-center gap-2"><CheckCircle className="h-8 w-8 text-emerald-500" /><p className="font-semibold">Colis livré avec succès</p></div>
                      : <div className="flex flex-col items-center gap-2"><Package className="h-8 w-8 text-slate-400" /><p>Aucune action disponible pour ce relais — statut : <strong>{statusInfo?.label ?? currentStatus}</strong></p></div>
                    }
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

// Cash Tab — Gestion de la caisse
function CashTab({ relaisId, cashInfo, userId, onRefresh }: { relaisId: string | undefined; cashInfo: any; userId: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [reverseAmount, setReverseAmount] = useState('');
  const [reverseNotes, setReverseNotes] = useState('');
  const [isReversing, setIsReversing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!relaisId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/relais-cash?relaisId=${relaisId}`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } finally {
      setIsLoading(false);
    }
  }, [relaisId]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleReverse = async () => {
    const amount = parseFloat(reverseAmount);
    if (!relaisId || !amount || amount <= 0) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }
    if (amount > cashInfo.balance) {
      toast({ title: 'Montant supérieur au solde', description: `Solde disponible : ${cashInfo.balance.toFixed(0)} DA`, variant: 'destructive' });
      return;
    }
    setIsReversing(true);
    try {
      const res = await fetch('/api/relais-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relaisId, amount, notes: reverseNotes, userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Versement enregistré', description: `${amount.toFixed(0)} DA enregistré avec succès` });
        setReverseAmount('');
        setReverseNotes('');
        await Promise.all([fetchTransactions(), onRefresh()]);
      }
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-emerald-700 mb-1">Total encaissé</p>
            <p className="text-3xl font-bold text-emerald-700">{cashInfo.cashCollected.toFixed(0)} DA</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-blue-700 mb-1">Total reversé</p>
            <p className="text-3xl font-bold text-blue-700">{cashInfo.cashReversed.toFixed(0)} DA</p>
          </CardContent>
        </Card>
        <Card className={`border-2 ${cashInfo.balance > 0 ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-orange-700 mb-1">Solde à reverser</p>
            <p className={`text-3xl font-bold ${cashInfo.balance > 0 ? 'text-orange-700' : 'text-slate-500'}`}>
              {cashInfo.balance.toFixed(0)} DA
            </p>
          </CardContent>
        </Card>
      </div>

      {cashInfo.balance > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowUpFromLine className="h-5 w-5 text-blue-600" />Enregistrer un versement</CardTitle>
            <CardDescription>Indiquez le montant remis à la plateforme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Montant (DA)</Label>
                <Input type="number" placeholder={`Max : ${cashInfo.balance.toFixed(0)} DA`} value={reverseAmount} onChange={(e) => setReverseAmount(e.target.value)} min="1" max={cashInfo.balance} />
              </div>
              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Input placeholder="Ex : Versement du 23/03" value={reverseNotes} onChange={(e) => setReverseNotes(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleReverse} disabled={isReversing || !reverseAmount || parseFloat(reverseAmount) <= 0} className="bg-blue-600 hover:bg-blue-700">
              {isReversing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmer le versement
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Historique des transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Aucune transaction</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'COLLECTED' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                      {tx.type === 'COLLECTED' ? <ArrowDownToLine className="h-4 w-4 text-emerald-600" /> : <ArrowUpFromLine className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {tx.type === 'COLLECTED' ? 'Encaissement' : 'Versement'}
                        {tx.colis && <span className="font-mono text-slate-500 ml-2 text-xs">#{tx.colis.trackingNumber}</span>}
                      </p>
                      <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString('fr-FR')}</p>
                      {tx.notes && <p className="text-xs text-slate-400">{tx.notes}</p>}
                    </div>
                  </div>
                  <p className={`font-bold ${tx.type === 'COLLECTED' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {tx.type === 'COLLECTED' ? '+' : '-'}{tx.amount.toFixed(0)} DA
                  </p>
                </div>
              ))}
            </div>
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
  const [hours, setHours] = useState({
    open: '08:00',
    close: '18:00',
  });

  useEffect(() => {
    if (relaisInfo) {
      setFormData({
        commerceName: relaisInfo.commerceName || '',
        address: relaisInfo.address || '',
        ville: relaisInfo.ville || '',
        phone: relaisInfo.user?.phone || '',
      });
      // Load hours if available
      if (relaisInfo.openTime) setHours(h => ({ ...h, open: relaisInfo.openTime }));
      if (relaisInfo.closeTime) setHours(h => ({ ...h, close: relaisInfo.closeTime }));
    }
  }, [relaisInfo]);

  const handleSave = async () => {
    if (!relaisInfo?.id) {
      toast({ title: 'Erreur', description: 'Relais non trouvé', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      // Update relais info
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

      // Update user phone if changed
      if (relaisInfo.user?.id && formData.phone !== relaisInfo.user?.phone) {
        const userResponse = await fetch(`/api/users/${relaisInfo.user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: formData.phone,
          }),
        });

        if (!userResponse.ok) {
          console.error('Failed to update phone');
        }
      }

      toast({ title: 'Succès', description: 'Paramètres sauvegardés' });
      onUpdate();
    } catch (err) {
      toast({ 
        title: 'Erreur', 
        description: err instanceof Error ? err.message : 'Impossible de sauvegarder', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateHours = async () => {
    if (!relaisInfo?.id) {
      toast({ title: 'Erreur', description: 'Relais non trouvé', variant: 'destructive' });
      return;
    }

    if (!hours.open || !hours.close) {
      toast({ title: 'Erreur', description: 'Veuillez renseigner les deux horaires', variant: 'destructive' });
      return;
    }

    if (hours.open >= hours.close) {
      toast({ title: 'Erreur', description: "L'heure d'ouverture doit être antérieure à l'heure de fermeture", variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/relais/${relaisInfo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openTime: hours.open,
          closeTime: hours.close,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.details || error?.error || 'Impossible de mettre à jour les horaires');
      }

      toast({ title: 'Horaires mis à jour', description: `Ouverture: ${hours.open}, Fermeture: ${hours.close}` });
      onUpdate();
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de mettre à jour les horaires',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations du commerce</CardTitle>
          <CardDescription>Modifiez les informations de votre point relais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="commerceName">Nom du commerce</Label>
            <Input 
              id="commerceName"
              value={formData.commerceName} 
              onChange={(e) => setFormData({ ...formData, commerceName: e.target.value })} 
              disabled={!relaisInfo || isSaving}
              placeholder="Ex: Épicerie du Centre"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input 
              id="address"
              value={formData.address} 
              onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
              disabled={!relaisInfo || isSaving}
              placeholder="Ex: 123 Rue Didouche Mourad"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ville">Ville</Label>
            <Select 
              value={formData.ville} 
              onValueChange={(v) => setFormData({ ...formData, ville: v })} 
              disabled={!relaisInfo || isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une ville" />
              </SelectTrigger>
              <SelectContent>
                {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input 
              id="phone"
              value={formData.phone} 
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
              disabled={!relaisInfo || isSaving}
              placeholder="+213 XX XX XX XX"
            />
          </div>
          
          <Button 
            onClick={handleSave} 
            className="bg-emerald-600 hover:bg-emerald-700" 
            disabled={!relaisInfo || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sauvegarde en cours...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder les modifications
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horaires d'ouverture</CardTitle>
          <CardDescription>Définissez vos horaires d'ouverture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ouverture</Label>
              <Input 
                type="time" 
                value={hours.open}
                onChange={(e) => setHours({ ...hours, open: e.target.value })}
                disabled={!relaisInfo} 
              />
            </div>
            <div className="space-y-2">
              <Label>Fermeture</Label>
              <Input 
                type="time" 
                value={hours.close}
                onChange={(e) => setHours({ ...hours, close: e.target.value })}
                disabled={!relaisInfo} 
              />
            </div>
          </div>
          <Button variant="outline" className="mt-4" disabled={!relaisInfo || isSaving} onClick={handleUpdateHours}>
            {isSaving ? 'Mise à jour...' : 'Mettre à jour les horaires'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statut du relais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {relaisInfo ? (
              <>
                <Badge className={`${RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.color} text-white px-4 py-2 text-base`}>
                  {RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.label}
                </Badge>
                {relaisInfo.status === 'PENDING' && (
                  <p className="text-sm text-orange-600">Votre demande est en cours de validation</p>
                )}
                {relaisInfo.status === 'APPROVED' && (
                  <p className="text-sm text-green-600">Votre relais est actif et visible sur la plateforme</p>
                )}
              </>
            ) : (
              <p className="text-slate-500">Chargement...</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
