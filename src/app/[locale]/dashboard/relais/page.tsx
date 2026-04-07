'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import {
  DashboardHero,
  DashboardMetricCard,
  DashboardPanel,
  DashboardShell,
  DashboardStatsGrid,
  dashboardTabsListClass,
  getDashboardTabsTriggerClass,
} from '@/components/dashboard/dashboard-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WILAYAS, PARCEL_STATUS, RELAIS_STATUS, DEFAULT_RELAY_COMMISSION, RELAY_CASH_ALERT_THRESHOLD } from '@/lib/constants';
import { parseLocaleFloat } from '@/lib/utils';
import { extractTrackingFromQrPayload } from '@/lib/qr-payload';
import { normalizeRole } from '@/lib/roles';
import { Store, Package, QrCode, DollarSign, Loader2, CheckCircle, Clock, Scan, ArrowDownToLine, ArrowUpFromLine, Settings, BarChart3, AlertCircle, Save, AlertTriangle, CreditCard, History, BanknoteIcon, User, Pencil, TrendingUp, Printer, CircleHelp } from 'lucide-react';
import { isAlgerianCommerceRegisterNumber } from '@/lib/validators';
import { QrCameraScanner } from '@/components/ui/qr-camera-scanner';
import { useToast } from '@/hooks/use-toast';

function getRoleBasedDashboardPath(role: string, locale: string): string {
  switch (role) {
    case 'ADMIN': return `/${locale}/dashboard/admin`;
    case 'TRANSPORTER': return `/${locale}/dashboard/transporter`;
    case 'RELAIS': return `/${locale}/dashboard/relais`;
    case 'ENSEIGNE': return `/${locale}/dashboard/enseigne`;
    default: return `/${locale}/dashboard/client`;
  }
}

function getArrivalReliabilityBadge(score: number) {
  if (score >= 90) {
    return { label: 'Fiabilité arrivée: Excellente', className: 'bg-emerald-600 text-white' };
  }
  if (score >= 75) {
    return { label: 'Fiabilité arrivée: À surveiller', className: 'bg-orange-500 text-white' };
  }
  return { label: 'Fiabilité arrivée: Critique', className: 'bg-red-600 text-white' };
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
  const [printerStatus, setPrinterStatus] = useState<'READY' | 'BROKEN' | 'OUT_OF_PAPER' | 'NOT_EQUIPPED'>('READY');

  const printerStatusMeta = useMemo(() => {
    const map = {
      READY: { label: 'Imprimante: prête', className: 'bg-emerald-600 text-white' },
      OUT_OF_PAPER: { label: 'Imprimante: plus de papier', className: 'bg-amber-500 text-white' },
      BROKEN: { label: 'Imprimante: en panne', className: 'bg-red-600 text-white' },
      NOT_EQUIPPED: { label: 'Imprimante: non équipée', className: 'bg-slate-500 text-white' },
    } as const;
    return map[printerStatus] || map.READY;
  }, [printerStatus]);

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

        const printerRes = await fetch('/api/relais/printers').catch(() => null);
        if (printerRes?.ok) {
          const printerData = await printerRes.json();
          const current = Array.isArray(printerData?.printers) ? printerData.printers[0] : null;
          if (current?.printerStatus) {
            setPrinterStatus(current.printerStatus);
          }
        }
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
      const userRole = normalizeRole(session.user.role);
      if (userRole !== 'RELAIS') {
        const targetPath = getRoleBasedDashboardPath(userRole, locale);
        if (targetPath !== window.location.pathname) {
          router.replace(targetPath);
        }
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
  if (normalizeRole(session.user.role) !== 'RELAIS') {
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
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <DashboardShell tone="relais" className="mx-auto max-w-7xl">
          <DashboardHero
            tone="relais"
            eyebrow="Point relais"
            title="Espace Point Relais"
            description="Centralisez les scans, la caisse et le suivi opérationnel dans une interface plus structurée, plus lumineuse et plus lisible au quotidien."
            meta={
              <>
                <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700 flex items-center gap-2"><Store className="h-3.5 w-3.5" />{relaisInfo?.commerceName || session.user.name}</Badge>
                {relaisInfo ? (
                  <Badge className={`${RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.color} text-white`}>
                    {RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.label}
                  </Badge>
                ) : null}
                <Badge className={printerStatusMeta.className}>{printerStatusMeta.label}</Badge>
                <Link href="/faq" className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white underline underline-offset-2"><CircleHelp className="h-3.5 w-3.5" />Aide / FAQ</Link>
              </>
            }
          />

          {/* Error Banner */}
          {error && (
            <Card className="border-red-200 bg-red-50/90 dark:bg-red-900/20">
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
                  <p className="text-sm text-red-600">Veuillez contacter le support pour plus d'informations. <Link href="/faq" className="underline font-medium">Consulter la FAQ</Link></p>
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

          <DashboardStatsGrid>
            <DashboardMetricCard tone="relais" label="En attente" value={stats.pending} icon={<Clock className="h-5 w-5" />} detail="colis à traiter" />
            <DashboardMetricCard tone="relais" label="Reçus / Déposés" value={stats.received} icon={<ArrowDownToLine className="h-5 w-5" />} detail="total reçus" />
            <DashboardMetricCard tone="relais" label="Cash en main" value={`${cashInfo.balance.toFixed(0)} DA`} icon={<BanknoteIcon className="h-5 w-5" />} detail="à reverser" className={cashInfo.balance >= RELAY_CASH_ALERT_THRESHOLD ? 'ring-1 ring-red-300' : ''} />
            <DashboardMetricCard tone="relais" label="Commissions" value={`${cashInfo.totalCommissions.toFixed(0)} DA`} icon={<DollarSign className="h-5 w-5" />} detail="total gagné" />
          </DashboardStatsGrid>

          <Card>
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

          <DashboardPanel tone="relais">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className={`${dashboardTabsListClass} grid grid-cols-2 lg:grid-cols-7`}>
                <TabsTrigger value="overview" className={getDashboardTabsTriggerClass('relais')}><BarChart3 className="h-4 w-4 mr-1 hidden sm:inline" />Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="scan" className={getDashboardTabsTriggerClass('relais')}><QrCode className="h-4 w-4 mr-1 hidden sm:inline" />Scanner QR</TabsTrigger>
                <TabsTrigger value="cash" className={getDashboardTabsTriggerClass('relais')}><CreditCard className="h-4 w-4 mr-1 hidden sm:inline" />Caisse</TabsTrigger>
                <TabsTrigger value="gains" className={getDashboardTabsTriggerClass('relais')}><TrendingUp className="h-4 w-4 mr-1 hidden sm:inline" />Gains</TabsTrigger>
                <TabsTrigger value="suivi" className={`${getDashboardTabsTriggerClass('relais')} hidden lg:inline-flex`}><BarChart3 className="h-4 w-4 mr-1" />Suivi</TabsTrigger>
                <TabsTrigger value="settings" className={getDashboardTabsTriggerClass('relais')}><Settings className="h-4 w-4 mr-1 hidden sm:inline" />Paramètres</TabsTrigger>
                <TabsTrigger value="profil" className={getDashboardTabsTriggerClass('relais')}><User className="h-4 w-4 mr-1 hidden sm:inline" />Profil</TabsTrigger>
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
              <TabsContent value="gains">
                <GainsTab relaisId={relaisInfo?.id} />
              </TabsContent>
              <TabsContent value="suivi">
                <SuiviTab relaisId={relaisInfo?.id} />
              </TabsContent>
              <TabsContent value="settings">
                <SettingsTab relaisInfo={relaisInfo} onUpdate={fetchRelaisInfo} />
              </TabsContent>
              <TabsContent value="profil">
                <ProfilRelaisTab userId={session.user.id} relaisInfo={relaisInfo} />
              </TabsContent>
            </Tabs>
          </DashboardPanel>
        </DashboardShell>
      </main>
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Profil Relais Tab
// ─────────────────────────────────────────────────────────────
function ProfilRelaisTab({ userId, relaisInfo }: { userId: string; relaisInfo: any }) {
  const { toast } = useToast();
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', personalAddress: '', siret: '',
    commerceName: '', address: '', ville: '',
  });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });

  const fetchUserData = async () => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      const data = await res.json();
      setUserData(data);
      setForm(prev => ({
        ...prev,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        personalAddress: data.address || '',
        siret: data.siret || '',
      }));
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setIsLoadingUser(false);
    }
  };

  useEffect(() => { fetchUserData(); }, [userId]);

  useEffect(() => {
    if (relaisInfo) {
      setForm(prev => ({
        ...prev,
        commerceName: relaisInfo.commerceName || '',
        address: relaisInfo.address || '',
        ville: relaisInfo.ville || '',
      }));
    }
  }, [relaisInfo]);

  const handleSave = async () => {
    if (passwordForm.password && passwordForm.password !== passwordForm.confirm) {
      toast({ title: 'Erreur', description: 'Les mots de passe ne correspondent pas', variant: 'destructive' });
      return;
    }
    if (form.siret && !isAlgerianCommerceRegisterNumber(form.siret)) {
      toast({ title: 'Format RC invalide', description: 'Ex : 16/0012345B22', variant: 'destructive' });
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
        siret: form.siret,
      };
      if (passwordForm.password) userPayload.password = passwordForm.password;

      const userRes = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload),
      });

      if (relaisInfo?.id) {
        await fetch(`/api/relais/${relaisInfo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commerceName: form.commerceName, address: form.address, ville: form.ville }),
        });
      }

      if (userRes.ok) {
        toast({ title: 'Profil mis à jour' });
        setIsEditing(false);
        setPasswordForm({ password: '', confirm: '' });
        await fetchUserData();
      } else {
        const err = await userRes.json().catch(() => ({}));
        toast({ title: 'Erreur', description: err.error || 'Impossible de sauvegarder', variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingUser) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;

  const statusConfig: Record<string, { label: string; color: string }> = {
    APPROVED: { label: 'Approuvé', color: 'bg-green-100 text-green-700 border-green-300' },
    PENDING:  { label: 'En attente de validation', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    REJECTED: { label: 'Refusé', color: 'bg-red-100 text-red-700 border-red-300' },
  };
  const s = relaisInfo?.status ? statusConfig[relaisInfo.status] : null;

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
              <CardDescription>Vos informations personnelles et commerciales</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {s && <span className={`text-xs border rounded px-2 py-0.5 ${s.color}`}>{s.label}</span>}
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 border rounded px-3 py-1.5 transition-colors"
                >
                  <Pencil className="h-4 w-4" /> Modifier
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b">Informations personnelles</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prénom</Label>
                    <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Ex: 0555123456" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Adresse personnelle</Label>
                    <Input value={form.personalAddress} onChange={e => setForm({ ...form, personalAddress: e.target.value })} placeholder="Ex: 12 Rue Didouche Mourad" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>N° Registre du commerce (CNRC)</Label>
                    <Input value={form.siret} onChange={e => setForm({ ...form, siret: e.target.value })} placeholder="Ex: 16/0012345B22" className="font-mono" />
                    <p className="text-xs text-muted-foreground">Format CNRC : WW/NNNNNNNLAA — ex : <code>16/0012345B22</code></p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b">Informations du commerce</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nom du commerce</Label>
                    <Input value={form.commerceName} onChange={e => setForm({ ...form, commerceName: e.target.value })} placeholder="Ex: Épicerie du Centre" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Adresse</Label>
                    <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Ex: 12 Rue Didouche Mourad" />
                  </div>
                  <div className="space-y-2">
                    <Label>Wilaya</Label>
                    <Select value={form.ville} onValueChange={v => setForm({ ...form, ville: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b">Changer de mot de passe (optionnel)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nouveau mot de passe</Label>
                    <Input type="password" value={passwordForm.password} onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmer le mot de passe</Label>
                    <Input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-60 transition-colors"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </button>
                <button
                  onClick={() => { setIsEditing(false); fetchUserData(); }}
                  className="px-4 py-2 text-sm border rounded hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b">Informations personnelles</p>
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
                    <p className="text-xs text-slate-400 uppercase tracking-wide">N° RC (CNRC)</p>
                    <p className="font-medium font-mono">{userData?.siret || '—'}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Adresse personnelle</p>
                    <p className="font-medium">{userData?.address || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Membre depuis</p>
                    <p className="text-sm text-slate-600">
                      {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b">Informations du commerce</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Nom du commerce</p>
                    <p className="font-medium">{relaisInfo?.commerceName || '—'}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Adresse</p>
                    <p className="font-medium">{relaisInfo?.address || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Wilaya</p>
                    <p className="font-medium">{WILAYAS.find(w => w.id === relaisInfo?.ville)?.name || relaisInfo?.ville || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Overview Tab
function OverviewTab({ relaisInfo, setActiveTab, cashInfo }: { relaisInfo: any; setActiveTab: (tab: string) => void; cashInfo: any }) {
  const arrivalReliability = getArrivalReliabilityBadge(relaisInfo?.complianceScore || 0);

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
              <div className="flex justify-between items-center"><span className="text-slate-500">Fiabilité arrivée</span>
                <Badge className={arrivalReliability.className}>{arrivalReliability.label}</Badge>
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
        <CardHeader><CardTitle>Commissions relais historiques</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionPetit || DEFAULT_RELAY_COMMISSION.PETIT} DA</p>
              <p className="text-xs text-slate-500 mt-1">Legacy petit</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionMoyen || DEFAULT_RELAY_COMMISSION.MOYEN} DA</p>
              <p className="text-xs text-slate-500 mt-1">Legacy moyen</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionGros || DEFAULT_RELAY_COMMISSION.GROS} DA</p>
              <p className="text-xs text-slate-500 mt-1">Legacy gros</p>
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
  const searchParams = useSearchParams();
  const [tracking, setTracking] = useState(() => searchParams.get('scan') ?? '');
  const [parcel, setParcel] = useState<any>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<{ amount: number; collectedAtIso: string; trackingNumber: string } | null>(null);
  const [matchingFeedback, setMatchingFeedback] = useState<{ matched: boolean; error: string | null } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [deliveryCheck, setDeliveryCheck] = useState({
    recipientFirstName: '',
    recipientLastName: '',
    recipientPhone: '',
    withdrawalCode: '',
    recipientIdentityNumber: '',
  });

  // Auto-trigger search if ?scan= param is present on mount
  useEffect(() => {
    const scanParam = searchParams.get('scan');
    if (scanParam && !parcel) {
      handleSearch();
    }
  }, []);

  const handleSearch = async (rawInput?: string) => {
    const resolvedTracking = extractTrackingFromQrPayload(rawInput ?? tracking);
    if (!resolvedTracking) {
      toast({ title: 'QR invalide', description: 'Le QR scanné ne contient pas de numéro de suivi exploitable', variant: 'destructive' });
      return;
    }

    setIsSearching(true);
    setParcel(null);
    setPaymentReceipt(null);
    setMatchingFeedback(null);
    try {
      const res = await fetch(`/api/qr/${resolvedTracking}`);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Erreur scan', description: 'Impossible de récupérer les informations du colis', variant: 'destructive' });
      } else {
        if (!data?.trackingNumber || !data?.relaisDepart || !data?.relaisArrivee) {
          toast({ title: 'Erreur scan', description: 'Impossible de récupérer les informations du colis', variant: 'destructive' });
          setParcel(null);
          return;
        }
        setParcel(data);
        setTracking(resolvedTracking);
        setDeliveryCheck({
          recipientFirstName: '',
          recipientLastName: '',
          recipientPhone: '',
          withdrawalCode: '',
          recipientIdentityNumber: '',
        });
      }
    } catch {
      toast({ title: 'Erreur scan', description: 'Impossible de récupérer les informations du colis', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!parcel || !relaisId) return;

    if (action === 'receive_at_departure') {
      await handleDepartureReception();
      return;
    }

    if (action === 'deliver') {
      if (
        !deliveryCheck.recipientFirstName.trim() ||
        !deliveryCheck.recipientLastName.trim() ||
        !deliveryCheck.recipientPhone.trim() ||
        !deliveryCheck.withdrawalCode.trim() ||
        !deliveryCheck.recipientIdentityNumber.trim()
      ) {
        toast({
          title: 'Vérification requise',
          description: 'Nom, prénom, téléphone, code de retrait et numéro de pièce d\'identité sont obligatoires',
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

  const handlePrintLabel = async () => {
    if (!parcel || !relaisId) return;

    setIsPrinting(true);

    try {
      const authRes = await fetch(`/api/qr/${parcel.trackingNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'print_label',
          relaisId,
          userId,
        }),
      });

      const authData = await authRes.json().catch(() => ({}));
      if (!authRes.ok) {
        const details = authData?.details ? ` ${authData.details}` : '';
        toast({
          title: 'Impression impossible',
          description: `${authData?.error || 'Impossible de récupérer les informations du colis'}${details}`,
          variant: 'destructive',
        });
        return;
      }

      const departName = WILAYAS.find((w) => w.id === parcel.villeDepart)?.name || parcel.villeDepart;
      const arriveeName = WILAYAS.find((w) => w.id === parcel.villeArrivee)?.name || parcel.villeArrivee;
      const html = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8" />
  <title>Étiquette relais - ${parcel.trackingNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 18px; }
    .label { border: 2px solid #111; padding: 14px; }
    .h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .brand { font-size: 22px; font-weight: 800; color: #059669; }
    .tracking { font-family: 'Courier New', monospace; font-size: 24px; font-weight: 800; }
    .route { background: #059669; color: white; text-align: center; padding: 8px; font-weight: 700; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .box { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
    .muted { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: .6px; }
    .v { font-size: 15px; font-weight: 600; }
    .desc { border: 1px dashed #bbb; padding: 8px; border-radius: 6px; margin-bottom: 10px; }
    .qr { text-align: center; margin-top: 10px; }
    .qr img { width: 120px; height: 120px; }
  </style>
</head>
<body>
  <div class="label">
    <div class="h">
      <div class="brand">SwiftColis</div>
      <div class="tracking">${parcel.trackingNumber}</div>
    </div>
    <div class="route">${departName} → ${arriveeName}</div>
    <div class="grid">
      <div class="box">
        <div class="muted">Expéditeur</div>
        <div class="v">${parcel.senderLastName || ''} ${parcel.senderFirstName || ''}</div>
        <div>${parcel.senderPhone || ''}</div>
      </div>
      <div class="box">
        <div class="muted">Destinataire</div>
        <div class="v">${parcel.recipientLastName || ''} ${parcel.recipientFirstName || ''}</div>
        <div>${parcel.recipientPhone || ''}</div>
      </div>
    </div>
    <div class="grid">
      <div class="box"><div class="muted">Relais départ</div><div>${parcel.relaisDepart?.commerceName || ''}</div><div>${parcel.relaisDepart?.address || ''}</div></div>
      <div class="box"><div class="muted">Relais arrivée</div><div>${parcel.relaisArrivee?.commerceName || ''}</div><div>${parcel.relaisArrivee?.address || ''}</div></div>
    </div>
    ${parcel.description ? `<div class="desc"><strong>Description:</strong> ${parcel.description}</div>` : ''}
    ${parcel.qrCodeImage ? `<div class="qr"><img src="${parcel.qrCodeImage}" alt="QR" /><div>Scanner au relais</div></div>` : ''}
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

      toast({ title: 'Impression autorisée', description: 'Étiquette générée après vérification paiement et anti-double-scan.' });
    } catch {
      toast({ title: 'Impression impossible', description: 'Impossible de récupérer les informations du colis', variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  };

  const currentStatus = parcel?.status;
  const isDepRelay = parcel?.relaisDepart?.id === relaisId;
  const isArrRelay = parcel?.relaisArrivee?.id === relaisId;
  const amountToPayAtRelay = Number(parcel?.amountToPayAtRelay ?? (parcel?.status === 'CREATED' ? parcel?.prixClient : 0) ?? 0);
  const statusInfo = PARCEL_STATUS.find(s => s.id === currentStatus);

  type ActionDef = { action: string; label: string; description: string; color: string; icon: React.ComponentType<{ className?: string }> };
  const availableActions: ActionDef[] = [];

  if (parcel) {
    if (['CREATED', 'READY_FOR_DEPOSIT'].includes(String(currentStatus)) && isDepRelay) {
      availableActions.push({
        action: 'receive_at_departure',
        label: currentStatus === 'CREATED' ? 'Valider réception + paiement' : 'Valider réception + dépôt',
        description: currentStatus === 'CREATED' ? `Encaisser ${parcel.prixClient ?? '—'} DA puis confirmer le dépôt` : 'Confirmer le dépôt du colis au relais de départ',
        color: 'bg-emerald-600 hover:bg-emerald-700',
        icon: ArrowDownToLine,
      });
    } else if (currentStatus === 'PAID_RELAY' && isDepRelay) {
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

  const STATUS_FLOW = ['CREATED', 'READY_FOR_DEPOSIT', 'PAID_RELAY', 'DEPOSITED_RELAY', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION', 'LIVRE'];
  const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Créé', READY_FOR_DEPOSIT: 'À déposer', PAID_RELAY: 'Payé', DEPOSITED_RELAY: 'Déposé',
    EN_TRANSPORT: 'Transport', ARRIVE_RELAIS_DESTINATION: 'Arrivé', LIVRE: 'Livré',
  };

  const handleDepartureReception = async () => {
    if (!parcel || !relaisId) return;
    if (parcel.relaisDepart?.id !== relaisId) {
      toast({
        title: 'Relais incorrect',
        description: `Ce colis doit être traité au relais de départ: ${parcel.relaisDepart?.commerceName ?? 'inconnu'}`,
        variant: 'destructive',
      });
      return;
    }

    const requiresCashPayment = parcel.status === 'CREATED';
    const expectedAmount = Number(parcel?.amountToPayAtRelay ?? parcel?.prixClient ?? 0);

    if (requiresCashPayment && expectedAmount > 0) {
      const confirmed = window.confirm(`Montant à encaisser au relais: ${expectedAmount.toFixed(0)} DA. Confirmer l'encaissement ?`);
      if (!confirmed) return;
    }

    setIsUpdating(true);
    try {
      if (requiresCashPayment) {
        const paymentRes = await fetch(`/api/qr/${parcel.trackingNumber}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate_payment',
            relaisId,
            userId,
          }),
        });

        const paymentData = await paymentRes.json();
        if (!paymentRes.ok) {
          toast({
            title: 'Erreur paiement',
            description: paymentData.error || 'Impossibilité de valider le paiement',
            variant: 'destructive',
          });
          return;
        }

        const collected = Number(paymentData?.amountCollected ?? expectedAmount ?? 0);
        setPaymentReceipt({
          amount: collected,
          collectedAtIso: new Date().toISOString(),
          trackingNumber: parcel.trackingNumber,
        });
        toast({
          title: 'Paiement encaissé',
          description: `${collected.toFixed(0)} DA enregistrés en caisse relais`,
        });
      }

      const depositRes = await fetch(`/api/qr/${parcel.trackingNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deposit',
          relaisId,
          userId,
        }),
      });

      const depositData = await depositRes.json();
      if (!depositRes.ok) {
        toast({
          title: 'Avertissement',
          description: `${requiresCashPayment ? 'Paiement validé mais ' : ''}dépôt échoué: ${depositData.error}. Relais peut réessayer le dépôt.`,
          variant: 'destructive',
        });
        onRefresh();
        return;
      }

      if (depositData?.matching?.attempted) {
        setMatchingFeedback({
          matched: Boolean(depositData.matching.matched),
          error: depositData.matching.error || null,
        });
      } else {
        setMatchingFeedback(null);
      }

      toast({
        title: 'Succès',
        description: `✓ ${requiresCashPayment ? `Paiement encaissé (${expectedAmount.toFixed(0)} DA) + ` : ''}Dépôt enregistré (${parcel.trackingNumber})`,
      });

      if (depositData?.matching?.attempted && !depositData.matching.matched) {
        toast({
          title: 'Matching transporteur non trouvé',
          description: depositData.matching.error || 'Aucun trajet compatible trouvé pour ce colis.',
          variant: 'destructive',
        });
      }

      setParcel((prev: any) => ({ ...prev, status: depositData.parcel?.status ?? 'DEPOSITED_RELAY' }));
      onRefresh();
    } catch (err) {
      console.error('[ScanTab] Réception départ erreur:', err);
      toast({ title: 'Erreur réseau', description: String(err), variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scan className="h-5 w-5" />Scanner / Rechercher / Réceptionner un colis</CardTitle>
          <CardDescription>Entrez le numéro de suivi ou scannez le QR code pour encaisser, déposer ou remettre un colis</CardDescription>
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
            <Button onClick={() => handleSearch()} disabled={isSearching || !tracking.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Rechercher
            </Button>
          </div>
          <QrCameraScanner
            disabled={isSearching || isUpdating}
            onScan={(raw) => {
              setTracking(raw);
              handleSearch(raw);
            }}
            onError={(message) => {
              toast({
                title: 'Scanner caméra indisponible',
                description: message,
                variant: 'destructive',
              });
            }}
          />

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
                  <div><p className="text-slate-500 mb-1">Poids / Prix</p><p className="font-semibold">{parcel.weight ? `${parcel.weight} kg` : 'Non renseigné'}</p><p className="text-emerald-700 font-bold">{parcel.prixClient} DA</p></div>
                  <div>
                    <p className="text-slate-500 mb-1">Commission relais</p>
                    <p className="font-bold text-emerald-600">{parcel.commissionRelais} DA</p>
                    <p className="text-xs text-slate-400">{isDepRelay ? '📍 Relais départ' : isArrRelay ? '📍 Relais arrivée' : ''}</p>
                  </div>
                </div>

                {isDepRelay && currentStatus === 'CREATED' && amountToPayAtRelay > 0 && (
                  <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">Montant à payer au relais</p>
                    <p className="mt-1 text-2xl font-extrabold text-emerald-700">{amountToPayAtRelay.toFixed(0)} DA</p>
                    <p className="text-xs text-emerald-700/80 mt-1">Ce montant sera enregistré automatiquement dans la caisse du relais après validation.</p>
                  </div>
                )}

                {paymentReceipt && paymentReceipt.trackingNumber === parcel.trackingNumber && (
                  <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-blue-700">Preuve d'encaissement</p>
                    <p className="mt-1 text-lg font-bold text-blue-800">{paymentReceipt.amount.toFixed(0)} DA encaissés</p>
                    <p className="text-xs text-blue-700/80 mt-1">
                      Enregistré le {new Date(paymentReceipt.collectedAtIso).toLocaleString('fr-FR')}
                    </p>
                  </div>
                )}

                {matchingFeedback && (
                  <div className={`mb-6 rounded-lg border p-4 ${matchingFeedback.matched ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className={`text-xs uppercase tracking-wide ${matchingFeedback.matched ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Mission transporteur
                    </p>
                    <p className={`mt-1 text-sm font-semibold ${matchingFeedback.matched ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {matchingFeedback.matched
                        ? 'Une mission transporteur a été créée automatiquement.'
                        : 'Aucune mission transporteur n’a été créée automatiquement.'}
                    </p>
                    {!matchingFeedback.matched && matchingFeedback.error && (
                      <p className="text-xs text-amber-800/80 mt-1">{matchingFeedback.error}</p>
                    )}
                  </div>
                )}

                <div className="mb-6">
                  <Button type="button" variant="outline" onClick={handlePrintLabel} className="w-full sm:w-auto" disabled={isPrinting || isUpdating}>
                    {isPrinting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                    Imprimer l'étiquette au relais
                  </Button>
                </div>

                {(parcel.recipientFirstName || parcel.recipientLastName || parcel.recipientPhone) && (
                  <div className="mb-6 rounded-lg border bg-white dark:bg-slate-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Destinataire attendu</p>
                    <p className="font-semibold">{parcel.recipientLastName} {parcel.recipientFirstName}</p>
                    <p className="text-sm text-slate-600">{parcel.recipientPhone}</p>
                  </div>
                )}

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
                      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.104.896-2 2-2s2 .896 2 2-.896 2-2 2-2-.896-2-2zm0 0V7m0 4v4m-6 4h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          </div>
                          <div>
                            <p className="font-bold text-red-900 dark:text-red-100">Vérification d'identité obligatoire</p>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">Demandez au destinataire de présenter une pièce d'identité officielle (CIN, passeport, permis de conduire) avant toute remise.</p>
                          </div>
                        </div>

                        <ol className="space-y-1.5 text-sm">
                          <li className="flex items-center gap-2 text-red-800 dark:text-red-200"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">1</span>Vérifiez que la photo sur la pièce d'identité correspond au porteur</li>
                          <li className="flex items-center gap-2 text-red-800 dark:text-red-200"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">2</span>Saisissez le nom, prénom et téléphone tels qu'indiqués sur la pièce</li>
                          <li className="flex items-center gap-2 text-red-800 dark:text-red-200"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">3</span>Entrez le numéro de la pièce d'identité pour la traçabilité</li>
                          <li className="flex items-center gap-2 text-red-800 dark:text-red-200"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">4</span>Demandez le code de retrait reçu par le destinataire</li>
                        </ol>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Nom destinataire <span className="text-red-600">*</span></Label>
                            <Input placeholder="Tel qu'indiqué sur la pièce d'identité" value={deliveryCheck.recipientLastName} onChange={(e) => setDeliveryCheck(prev => ({ ...prev, recipientLastName: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Prénom destinataire <span className="text-red-600">*</span></Label>
                            <Input placeholder="Tel qu'indiqué sur la pièce d'identité" value={deliveryCheck.recipientFirstName} onChange={(e) => setDeliveryCheck(prev => ({ ...prev, recipientFirstName: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Téléphone destinataire <span className="text-red-600">*</span></Label>
                            <Input placeholder="0555 123 456" value={deliveryCheck.recipientPhone} onChange={(e) => setDeliveryCheck(prev => ({ ...prev, recipientPhone: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Code de retrait <span className="text-red-600">*</span></Label>
                            <Input placeholder="4 ou 6 chiffres reçus par le destinataire" value={deliveryCheck.withdrawalCode} onChange={(e) => setDeliveryCheck(prev => ({ ...prev, withdrawalCode: e.target.value.replace(/\D/g, '') }))} maxLength={6} />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <Label>N° pièce d'identité (CIN / Passeport / Permis) <span className="text-red-600">*</span></Label>
                            <Input placeholder="Ex: 123456789 — à relever depuis la pièce présentée" value={deliveryCheck.recipientIdentityNumber} onChange={(e) => setDeliveryCheck(prev => ({ ...prev, recipientIdentityNumber: e.target.value.trim().toUpperCase() }))} className="font-mono uppercase" />
                            <p className="text-xs text-red-600">Ce numéro est enregistré dans le journal de traçabilité de la livraison.</p>
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
function CashTab({ relaisId, cashInfo: initialCashInfo, userId, onRefresh }: { relaisId: string | undefined; cashInfo: any; userId: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cashPickups, setCashPickups] = useState<any[]>([]);
  const [cashInfo, setCashInfo] = useState(initialCashInfo);
  const [reverseAmount, setReverseAmount] = useState('');
  const [reverseNotes, setReverseNotes] = useState('');
  const [pickupAmount, setPickupAmount] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [pickupScheduledAt, setPickupScheduledAt] = useState('');
  const [isReversing, setIsReversing] = useState(false);
  const [isRequestingPickup, setIsRequestingPickup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Keep local cashInfo in sync when parent updates it (e.g. on initial load)
  useEffect(() => { setCashInfo(initialCashInfo); }, [initialCashInfo]);

  const fetchTransactions = useCallback(async () => {
    if (!relaisId) return;
    setIsLoading(true);
    try {
      const [cashRes, pickupRes] = await Promise.all([
        fetch(`/api/relais-cash?relaisId=${relaisId}`),
        fetch(`/api/relais/cash-pickups?relaisId=${relaisId}`),
      ]);
      const cashData = await cashRes.json();
      const pickupData = await pickupRes.json().catch(() => ({ pickups: [] }));
      setTransactions(cashData.transactions || []);
      setCashPickups(pickupData.pickups || []);
      // Update local cash summary from fresh API data (source of truth)
      if (cashRes.ok) {
        setCashInfo({
          cashCollected: cashData.cashCollected ?? 0,
          cashReversed: cashData.cashReversed ?? 0,
          balance: cashData.balance ?? 0,
          totalCommissions: cashData.totalCommissions ?? 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [relaisId]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleReverse = async () => {
    const amount = parseLocaleFloat(reverseAmount);
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

  const handleRequestPickup = async () => {
    const expectedAmount = parseLocaleFloat(pickupAmount);
    if (!relaisId || !expectedAmount || expectedAmount <= 0) {
      toast({ title: 'Montant invalide', description: 'Le montant attendu est requis', variant: 'destructive' });
      return;
    }
    if (expectedAmount > cashInfo.balance) {
      toast({
        title: 'Montant supérieur au cash disponible',
        description: `Cash en attente : ${cashInfo.balance.toFixed(0)} DA`,
        variant: 'destructive',
      });
      return;
    }

    setIsRequestingPickup(true);
    try {
      const res = await fetch('/api/relais/cash-pickups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relaisId,
          expectedAmount,
          scheduledAt: pickupScheduledAt || undefined,
          notes: pickupNotes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Impossible de demander la collecte');
      }

      toast({ title: 'Collecte demandée', description: `${expectedAmount.toFixed(0)} DA demandés en collecte physique.` });
      setPickupAmount('');
      setPickupNotes('');
      setPickupScheduledAt('');
      await fetchTransactions();
    } catch (error) {
      toast({
        title: 'Erreur collecte',
        description: error instanceof Error ? error.message : 'Demande impossible',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingPickup(false);
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
            <Button onClick={handleReverse} disabled={isReversing || !reverseAmount || parseLocaleFloat(reverseAmount) <= 0} className="bg-blue-600 hover:bg-blue-700">
              {isReversing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmer le versement
            </Button>
          </CardContent>
        </Card>
      )}

      {cashInfo.balance > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BanknoteIcon className="h-5 w-5 text-emerald-600" />Demander une collecte physique</CardTitle>
            <CardDescription>Demandez à SwiftColis de récupérer le cash directement dans votre point relais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Montant attendu (DA)</Label>
                <Input type="number" placeholder={`Max : ${cashInfo.balance.toFixed(0)} DA`} value={pickupAmount} onChange={(e) => setPickupAmount(e.target.value)} min="1" max={cashInfo.balance} />
              </div>
              <div className="space-y-2">
                <Label>Créneau souhaité</Label>
                <Input type="datetime-local" value={pickupScheduledAt} onChange={(e) => setPickupScheduledAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Input placeholder="Ex : disponible après 14h" value={pickupNotes} onChange={(e) => setPickupNotes(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleRequestPickup} disabled={isRequestingPickup || !pickupAmount || parseLocaleFloat(pickupAmount) <= 0} className="bg-emerald-600 hover:bg-emerald-700">
              {isRequestingPickup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BanknoteIcon className="h-4 w-4 mr-2" />}
              Demander une collecte
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Historique des collectes physiques</CardTitle>
          <CardDescription>Suivez vos demandes de récupération cash et leur avancement</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
          ) : cashPickups.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Aucune collecte physique demandée</p>
          ) : (
            <div className="space-y-3">
              {cashPickups.map((pickup: any) => (
                <div key={pickup.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">Collecte cash</p>
                      <Badge variant="outline">{pickup.status}</Badge>
                      <Badge className="bg-orange-100 text-orange-700">{Number(pickup.expectedAmount || 0).toFixed(0)} DA</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Créée le {new Date(pickup.createdAt).toLocaleString('fr-FR')}</p>
                    {pickup.scheduledAt ? <p className="text-xs text-slate-500">Créneau : {new Date(pickup.scheduledAt).toLocaleString('fr-FR')}</p> : null}
                    {pickup.receiptRef ? <p className="text-xs text-slate-500">Reçu : {pickup.receiptRef}</p> : null}
                    {pickup.notes ? <p className="text-xs text-slate-400">{pickup.notes}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{pickup.collectedAmount ? `${Number(pickup.collectedAmount).toFixed(0)} DA` : '—'}</p>
                    <p className="text-xs text-slate-400">collecté</p>
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

// Settings Tab
function SettingsTab({ relaisInfo, onUpdate }: { relaisInfo: any; onUpdate: () => void }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);
  const [printerStatus, setPrinterStatus] = useState<'READY' | 'BROKEN' | 'OUT_OF_PAPER' | 'NOT_EQUIPPED'>('READY');
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

  useEffect(() => {
    const fetchPrinterStatus = async () => {
      if (!relaisInfo?.id) return;
      try {
        const res = await fetch('/api/relais/printers');
        if (!res.ok) return;
        const data = await res.json();
        const current = Array.isArray(data?.printers) ? data.printers[0] : null;
        if (current?.printerStatus) {
          setPrinterStatus(current.printerStatus);
        }
      } catch {
        // no-op: keep current printer status in UI
      }
    };

    void fetchPrinterStatus();
  }, [relaisInfo?.id]);

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

  const handleUpdatePrinterStatus = async () => {
    if (!relaisInfo?.id) {
      toast({ title: 'Erreur', description: 'Relais non trouvé', variant: 'destructive' });
      return;
    }

    setIsSavingPrinter(true);
    try {
      const response = await fetch('/api/relais/printers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerStatus }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de mettre à jour le statut imprimante');
      }

      toast({ title: 'Statut imprimante mis à jour', description: 'Votre statut est immédiatement pris en compte pour le scan et l\'impression.' });
      onUpdate();
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de mettre à jour le statut imprimante',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPrinter(false);
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
          <CardTitle>État de l'imprimante</CardTitle>
          <CardDescription>Déclarez votre disponibilité matérielle en temps réel (papier, panne, indisponible).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Statut imprimante</Label>
            <Select value={printerStatus} onValueChange={(value) => setPrinterStatus(value as 'READY' | 'BROKEN' | 'OUT_OF_PAPER' | 'NOT_EQUIPPED')}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="READY">Prête</SelectItem>
                <SelectItem value="OUT_OF_PAPER">Plus de papier</SelectItem>
                <SelectItem value="BROKEN">En panne</SelectItem>
                <SelectItem value="NOT_EQUIPPED">Non équipée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-500">Le scan/impression n'est autorisé que si le relais est opérationnel et l'imprimante disponible.</p>
          <Button variant="outline" onClick={handleUpdatePrinterStatus} disabled={!relaisInfo || isSavingPrinter}>
            {isSavingPrinter ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
            Mettre à jour le statut imprimante
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

// ─────────────────────────────────────────────────────────────
// Gains Tab — Commissions & historique financier du relais
// ─────────────────────────────────────────────────────────────
function GainsTab({ relaisId }: { relaisId: string | undefined }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'COLLECTED' | 'REVERSED'>('ALL');

  const fetchData = useCallback(async () => {
    if (!relaisId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/relais/financials?relaisId=${relaisId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [relaisId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthlyData = useMemo(() => {
    if (!data?.transactions) return [];
    const months: Record<string, number> = {};
    const sorted = [...data.transactions]
      .filter((t: any) => t.type === 'COLLECTED')
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    sorted.forEach((t: any) => {
      const d = new Date(t.createdAt);
      const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      months[key] = (months[key] || 0) + (t.colis?.commissionRelais || 0);
    });
    return Object.entries(months).map(([month, amount]) => ({ month, amount: Math.round(amount as number) })).slice(-6);
  }, [data]);

  const totalCommissions = useMemo(() =>
    (data?.transactions || [])
      .filter((t: any) => t.type === 'COLLECTED')
      .reduce((sum: number, t: any) => sum + (t.colis?.commissionRelais || 0), 0),
    [data]
  );

  const filteredTransactions = useMemo(() =>
    (data?.transactions || []).filter((t: any) => filter === 'ALL' || t.type === filter),
    [data, filter]
  );

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;
  }

  const blockRisk = data?.blockRiskPercent || 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commissions gagnées</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalCommissions.toFixed(0)} DA</div>
            <p className="text-xs text-slate-500">sur tous les colis livrés</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash encaissé</CardTitle>
            <BanknoteIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.totalEncaisse || 0).toFixed(0)} DA</div>
            <p className="text-xs text-slate-500">{(data?.totalReverse || 0).toFixed(0)} DA reversé</p>
          </CardContent>
        </Card>
        <Card className={blockRisk >= 100 ? 'border-red-400' : blockRisk > 70 ? 'border-orange-400' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risque blocage</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${blockRisk > 70 ? 'text-red-500' : 'text-orange-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${blockRisk > 70 ? 'text-red-600' : blockRisk > 40 ? 'text-orange-500' : 'text-slate-700'}`}>
              {blockRisk.toFixed(0)}%
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
              <div
                className={`h-1.5 rounded-full transition-all ${blockRisk > 70 ? 'bg-red-500' : blockRisk > 40 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(blockRisk, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Seuil : {(data?.blockThreshold || 0).toFixed(0)} DA</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly bar chart */}
      {monthlyData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Commissions mensuelles</CardTitle>
            <CardDescription>Revenus des 6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit=" DA" width={72} />
                <Tooltip formatter={(v: number) => [`${v} DA`, 'Commissions']} />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-slate-500">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            Aucune commission enregistrée pour le moment
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique financier
            </CardTitle>
            <Select value={filter} onValueChange={(v: 'ALL' | 'COLLECTED' | 'REVERSED') => setFilter(v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tout</SelectItem>
                <SelectItem value="COLLECTED">Encaissements</SelectItem>
                <SelectItem value="REVERSED">Versements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Aucune transaction</p>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'COLLECTED' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                      {tx.type === 'COLLECTED'
                        ? <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                        : <ArrowUpFromLine className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {tx.type === 'COLLECTED' ? 'Encaissement client' : 'Versement plateforme'}
                        {tx.colis && <span className="font-mono text-slate-400 ml-2 text-xs">#{tx.colis.trackingNumber}</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {tx.colis && <span className="ml-2">{tx.colis.villeDepart} → {tx.colis.villeArrivee}</span>}
                      </p>
                      {tx.notes && <p className="text-xs text-slate-400 italic">{tx.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${tx.type === 'COLLECTED' ? 'text-emerald-600' : 'text-blue-600'}`}>
                      {tx.type === 'COLLECTED' ? '+' : '-'}{tx.amount.toFixed(0)} DA
                    </p>
                    {tx.type === 'COLLECTED' && tx.colis?.commissionRelais > 0 && (
                      <p className="text-xs text-emerald-500">+{tx.colis.commissionRelais} DA comm.</p>
                    )}
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

// ─────────────────────────────────────────────────────────────
// Suivi Tab — Métriques de performance du relais
// ─────────────────────────────────────────────────────────────
function SuiviTab({ relaisId }: { relaisId: string | undefined }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!relaisId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/relais/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relaisId }) });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        toast({ title: 'Erreur', description: 'Impossible de charger les statistiques', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur de connexion', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [relaisId, toast]);

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 30000); return () => clearInterval(interval); }, [fetchData]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  if (!data) {
    return <Card><CardContent className="py-10 text-center text-slate-500">Impossible de charger les statistiques</CardContent></Card>;
  }

  const m = data.metrics || {};
  const scoreColor = m.reliabilityScore >= 95 ? 'text-emerald-600' : m.reliabilityScore >= 80 ? 'text-orange-600' : 'text-red-600';
  const scoreBg = m.reliabilityScore >= 95 ? 'bg-emerald-50 dark:bg-emerald-900/20' : m.reliabilityScore >= 80 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-red-50 dark:bg-red-900/20';

  return (
    <div className="space-y-6">
      {/* Score de fiabilité */}
      <Card className={scoreBg}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Score de fiabilité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className={`text-5xl font-bold ${scoreColor}`}>{m.reliabilityScore || 0}%</div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {m.reliabilityScore >= 95 ? 'Excellent' : m.reliabilityScore >= 80 ? 'Bon' : m.reliabilityScore >= 60 ? 'À améliorer' : 'Critique'}
              </p>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Colis livrés à temps</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(0, 100 - m.nbDelayed * 5)}%` }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Taux de livraison</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${m.nbLivres > 0 ? (m.nbLivres / (m.nbLivres + m.nbDelayed)) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métriques de colis */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Colis déposés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{m.nbDeposites || 0}</p>
            <p className="text-xs text-slate-500 mt-1">Ce mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Colis livrés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{m.nbLivres || 0}</p>
            <p className="text-xs text-slate-500 mt-1">Taux: {m.nbDeposites > 0 ? ((m.nbLivres / m.nbDeposites) * 100).toFixed(0) : 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">En retard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${m.nbDelayed > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{m.nbDelayed || 0}</p>
            <p className="text-xs text-slate-500 mt-1">Colis non livrés</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Dernière activité</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono text-slate-900 dark:text-slate-100">{m.lastActivity ? new Date(m.lastActivity).toLocaleDateString('fr-FR') : '—'}</p>
            <p className="text-xs text-slate-500 mt-1">{m.lastActivity ? new Date(m.lastActivity).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Métriques financières */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Cash encaissé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{(m.cashCollected || 0).toFixed(0)} DA</p>
            <p className="text-xs text-slate-500 mt-1">Montant collecté</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Commission relais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{(m.commissionRelaisTotal || 0).toFixed(0)} DA</p>
            <p className="text-xs text-slate-500 mt-1">Revenus générés</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600">Montant à payer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${m.amountToPay > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{(m.amountToPay || 0).toFixed(0)} DA</p>
            <p className="text-xs text-slate-500 mt-1">Solde non versé</p>
          </CardContent>
        </Card>
      </div>

      {/* Détail des montants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Détail financier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-semibold">Montant dû à la plateforme (commission plateforme)</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{(m.commissionPlateformeTotal || 0).toFixed(0)} DA</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-semibold">Commission au relais</span>
              <span className="font-mono font-bold text-emerald-600">+{(m.commissionRelaisTotal || 0).toFixed(0)} DA</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="text-sm font-bold">Net à verser au relais</span>
              <span className={`font-mono text-lg font-bold ${m.amountToPay > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                {(m.amountToPay || 0).toFixed(0)} DA
              </span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm text-slate-600 dark:text-slate-400">Montant déjà versé</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{(m.amountPaid || 0).toFixed(0)} DA</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
