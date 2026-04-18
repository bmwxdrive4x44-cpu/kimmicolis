'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MatchingAutoAssignPanel } from '@/components/dashboard/admin/matching-auto-assign-panel';
import {
  DashboardEmptyState,
  DashboardHero,
  DashboardLoadingState,
  DashboardMetricCard,
  DashboardPanel,
  DashboardSection,
  DashboardSectionLoading,
  DashboardShell,
  DashboardStatsGrid,
  dashboardMetaBadgeClass,
  dashboardTabsContentClass,
  dashboardTabsListClass,
  getDashboardTabsTriggerClass,
} from '@/components/dashboard/dashboard-shell';
import { WILAYAS, USER_ROLES, PARCEL_STATUS, RELAIS_STATUS } from '@/lib/constants';
import { parseLocaleFloat } from '@/lib/utils';
import { Users, Package, Truck, Store, DollarSign, CheckCircle, XCircle, Loader2, Plus, Settings, BarChart3, MapPin, Trash2, Pencil, Eye, EyeOff, AlertCircle, ScrollText, RefreshCw, ChevronDown, ChevronRight, Award, PlayCircle, Mail, MailOpen, Reply, Inbox, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Helper function to get the correct dashboard path based on role
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

function getArrivalReliabilityBadge(score: number) {
  if (score >= 90) {
    return { label: 'Fiabilité arrivée: Excellente', className: 'bg-emerald-600 text-white' };
  }
  if (score >= 75) {
    return { label: 'Fiabilité arrivée: À surveiller', className: 'bg-orange-500 text-white' };
  }
  return { label: 'Fiabilité arrivée: Critique', className: 'bg-red-600 text-white' };
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      const correctPath = getRoleBasedDashboardPath(session.user.role, locale);
      router.push(correctPath);
    }
  }, [status, session, router, locale]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchStats();
      void fetchUnreadMessagesCount();
    }
  }, [session?.user?.role]);

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') return;

    const interval = setInterval(() => {
      void fetchUnreadMessagesCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [session?.user?.role]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stats');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        console.error('fetchStats error', response.status);
        return;
      }
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadMessagesCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messages?filter=unread&page=1');
      if (!res.ok) return;
      const data = await res.json();
      setUnreadMessagesCount(typeof data?.total === 'number' ? data.total : 0);
    } catch {
      // Ignore transient failures; MessagesTab can still refresh this count.
    }
  }, []);

  if (status === 'loading' || isLoading) {
    return <DashboardLoadingState tone="admin" title="Chargement du cockpit admin" />;
  }

  if (!session?.user || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#f8fafc,_#ecfdf5_42%,_#ecfeff_100%)] dark:bg-slate-900">
      <Header />
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <DashboardShell tone="admin" className="mx-auto max-w-[92rem]">
          <DashboardHero
            tone="admin"
            eyebrow="Centre de pilotage"
            title="Administration SwiftColis"
            description="Surveillez la plateforme, arbitrez les flux sensibles et pilotez les opérations depuis une interface plus nette, plus dense et plus lisible."
            meta={
              <>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>Connecté: {session?.user?.name}</Badge>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>{stats?.counts?.pendingRelais || 0} relais à valider</Badge>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>{stats?.counts?.pendingTransporters || 0} transporteurs à valider</Badge>
              </>
            }
          />

          <DashboardSection
            tone="admin"
            eyebrow="Vue management"
            title="KPI plateforme"
            description="Distinguez en un regard le volume, les validations en attente et la santé business globale."
          >
            <DashboardStatsGrid className="xl:grid-cols-6">
              <DashboardMetricCard tone="admin" label="Utilisateurs" value={stats?.counts?.users || 0} icon={<Users className="h-5 w-5" />} />
              <DashboardMetricCard tone="admin" label="Colis" value={stats?.counts?.parcels || 0} icon={<Package className="h-5 w-5" />} />
              <DashboardMetricCard tone="admin" label="Transporteurs" value={stats?.counts?.transporters || 0} icon={<Truck className="h-5 w-5" />} detail={stats?.counts?.pendingTransporters > 0 ? `${stats.counts.pendingTransporters} en attente` : 'Aucun dossier en attente'} />
              <DashboardMetricCard tone="admin" label="Points relais" value={stats?.counts?.relais || 0} icon={<Store className="h-5 w-5" />} detail={stats?.counts?.pendingRelais > 0 ? `${stats.counts.pendingRelais} en attente` : 'Aucun dossier en attente'} />
              <DashboardMetricCard tone="admin" label="Messages non lus" value={unreadMessagesCount} icon={<Inbox className="h-5 w-5" />} detail="support et moderation" />
              <DashboardMetricCard tone="admin" label="Revenus" value={`${(stats?.revenue || 0).toFixed(0)} DA`} icon={<DollarSign className="h-5 w-5" />} />
            </DashboardStatsGrid>
          </DashboardSection>

          <DashboardSection
            tone="admin"
            eyebrow="Modules"
            title="Espace de travail"
            description="Naviguez entre les domaines opérationnels sans perdre de contexte."
            contentClassName="bg-transparent p-0 border-0 shadow-none ring-0"
          >
            <DashboardPanel tone="admin">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="mb-6 overflow-x-auto pb-1 md:overflow-visible md:pb-0">
                  <TabsList className={`${dashboardTabsListClass} mb-0 inline-flex h-auto w-max min-w-full flex-nowrap md:w-full md:min-w-0 md:flex-wrap`}>
                  <TabsTrigger value="overview" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><BarChart3 className="h-4 w-4 mr-2" />Vue d'ensemble</TabsTrigger>
                  <TabsTrigger value="users" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><Users className="h-4 w-4 mr-2" />Utilisateurs</TabsTrigger>
                  <TabsTrigger value="parcels" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><Package className="h-4 w-4 mr-2" />Colis</TabsTrigger>
                  <TabsTrigger value="relays" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><Store className="h-4 w-4 mr-2" />Relais</TabsTrigger>
                  <TabsTrigger value="transporters" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}>
                    <Truck className="h-4 w-4 mr-2" />
                    Transporteurs
                    {stats?.counts?.pendingTransporters > 0 && (
                      <Badge className="ml-2 bg-orange-500 px-1.5 py-0 text-[10px] text-white">{stats.counts.pendingTransporters}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="lines" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><MapPin className="h-4 w-4 mr-2" />Lignes</TabsTrigger>
                  <TabsTrigger value="loyalty" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><Award className="h-4 w-4 mr-2" />Fidélité</TabsTrigger>
                  <TabsTrigger value="audit" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><ScrollText className="h-4 w-4 mr-2" />Audit</TabsTrigger>
                  <TabsTrigger value="disputes" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><AlertCircle className="h-4 w-4 mr-2" />Litiges</TabsTrigger>
                  <TabsTrigger value="messages" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}>
                    <Inbox className="h-4 w-4 mr-2" />
                    Messages
                    {unreadMessagesCount > 0 && (
                      <Badge className="ml-2 bg-red-500 px-1.5 py-0 text-[10px] text-white">{unreadMessagesCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="settings" className={`${getDashboardTabsTriggerClass('admin')} shrink-0 whitespace-nowrap`}><Settings className="h-4 w-4 mr-2" />Paramètres</TabsTrigger>
                  </TabsList>
                </div>

              <TabsContent value="overview" className={dashboardTabsContentClass}>
                <OverviewTab stats={stats} setActiveTab={setActiveTab} />
              </TabsContent>
              <TabsContent value="users" className={dashboardTabsContentClass}>
                <UsersTab />
              </TabsContent>
              <TabsContent value="parcels" className={dashboardTabsContentClass}>
                <ParcelsTab />
              </TabsContent>
              <TabsContent value="relays" className={dashboardTabsContentClass}>
                <RelaysTab />
              </TabsContent>
               <TabsContent value="transporters" className={dashboardTabsContentClass}>
                 <TransportersTab />
               </TabsContent>
              <TabsContent value="lines" className={dashboardTabsContentClass}>
                <LinesTab />
              </TabsContent>
              <TabsContent value="loyalty" className={dashboardTabsContentClass}>
                <LoyaltyTab />
              </TabsContent>
              <TabsContent value="audit" className={dashboardTabsContentClass}>
                <AuditTab />
              </TabsContent>
              <TabsContent value="disputes" className={dashboardTabsContentClass}>
                <DisputesTab />
              </TabsContent>
              <TabsContent value="messages" className={dashboardTabsContentClass}>
                <MessagesTab onUnreadCountChange={setUnreadMessagesCount} />
              </TabsContent>
                <TabsContent value="settings" className={dashboardTabsContentClass}>
                  <SettingsTab stats={stats} />
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
function OverviewTab({ stats, setActiveTab }: { stats: any; setActiveTab: (tab: string) => void }) {
  const visibleParcelsByStatus = (stats?.parcelsByStatus || []).filter((item: any) => item.status !== 'PAID');
  const recentVisibleParcels = (stats?.recentParcels || []).filter((p: any) => p.status !== 'PAID');

  const statusCounts = visibleParcelsByStatus.reduce((acc: Record<string, number>, item: any) => {
    acc[item.status] = item.count;
    return acc;
  }, {});

  const createdCount =
    (statusCounts.CREATED || 0) +
    (statusCounts.PAID_RELAY || 0);

  const inTransitCount =
    (statusCounts.DEPOSITED_RELAY || 0) +
    (statusCounts.RECU_RELAIS || 0) +
    (statusCounts.EN_TRANSPORT || 0) +
    (statusCounts.ARRIVE_RELAIS_DESTINATION || 0);

  const deliveredCount = statusCounts.LIVRE || 0;
  const totalParcels = stats?.counts?.parcels || 0;
  const classifiedCount = createdCount + inTransitCount + deliveredCount;
  const otherCount = Math.max(totalParcels - classifiedCount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Synthèse colis</CardTitle>
          <CardDescription>Créés + en transit + livrés + autres = total colis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">Créés</p>
                <Package className="h-4 w-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold mt-1">{createdCount}</p>
            </div>
            <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">En transit</p>
                <Truck className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-2xl font-bold mt-1">{inTransitCount}</p>
            </div>
            <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">Livrés</p>
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold mt-1">{deliveredCount}</p>
            </div>
            <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">Autres</p>
                <AlertCircle className="h-4 w-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold mt-1">{otherCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colis par statut</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {visibleParcelsByStatus.length > 0 ? (
              visibleParcelsByStatus.map((item: any) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-sm">{PARCEL_STATUS.find(s => s.id === item.status)?.label || item.status}</span>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))
            ) : (
              <DashboardEmptyState icon={<Package className="h-5 w-5" />} title="Aucun colis" description="Les statuts apparaîtront ici dès la première activité." />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Villes les plus desservies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.parcelsByCity?.length > 0 ? (
              stats.parcelsByCity.map((item: any) => (
                <div key={item.city} className="flex items-center justify-between">
                  <span className="text-sm">{WILAYAS.find(w => w.id === item.city)?.name || item.city}</span>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))
            ) : (
              <DashboardEmptyState icon={<MapPin className="h-5 w-5" />} title="Aucune donnée géographique" description="Les villes actives seront listées après les premiers flux." />
            )}
          </div>
        </CardContent>
      </Card>

      {stats?.counts?.pendingRelais > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 lg:col-span-2">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                <Store className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{stats.counts.pendingRelais} demandes de relais en attente</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Consultez l'onglet Relais pour les valider</p>
              </div>
              <Button onClick={() => setActiveTab('relays')}>Valider</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Button variant="outline" className="justify-start" onClick={() => setActiveTab('users')}><Users className="h-4 w-4 mr-2" />Gérer utilisateurs</Button>
            <Button variant="outline" className="justify-start" onClick={() => setActiveTab('parcels')}><Package className="h-4 w-4 mr-2" />Voir colis</Button>
            <Button variant="outline" className="justify-start" onClick={() => setActiveTab('relays')}><Store className="h-4 w-4 mr-2" />Valider relais</Button>
            <Button variant="outline" className="justify-start" onClick={() => setActiveTab('lines')}><MapPin className="h-4 w-4 mr-2" />Configurer tarifs</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colis récents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentVisibleParcels.length > 0 ? (
              recentVisibleParcels.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono">{p.trackingNumber}</span>
                    <span className="text-slate-500 ml-2">{p.client?.name || 'N/A'}</span>
                  </div>
                  <Badge variant="outline">{PARCEL_STATUS.find(s => s.id === p.status)?.label || p.status}</Badge>
                </div>
              ))
            ) : (
              <DashboardEmptyState icon={<Clock className="h-5 w-5" />} title="Aucun colis récent" description="Les derniers mouvements apparaîtront ici en temps réel." />
            )}
          </div>
        </CardContent>
      </Card>

      <MatchingAutoAssignPanel />
    </div>
  );
}

// Users Tab
function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch users');
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      toast({
        title: 'Erreur chargement utilisateurs',
        description: error instanceof Error ? error.message : 'Impossible de charger les utilisateurs',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!editUser) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editUser.name,
          phone: editUser.phone,
          email: editUser.email,
          address: editUser.address,
          isActive: editUser.isActive,
          clientType: editUser.clientType,
        }),
      });
      if (response.ok) {
        toast({ title: 'Utilisateur modifié' });
        setEditUser(null);
        fetchUsers();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de modifier l\'utilisateur', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePro = async (userId: string, currentType: string) => {
    const newType = currentType === 'PRO' ? 'STANDARD' : 'PRO';
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientType: newType }),
      });
      if (response.ok) {
        toast({ title: `Client ${newType === 'PRO' ? 'passé en PRO' : 'repassé en STANDARD'}` });
        fetchUsers();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de modifier le type client', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${deleteUserId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast({ title: 'Utilisateur supprimé' });
        setDeleteUserId(null);
        fetchUsers();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de supprimer l\'utilisateur', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const filteredUsers = filter === 'all' ? safeUsers : safeUsers.filter(u => u.role === filter);

  const getWilayaName = (value?: string | null) => {
    if (!value) return null;
    return WILAYAS.find((wilaya) => wilaya.id === value)?.name || value;
  };

  const getApprovalStatusLabel = (value?: string | null) => {
    switch (value) {
      case 'APPROVED':
        return 'Approuvé';
      case 'REJECTED':
        return 'Refusé';
      case 'PENDING':
        return 'En attente';
      default:
        return value || null;
    }
  };

  const normalizeAddressLine = (value?: unknown) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  };

  const getAddressLines = (user: any) => {
    if (user.role === 'RELAIS') {
      if (!user.relais) {
        return [
          user.isActive
            ? 'Candidature relais non finalisée'
            : 'Compte relais créé - email non vérifié',
        ];
      }
      return [normalizeAddressLine(user.relais?.address), normalizeAddressLine(getWilayaName(user.relais?.ville))].filter(Boolean);
    }

    if (user.role === 'ENSEIGNE') {
      if (!user.enseigne) {
        return [
          user.isActive
            ? 'Profil enseigne non finalisé'
            : 'Compte enseigne créé - email non vérifié',
        ];
      }
      return [normalizeAddressLine(user.address), normalizeAddressLine(getWilayaName(user.enseigne?.operationalCity))].filter(Boolean);
    }

    return [normalizeAddressLine(user.address)].filter(Boolean);
  };

  const getRoleDetails = (user: any) => {
    if (user.role === 'RELAIS') {
      return {
        title: user.relais?.commerceName || 'Point relais',
        meta: [getApprovalStatusLabel(user.relais?.status), user.relais?.operationalStatus].filter(Boolean),
      };
    }

    if (user.role === 'ENSEIGNE') {
      return {
        title: user.enseigne?.businessName || 'Enseigne',
        meta: [user.enseigne?.billingEmail, getWilayaName(user.enseigne?.operationalCity)].filter(Boolean),
      };
    }

    if (user.role === 'TRANSPORTER') {
      return {
        title: user.transporterApplication?.vehicle || 'Transporteur',
        meta: [getApprovalStatusLabel(user.transporterApplication?.status), user.siret].filter(Boolean),
      };
    }

    if (user.role === 'CLIENT') {
      return {
        title: user.clientType === 'PRO' ? 'Client professionnel' : 'Client particulier',
        meta: [user.siret].filter(Boolean),
      };
    }

    return {
      title: USER_ROLES.find((role) => role.id === user.role)?.label || user.role,
      meta: [user.siret].filter(Boolean),
    };
  };

  const renderAddressLine = (line: string, className: string, key: string) => {
    const maxChars = 72;
    if (line.length <= maxChars) {
      return (
        <p key={key} className={className}>
          {line}
        </p>
      );
    }

    const truncated = `${line.slice(0, maxChars - 1)}...`;
    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <p className={`${className} cursor-help`} title={line}>
            {truncated}
          </p>
        </TooltipTrigger>
        <TooltipContent className="max-w-md break-words text-xs">
          {line}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestion des utilisateurs</CardTitle>
              <CardDescription>{safeUsers.length} utilisateurs inscrits</CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {USER_ROLES.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DashboardSectionLoading label="Chargement des utilisateurs..." />
          ) : (
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Inscription</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{user.name}</p>
                        {getRoleDetails(user).title && getRoleDetails(user).title !== user.name ? (
                          <p className="text-xs text-slate-500">{getRoleDetails(user).title}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <div className="space-y-1 text-sm">
                        <p className="break-all">{user.email}</p>
                        <p className="text-xs text-slate-500">{user.phone || 'Téléphone non renseigné'}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{USER_ROLES.find(r => r.id === user.role)?.label || user.role}</Badge></TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <div className="space-y-1 text-sm max-w-sm">
                        {getAddressLines(user).length > 0 ? (
                          getAddressLines(user).map((line, index) => (
                            renderAddressLine(
                              String(line),
                              `${index === 0 ? 'text-slate-900 dark:text-slate-100' : 'text-xs text-slate-500'} break-words`,
                              `${user.id}-address-${index}`,
                            )
                          ))
                        ) : (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-300">Adresse non renseignée</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                        {getRoleDetails(user).meta.map((detail: string, index: number) => (
                          <p key={`${user.id}-meta-${index}`} className="text-xs text-slate-500">{detail}</p>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role === 'CLIENT' ? (
                        <button
                          onClick={() => handleTogglePro(user.id, user.clientType || 'STANDARD')}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${
                            user.clientType === 'PRO'
                              ? 'bg-violet-600 text-white hover:bg-violet-700'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          title={user.clientType === 'PRO' ? 'Révoquer le statut PRO' : 'Passer en PRO'}
                        >
                          {user.clientType === 'PRO' ? '★ PRO' : 'STANDARD'}
                        </button>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-xs text-slate-400">—</span>
                          {user.siret ? <p className="text-xs text-slate-500">RC: {user.siret}</p> : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditUser(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleteUserId(user.id)} disabled={user.role === 'ADMIN'}>
                          <Trash2 className="h-4 w-4" />
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

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={editUser.phone || ''} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Textarea
                  value={editUser.address || ''}
                  onChange={(e) => setEditUser({ ...editUser, address: e.target.value })}
                  placeholder="Adresse complète"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={editUser.isActive} onChange={(e) => setEditUser({ ...editUser, isActive: e.target.checked })} />
                <Label htmlFor="isActive">Compte actif</Label>
              </div>
              {editUser.role === 'CLIENT' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPro"
                    checked={editUser.clientType === 'PRO'}
                    onChange={(e) => setEditUser({ ...editUser, clientType: e.target.checked ? 'PRO' : 'STANDARD' })}
                  />
                  <Label htmlFor="isPro">Client professionnel (PRO)</Label>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button onClick={handleEditUser} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Transporters Tab
function TransportersTab() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchApplications(); }, []);

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/transporters');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(`HTTP ${response.status}`);
      }
      setApplications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching transporter applications:', error);
      setApplications([]);
      toast({ title: 'Erreur', description: 'Impossible de charger les dossiers transporteurs', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async (applicationId: string, action: 'approve' | 'reject') => {
    setProcessingId(applicationId);
    try {
      const response = await fetch('/api/admin/transporters/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          action,
          reason: action === 'reject' ? (rejectReasons[applicationId] || undefined) : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Erreur lors de la validation');

      const nextStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
      setApplications((prev) => prev.map((app) => (
        app.id === applicationId
          ? { ...app, status: nextStatus }
          : app
      )));
      setFilter(nextStatus);
      setRejectReasons((prev) => {
        const next = { ...prev };
        delete next[applicationId];
        return next;
      });

      toast({
        title: action === 'approve' ? 'Dossier approuvé' : 'Dossier rejeté',
        description: data?.message || 'La décision a été enregistrée. Le filtre a été mis à jour pour afficher ce dossier.',
      });
      void fetchApplications();
    } catch (error) {
      toast({ title: 'Erreur', description: error instanceof Error ? error.message : 'Impossible de traiter le dossier', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const parseDocuments = (raw: string | null | undefined): Array<{ url: string; filename: string; size: number }> => {
    if (!raw) return [];
    try { return JSON.parse(raw) || []; } catch { return []; }
  };

  const parseRegions = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    try { return JSON.parse(raw) || []; } catch { return []; }
  };

  const filtered = filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  const emptyStateMessage = (() => {
    if (filter === 'PENDING') return 'Aucun dossier en attente. Passez sur Approuvés ou Tous pour revoir les dossiers traités.';
    if (filter === 'APPROVED') return 'Aucun dossier approuvé pour le moment.';
    if (filter === 'REJECTED') return 'Aucun dossier rejeté pour le moment.';
    return 'Aucun dossier à afficher.';
  })();

  const statusBadge = (status: string) => {
    if (status === 'APPROVED') return <Badge className="bg-emerald-600 text-white">Approuvé</Badge>;
    if (status === 'REJECTED') return <Badge className="bg-red-600 text-white">Rejeté</Badge>;
    return <Badge className="bg-amber-500 text-white">En attente</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Dossiers transporteurs</CardTitle>
              <CardDescription>Examinez et validez les candidatures des transporteurs (RC, véhicule, permis, documents)</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">En attente</SelectItem>
                  <SelectItem value="APPROVED">Approuvés</SelectItem>
                  <SelectItem value="REJECTED">Rejetés</SelectItem>
                  <SelectItem value="all">Tous</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchApplications} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />Actualiser
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DashboardSectionLoading label="Chargement des dossiers transporteurs..." />
          ) : filtered.length === 0 ? (
            <DashboardEmptyState icon={<Truck className="h-5 w-5" />} title="Aucun dossier" description={emptyStateMessage} />
          ) : (
            <div className="space-y-4">
              {filtered.map((app) => {
                const docs = parseDocuments(app.documents);
                const regions = parseRegions(app.regions);
                const isProcessing = processingId === app.id;
                const docsExpanded = expandedDocs[app.id];

                return (
                  <div key={app.id} className="rounded-xl border p-4 space-y-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-lg">{app.fullName}</p>
                          {statusBadge(app.status)}
                          {docs.length > 0 ? (
                            <Badge variant="outline">{docs.length} doc{docs.length > 1 ? 's' : ''}</Badge>
                          ) : (
                            <Badge className="bg-orange-500 text-white">Sans document</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{app.user?.email} - {app.phone}</p>
                        <div className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <span>RC: <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{app.user?.siret || '-'}</span></span>
                          <span>·</span>
                          <span>Véhicule: <strong>{app.vehicle}</strong></span>
                          <span>·</span>
                          <span>Permis: <strong>{app.license}</strong></span>
                          <span>·</span>
                          <span>Expérience: <strong>{app.experience} an{app.experience > 1 ? 's' : ''}</strong></span>
                        </div>
                        {regions.length > 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Régions: {regions.join(', ')}</p>}
                        {app.description && <p className="text-sm italic text-slate-500">{app.description}</p>}
                        <p className="text-xs text-slate-400">Dossier soumis le {new Date(app.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      </div>

                      {app.status === 'PENDING' && (
                        <div className="flex flex-col gap-2 min-w-[260px]">
                          <Textarea
                            placeholder="Motif de refus (optionnel)"
                            value={rejectReasons[app.id] || ''}
                            onChange={(e) => setRejectReasons((prev) => ({ ...prev, [app.id]: e.target.value }))}
                            rows={2}
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleValidate(app.id, 'approve')} disabled={isProcessing}>
                              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                              Approuver
                            </Button>
                            <Button variant="destructive" className="flex-1" onClick={() => handleValidate(app.id, 'reject')} disabled={isProcessing}>
                              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                              Rejeter
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {docs.length > 0 && (
                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                          onClick={() => setExpandedDocs((prev) => ({ ...prev, [app.id]: !docsExpanded }))}
                        >
                          {docsExpanded ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                          {docsExpanded ? 'Masquer' : 'Voir'} les documents ({docs.length})
                        </Button>
                        {docsExpanded && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {docs.map((doc, idx) => (
                              <a
                                key={idx}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {doc.filename}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Parcels Tab
function ParcelsTab() {
  const [colis, setColis] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchColis(); }, []);

  const fetchColis = async () => {
    try {
      const response = await fetch('/api/parcels');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch parcels');
      }
      setColis(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching parcels:', error);
      setColis([]);
    } finally {
      setIsLoading(false);
    }
  };

  const visibleStatusOptions = PARCEL_STATUS.filter((s) => s.id !== 'PAID');
  const safeColis = (Array.isArray(colis) ? colis : []).filter((c) => c.status !== 'PAID');
  const filteredColis = filter === 'all' ? safeColis : safeColis.filter(c => c.status === filter);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestion des colis</CardTitle>
            <CardDescription>{safeColis.length} colis au total</CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {visibleStatusOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <DashboardSectionLoading label="Chargement des colis..." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Suivi</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Poids</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColis.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-medium">{c.trackingNumber}</TableCell>
                  <TableCell>{c.client?.name || '-'}</TableCell>
                  <TableCell>{WILAYAS.find(w => w.id === c.villeDepart)?.name || c.villeDepart}</TableCell>
                  <TableCell>{WILAYAS.find(w => w.id === c.villeArrivee)?.name || c.villeArrivee}</TableCell>
                  <TableCell>{c.weight ? `${c.weight} kg` : '—'}</TableCell>
                  <TableCell>{c.prixClient} DA</TableCell>
                  <TableCell>
                    <Badge className={PARCEL_STATUS.find(s => s.id === c.status)?.color || 'bg-gray-500'}>{PARCEL_STATUS.find(s => s.id === c.status)?.label || c.status}</Badge>
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

// Relays Tab
function RelaysTab() {
  const { toast } = useToast();
  const [relais, setRelais] = useState<any[]>([]);
  const [trackingRelais, setTrackingRelais] = useState<any[]>([]);
  const [trackingTotals, setTrackingTotals] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrackingLoading, setIsTrackingLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [trackingSort, setTrackingSort] = useState('reliabilityScore');
  const [trackingFilter, setTrackingFilter] = useState('ALL');
  const [editRelais, setEditRelais] = useState<any>(null);
  const [deleteRelaisId, setDeleteRelaisId] = useState<string | null>(null);
  const [suspensionReasons, setSuspensionReasons] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isComplianceProcessing, setIsComplianceProcessing] = useState(false);
  const [isAuditRunning, setIsAuditRunning] = useState(false);
  const [cashPickups, setCashPickups] = useState<any[]>([]);
  const [isCashPickupsLoading, setIsCashPickupsLoading] = useState(true);
  const [pickupFilter, setPickupFilter] = useState('ALL');
  const [pickupCollectors, setPickupCollectors] = useState<Record<string, string>>({});
  const [pickupAmounts, setPickupAmounts] = useState<Record<string, string>>({});
  const [pickupRelayCodes, setPickupRelayCodes] = useState<Record<string, string>>({});
  const [pickupCollectorCodes, setPickupCollectorCodes] = useState<Record<string, string>>({});
  const [pickupSchedules, setPickupSchedules] = useState<Record<string, string>>({});

  useEffect(() => { fetchRelais(); }, []);
  useEffect(() => { fetchTracking(); }, [trackingSort, trackingFilter]);
  useEffect(() => { fetchCashPickups(); }, [pickupFilter]);

  const fetchRelais = async () => {
    try {
      const response = await fetch('/api/relais');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch relais');
      }
      setRelais(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching relais:', error);
      setRelais([]);
      toast({
        title: 'Erreur chargement relais',
        description: error instanceof Error ? error.message : 'Impossible de charger les points relais',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTracking = async () => {
    setIsTrackingLoading(true);
    try {
      const response = await fetch(`/api/admin/relais-tracking?sortBy=${trackingSort}&filterStatus=${trackingFilter}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch relais tracking');
      }
      setTrackingRelais(Array.isArray(data?.relais) ? data.relais : []);
      setTrackingTotals(data?.totals || null);
    } catch (error) {
      console.error('Error fetching relais tracking:', error);
      setTrackingRelais([]);
      setTrackingTotals(null);
      toast({
        title: 'Erreur suivi relais',
        description: error instanceof Error ? error.message : 'Impossible de charger le suivi des points relais',
        variant: 'destructive',
      });
    } finally {
      setIsTrackingLoading(false);
    }
  };

  const fetchCashPickups = async () => {
    setIsCashPickupsLoading(true);
    try {
      const query = pickupFilter !== 'ALL' ? `?status=${pickupFilter}` : '';
      const response = await fetch(`/api/admin/cash-pickups${query}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch cash pickups');
      }
      setCashPickups(Array.isArray(data?.pickups) ? data.pickups : []);
    } catch (error) {
      console.error('Error fetching cash pickups:', error);
      setCashPickups([]);
      toast({
        title: 'Erreur collectes cash',
        description: error instanceof Error ? error.message : 'Impossible de charger les collectes cash',
        variant: 'destructive',
      });
    } finally {
      setIsCashPickupsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/relais/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible d\'approuver le relais');
      }
      setFilter('APPROVED');
      toast({ title: 'Relais approuvé', description: 'La validation a été enregistrée.' });
      fetchRelais();
      fetchTracking();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'approuver le relais',
        variant: 'destructive',
      });
    }
  };

  const handleApproveTrial = async (id: string) => {
    try {
      const response = await fetch(`/api/relais/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', trialMode: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible d\'approuver le relais en essai');
      }
      setFilter('APPROVED');
      toast({
        title: 'Relais approuvé en essai',
        description: 'Période d\'essai activée (quota journalier appliqué).',
      });
      fetchRelais();
      fetchTracking();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'approuver le relais en essai',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/relais/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de rejeter le relais');
      }
      toast({ title: 'Relais rejeté', description: 'La décision a été enregistrée.' });
      fetchRelais();
      fetchTracking();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de rejeter le relais',
        variant: 'destructive',
      });
    }
  };

  const handleEditRelais = async () => {
    if (!editRelais) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/relais/${editRelais.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commerceName: editRelais.commerceName,
          address: editRelais.address,
          ville: editRelais.ville,
          status: editRelais.status,
          operationalStatus: editRelais.operationalStatus || 'ACTIF',
          suspensionReason: (editRelais.operationalStatus || 'ACTIF') === 'SUSPENDU' ? editRelais.suspensionReason || 'Suspendu par un administrateur' : null,
        }),
      });
      if (response.ok) {
        toast({ title: 'Relais modifié' });
        setEditRelais(null);
        fetchRelais();
        fetchTracking();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de modifier le relais', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRelais = async () => {
    if (!deleteRelaisId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/relais/${deleteRelaisId}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast({ title: 'Relais supprimé', description: data?.message || 'Le point relais a été supprimé.' });
        setDeleteRelaisId(null);
        fetchRelais();
        fetchTracking();
      } else {
        throw new Error(data?.details || data?.error || 'Impossible de supprimer le relais');
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de supprimer le relais',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOperationalStatusChange = async (relaisId: string, operationalStatus: 'ACTIF' | 'SUSPENDU') => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/relais-tracking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relaisId,
          operationalStatus,
          suspensionReason: operationalStatus === 'SUSPENDU'
            ? (suspensionReasons[relaisId]?.trim() || 'Suspendu par un administrateur')
            : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de modifier le statut opérationnel');
      }
      toast({
        title: operationalStatus === 'SUSPENDU' ? 'Relais suspendu' : 'Relais réactivé',
        description: data?.message || 'Le statut opérationnel a été mis à jour.',
      });
      fetchTracking();
      fetchRelais();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de modifier le statut opérationnel',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessCompliance = async (relaisId?: string) => {
    try {
      setIsComplianceProcessing(true);
      const response = await fetch('/api/admin/compliance/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relaisId ? { relaisId } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de lancer le traitement conformité');
      }
      toast({
        title: 'Conformité recalculée',
        description: `${data?.processedCount || 0} relais traité(s).`,
      });
      fetchTracking();
    } catch (error) {
      toast({
        title: 'Erreur conformité',
        description: error instanceof Error ? error.message : 'Traitement conformité impossible',
        variant: 'destructive',
      });
    } finally {
      setIsComplianceProcessing(false);
    }
  };

  const handleRunMonthlyAudit = async () => {
    try {
      setIsAuditRunning(true);
      const response = await fetch('/api/admin/audit/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceAll: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de lancer l\'audit mensuel');
      }
      toast({
        title: 'Audit mensuel lancé',
        description: `${data?.auditedCount || 0} relais audité(s).`,
      });
      fetchTracking();
    } catch (error) {
      toast({
        title: 'Erreur audit',
        description: error instanceof Error ? error.message : 'Audit mensuel impossible',
        variant: 'destructive',
      });
    } finally {
      setIsAuditRunning(false);
    }
  };

  const handleAssignPickup = async (pickupId: string) => {
    try {
      setIsSaving(true);
      const collectorId = pickupCollectors[pickupId]?.trim();
      if (!collectorId) {
        throw new Error('collectorId requis');
      }

      const response = await fetch(`/api/admin/cash-pickups/${pickupId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectorId,
          scheduledAt: pickupSchedules[pickupId] || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible d\'assigner la collecte');
      }
      toast({ title: 'Collecte assignée' });
      fetchCashPickups();
    } catch (error) {
      toast({
        title: 'Erreur assignation',
        description: error instanceof Error ? error.message : 'Assignation impossible',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartPickup = async (pickupId: string) => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/admin/cash-pickups/${pickupId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de démarrer la collecte');
      }
      toast({ title: 'Collecte démarrée' });
      fetchCashPickups();
    } catch (error) {
      toast({
        title: 'Erreur démarrage',
        description: error instanceof Error ? error.message : 'Démarrage impossible',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPickup = async (pickupId: string) => {
    try {
      setIsSaving(true);
      const collectedAmount = Number(pickupAmounts[pickupId] || 0);
      const relayValidationCode = pickupRelayCodes[pickupId]?.trim();
      const collectorValidationCode = pickupCollectorCodes[pickupId]?.trim();

      if (!collectedAmount || collectedAmount <= 0) {
        throw new Error('Montant collecté requis');
      }
      if (!relayValidationCode || !collectorValidationCode) {
        throw new Error('Les deux codes de validation sont requis');
      }

      const response = await fetch(`/api/admin/cash-pickups/${pickupId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectedAmount,
          relayValidationCode,
          collectorValidationCode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de confirmer la collecte');
      }
      toast({ title: 'Collecte confirmée' });
      fetchCashPickups();
      fetchTracking();
    } catch (error) {
      toast({
        title: 'Erreur confirmation',
        description: error instanceof Error ? error.message : 'Confirmation impossible',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const safeRelais = Array.isArray(relais) ? relais : [];
  const dedupedRelais = Array.from(
    safeRelais.reduce((acc: Map<string, any>, current: any) => {
      const key = current.userId || current.id;
      const prev = acc.get(key);

      if (!prev) {
        acc.set(key, current);
        return acc;
      }

      const prevScore = (prev.status === 'APPROVED' ? 3 : prev.status === 'PENDING' ? 2 : 1);
      const currentScore = (current.status === 'APPROVED' ? 3 : current.status === 'PENDING' ? 2 : 1);
      if (currentScore > prevScore) {
        acc.set(key, current);
        return acc;
      }

      if (currentScore === prevScore) {
        const prevUpdatedAt = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
        const currentUpdatedAt = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
        if (currentUpdatedAt > prevUpdatedAt) {
          acc.set(key, current);
        }
      }

      return acc;
    }, new Map<string, any>()).values()
  );

  const getAssociatedParcelsCount = (relay: any) => {
    const departCount = Number(relay?._count?.parcelsDepart || 0);
    const arriveeCount = Number(relay?._count?.parcelsArrivee || 0);
    return departCount + arriveeCount;
  };

  const archivedRelais = dedupedRelais.filter((r) => r.operationalStatus === 'SUSPENDU');
  const activeRelais = dedupedRelais.filter((r) => r.operationalStatus !== 'SUSPENDU');
  const filteredRelais = filter === 'all'
    ? activeRelais
    : filter === 'ARCHIVED'
      ? archivedRelais
      : activeRelais.filter(r => r.status === filter);

  const fallbackTrackingRelais = activeRelais.map((r) => ({
    id: r.id,
    commerceName: r.commerceName,
    ville: r.ville,
    address: r.address,
    operationalStatus: r.operationalStatus || 'ACTIF',
    suspensionReason: r.suspensionReason || null,
    suspendedAt: r.suspendedAt || null,
    approvalStatus: r.status,
    cautionStatus: r.cautionStatus || 'PENDING',
    cautionAmount: r.cautionAmount || 0,
    trial: { isActive: false, daysRemaining: 0 },
    activeSanctionsCount: 0,
    trustLevel: 'good',
    contactName: r.user?.name || '-',
    phone: r.user?.phone || '-',
    email: r.user?.email || '-',
    metrics: {
      nbDeposites: Number(r?._count?.parcelsDepart || 0),
      nbLivres: Number(r?._count?.parcelsArrivee || 0),
      cashCollected: 0,
      cashReversed: 0,
      netCashCollected: 0,
      commissionRelaisTotal: 0,
      commissionPlateformeTotal: 0,
      amountToPay: 0,
      amountPaid: 0,
      nbDelayed: 0,
      reliabilityScore: 100,
      complianceScore: 100,
    },
    alerts: [],
  }));

  const effectiveTrackingRelais = trackingRelais.length > 0 ? trackingRelais : fallbackTrackingRelais;
  const effectiveTrackingTotals = trackingTotals || {
    totalRelais: effectiveTrackingRelais.length,
    actifRelais: effectiveTrackingRelais.filter((r: any) => r.operationalStatus === 'ACTIF').length,
    suspendedRelais: effectiveTrackingRelais.filter((r: any) => r.operationalStatus === 'SUSPENDU').length,
    totalCashCollected: effectiveTrackingRelais.reduce((sum: number, r: any) => sum + Number(r.metrics?.cashCollected || 0), 0),
    totalMoneyPending: effectiveTrackingRelais.reduce((sum: number, r: any) => sum + Number(r.metrics?.amountToPay || 0), 0),
    avgReliabilityScore: Math.round(
      effectiveTrackingRelais.reduce((sum: number, r: any) => sum + Number(r.metrics?.reliabilityScore || 0), 0) /
      Math.max(effectiveTrackingRelais.length, 1)
    ),
    avgComplianceScore: Math.round(
      effectiveTrackingRelais.reduce((sum: number, r: any) => sum + Number(r.metrics?.complianceScore || 0), 0) /
      Math.max(effectiveTrackingRelais.length, 1)
    ),
  };

  return (
    <>
      <div className="space-y-6 mb-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Suivi opérationnel des points relais</CardTitle>
                <CardDescription>Cash encaissé, commissions, retards, score de fiabilité et statut ACTIF / SUSPENDU</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={trackingSort} onValueChange={setTrackingSort}>
                  <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reliabilityScore">Trier par fiabilité</SelectItem>
                    <SelectItem value="moneyPending">Trier par montant dû</SelectItem>
                    <SelectItem value="delayCount">Trier par retards</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={trackingFilter} onValueChange={setTrackingFilter}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous</SelectItem>
                    <SelectItem value="ACTIF">Actifs</SelectItem>
                    <SelectItem value="SUSPENDU">Suspendus</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchTracking} disabled={isTrackingLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isTrackingLoading ? 'animate-spin' : ''}`} />Actualiser
                </Button>
                <Button variant="outline" onClick={() => handleProcessCompliance()} disabled={isComplianceProcessing}>
                  {isComplianceProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Recalcul conformité
                </Button>
                <Button onClick={handleRunMonthlyAudit} disabled={isAuditRunning} className="bg-emerald-600 hover:bg-emerald-700">
                  {isAuditRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Audit mensuel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-6">
              <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
                <p className="text-sm text-slate-600 dark:text-slate-400">Relais total</p>
                <p className="text-2xl font-bold mt-1">{effectiveTrackingTotals.totalRelais}</p>
              </div>
              <div className="rounded-lg border p-4 bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Actifs</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{effectiveTrackingTotals.actifRelais}</p>
              </div>
              <div className="rounded-lg border p-4 bg-red-50 dark:bg-red-950/20">
                <p className="text-sm text-red-700 dark:text-red-300">Suspendus</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{effectiveTrackingTotals.suspendedRelais}</p>
              </div>
              <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
                <p className="text-sm text-slate-600 dark:text-slate-400">Fiabilité moyenne</p>
                <p className="text-2xl font-bold mt-1">{effectiveTrackingTotals.avgReliabilityScore}%</p>
              </div>
              <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
                <p className="text-sm text-blue-700 dark:text-blue-300">Conformité moyenne</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{effectiveTrackingTotals.avgComplianceScore}%</p>
              </div>
              <div className="rounded-lg border p-4 bg-orange-50 dark:bg-orange-950/20">
                <p className="text-sm text-orange-700 dark:text-orange-300">Montant dû plateforme</p>
                <p className="text-2xl font-bold mt-1 text-orange-600">{(effectiveTrackingTotals.totalMoneyPending || 0).toFixed(0)} DA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard admin des relais</CardTitle>
            <CardDescription>Alertes auto, classement et pilotage opérationnel</CardDescription>
          </CardHeader>
          <CardContent>
            {isTrackingLoading ? (
              <DashboardSectionLoading label="Chargement du suivi relais..." />
            ) : effectiveTrackingRelais.length === 0 ? (
              <DashboardEmptyState icon={<Store className="h-5 w-5" />} title="Aucun relais à afficher" description="Les points relais suivis apparaîtront ici." />
            ) : (
              <div className="space-y-4">
                {effectiveTrackingRelais.map((relay) => (
                  <div key={relay.id} className="rounded-xl border p-4 space-y-4">
                    {(() => {
                      const arrivalReliability = getArrivalReliabilityBadge(relay.metrics?.complianceScore || 0);
                      return (
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-lg">{relay.commerceName}</p>
                          <Badge className={relay.operationalStatus === 'SUSPENDU' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}>
                            {relay.operationalStatus}
                          </Badge>
                          <Badge className={`${RELAIS_STATUS.find(s => s.id === relay.approvalStatus)?.color || 'bg-slate-500'} text-white`}>
                            {RELAIS_STATUS.find(s => s.id === relay.approvalStatus)?.label || relay.approvalStatus}
                          </Badge>
                          <Badge className={arrivalReliability.className}>{arrivalReliability.label}</Badge>
                          <Badge variant="outline">Score {relay.metrics?.reliabilityScore || 0}%</Badge>
                          <Badge variant="outline">Conformité {relay.metrics?.complianceScore || 0}%</Badge>
                          <Badge variant="outline">Caution {relay.cautionStatus || 'PENDING'}</Badge>
                          {relay.trial?.isActive && (
                            <Badge className="bg-amber-100 text-amber-700">
                              Essai: {relay.trial.daysRemaining}j restants
                            </Badge>
                          )}
                          {relay.activeSanctionsCount > 0 && (
                            <Badge className="bg-red-100 text-red-700">Sanctions actives: {relay.activeSanctionsCount}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 break-words">{relay.address}, {WILAYAS.find(w => w.id === relay.ville)?.name || relay.ville}</p>
                        <p className="text-xs text-slate-500">{relay.contactName || '-'} · {relay.phone || '-'} · {relay.email || '-'}</p>
                        {relay.alerts?.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {relay.alerts.map((alert: any, index: number) => (
                              <Badge key={`${relay.id}-${index}`} variant="outline" className={alert.level === 'critical' ? 'border-red-300 text-red-700' : 'border-orange-300 text-orange-700'}>
                                <AlertCircle className="h-3 w-3 mr-1" />{alert.message}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 min-w-[280px]">
                        <Button variant="outline" onClick={() => handleProcessCompliance(relay.id)} disabled={isComplianceProcessing}>
                          {isComplianceProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Appliquer règles
                        </Button>
                        {relay.operationalStatus === 'SUSPENDU' ? (
                          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleOperationalStatusChange(relay.id, 'ACTIF')} disabled={isSaving}>
                            <CheckCircle className="h-4 w-4 mr-2" />Réactiver
                          </Button>
                        ) : (
                          <>
                            <Input
                              placeholder="Raison de suspension"
                              value={suspensionReasons[relay.id] || ''}
                              onChange={(e) => setSuspensionReasons((prev) => ({ ...prev, [relay.id]: e.target.value }))}
                            />
                            <Button variant="destructive" onClick={() => handleOperationalStatusChange(relay.id, 'SUSPENDU')} disabled={isSaving}>
                              <XCircle className="h-4 w-4 mr-2" />Suspendre
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                      );
                    })()}

                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Colis déposés</p><p className="text-xl font-bold">{relay.metrics?.nbDeposites || 0}</p></div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Colis livrés</p><p className="text-xl font-bold text-emerald-600">{relay.metrics?.nbLivres || 0}</p></div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Cash encaissé</p><p className="text-xl font-bold">{(relay.metrics?.cashCollected || 0).toFixed(0)} DA</p></div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Commission relais</p><p className="text-xl font-bold text-emerald-600">{(relay.metrics?.commissionRelaisTotal || 0).toFixed(0)} DA</p></div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Montant dû plateforme</p><p className="text-xl font-bold text-orange-600">{(relay.metrics?.amountToPay || 0).toFixed(0)} DA</p></div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Montant déjà versé</p><p className="text-xl font-bold">{(relay.metrics?.amountPaid || 0).toFixed(0)} DA</p></div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400">Retards</span><Badge variant="outline">{relay.metrics?.nbDelayed || 0}</Badge></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3">
                          <div className={`h-2 rounded-full ${(relay.metrics?.nbDelayed || 0) > 3 ? 'bg-red-500' : (relay.metrics?.nbDelayed || 0) > 0 ? 'bg-orange-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(((relay.metrics?.nbDelayed || 0) / 10) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400">Score de fiabilité</span><Badge variant="outline">{relay.metrics?.reliabilityScore || 0}%</Badge></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3">
                          <div className={`h-2 rounded-full ${(relay.metrics?.reliabilityScore || 0) >= 95 ? 'bg-emerald-500' : (relay.metrics?.reliabilityScore || 0) >= 80 ? 'bg-orange-400' : 'bg-red-500'}`} style={{ width: `${Math.min(relay.metrics?.reliabilityScore || 0, 100)}%` }} />
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-600 dark:text-slate-400">Score conformité</span><Badge variant="outline">{relay.metrics?.complianceScore || 0}%</Badge></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3">
                          <div className={`h-2 rounded-full ${(relay.metrics?.complianceScore || 0) >= 90 ? 'bg-emerald-500' : (relay.metrics?.complianceScore || 0) >= 75 ? 'bg-orange-400' : 'bg-red-500'}`} style={{ width: `${Math.min(relay.metrics?.complianceScore || 0, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Collectes cash physiques</CardTitle>
                <CardDescription>Demandes de récupération du cash directement dans les points relais</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={pickupFilter} onValueChange={setPickupFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les statuts</SelectItem>
                    <SelectItem value="REQUESTED">Demandées</SelectItem>
                    <SelectItem value="ASSIGNED">Assignées</SelectItem>
                    <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmées</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchCashPickups} disabled={isCashPickupsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isCashPickupsLoading ? 'animate-spin' : ''}`} />Actualiser
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isCashPickupsLoading ? (
              <DashboardSectionLoading label="Chargement des collectes cash..." />
            ) : cashPickups.length === 0 ? (
              <DashboardEmptyState icon={<DollarSign className="h-5 w-5" />} title="Aucune collecte cash" description="Les opérations de collecte apparaîtront ici." />
            ) : (
              <div className="space-y-4">
                {cashPickups.map((pickup) => (
                  <div key={pickup.id} className="rounded-xl border p-4 space-y-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{pickup.relais?.commerceName || 'Relais'}</p>
                          <Badge variant="outline">{pickup.status}</Badge>
                          <Badge className="bg-orange-100 text-orange-700">Attendu {Number(pickup.expectedAmount || 0).toFixed(0)} DA</Badge>
                          {pickup.collectedAmount ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Collecté {Number(pickup.collectedAmount || 0).toFixed(0)} DA</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{pickup.relais?.address}, {WILAYAS.find(w => w.id === pickup.relais?.ville)?.name || pickup.relais?.ville}</p>
                        <p className="text-xs text-slate-500 mt-1">Créée le {new Date(pickup.createdAt).toLocaleString('fr-FR')}</p>
                      </div>
                      <div className="text-sm text-slate-500">
                        {pickup.receiptRef ? <span>Reçu: {pickup.receiptRef}</span> : null}
                      </div>
                    </div>

                    {(pickup.status === 'REQUESTED' || pickup.status === 'ASSIGNED') && (
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input
                          placeholder="ID collecteur"
                          value={pickupCollectors[pickup.id] || ''}
                          onChange={(e) => setPickupCollectors((prev) => ({ ...prev, [pickup.id]: e.target.value }))}
                        />
                        <Input
                          type="datetime-local"
                          value={pickupSchedules[pickup.id] || ''}
                          onChange={(e) => setPickupSchedules((prev) => ({ ...prev, [pickup.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => handleAssignPickup(pickup.id)} disabled={isSaving}>Assigner</Button>
                          <Button onClick={() => handleStartPickup(pickup.id)} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">Démarrer</Button>
                        </div>
                      </div>
                    )}

                    {pickup.status === 'IN_PROGRESS' && (
                      <div className="grid gap-3 md:grid-cols-4">
                        <Input
                          type="number"
                          placeholder="Montant collecté"
                          value={pickupAmounts[pickup.id] || ''}
                          onChange={(e) => setPickupAmounts((prev) => ({ ...prev, [pickup.id]: e.target.value }))}
                        />
                        <Input
                          placeholder="Code relais"
                          value={pickupRelayCodes[pickup.id] || ''}
                          onChange={(e) => setPickupRelayCodes((prev) => ({ ...prev, [pickup.id]: e.target.value }))}
                        />
                        <Input
                          placeholder="Code collecteur"
                          value={pickupCollectorCodes[pickup.id] || ''}
                          onChange={(e) => setPickupCollectorCodes((prev) => ({ ...prev, [pickup.id]: e.target.value }))}
                        />
                        <Button onClick={() => handleConfirmPickup(pickup.id)} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">Confirmer</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Validation des points relais</CardTitle>
              <CardDescription>
                {activeRelais.filter(r => r.status === 'PENDING').length} demandes en attente · {archivedRelais.length} archivés
              </CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="APPROVED">Approuvés</SelectItem>
                <SelectItem value="REJECTED">Rejetés</SelectItem>
                <SelectItem value="ARCHIVED">Archivés</SelectItem>
                <SelectItem value="all">Tous</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DashboardSectionLoading label="Chargement des points relais..." />
          ) : (
            <div className="space-y-4">
              {filteredRelais.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Store className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{r.commerceName}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{r.address}, {WILAYAS.find(w => w.id === r.ville)?.name}</p>
                      <p className="text-xs text-slate-500">{r.user?.name} - {r.user?.email}</p>
                      {r.operationalStatus === 'SUSPENDU' && (
                        <p className="text-xs text-slate-600 mt-1">Relais archivé car suspendu</p>
                      )}
                      {getAssociatedParcelsCount(r) > 0 && (
                        <p className="text-xs text-amber-700 mt-1">
                          Suppression désactivée: {getAssociatedParcelsCount(r)} colis associé(s)
                        </p>
                      )}
                      {(() => {
                        if (!r.commerceDocuments) return null;
                        try {
                          const docs = JSON.parse(r.commerceDocuments);
                          if (!Array.isArray(docs) || docs.length === 0) return null;
                          return (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Pièces justificatives:</p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {docs.map((doc: any, idx: number) => (
                                  <a
                                    key={`${r.id}-doc-${idx}`}
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                  >
                                    {doc.filename || `Document ${idx + 1}`}
                                  </a>
                                ))}
                              </div>
                            </div>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${RELAIS_STATUS.find(s => s.id === r.status)?.color} text-white`}>
                      {RELAIS_STATUS.find(s => s.id === r.status)?.label}
                    </Badge>
                    {r.operationalStatus === 'SUSPENDU' && (
                      <Badge className="bg-slate-600 text-white">Archivé</Badge>
                    )}
                    {r.status === 'PENDING' && (
                      <>
                        <Button size="sm" onClick={() => handleApprove(r.id)} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4 mr-1" />Approuver
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleApproveTrial(r.id)}>
                          Essai 30j
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(r.id)}>
                          <XCircle className="h-4 w-4 mr-1" />Rejeter
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEditRelais(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {r.operationalStatus === 'SUSPENDU' ? (
                      <Button size="sm" onClick={() => handleOperationalStatusChange(r.id, 'ACTIF')} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle className="h-4 w-4 mr-1" />Réactiver
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="inline-flex">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteRelaisId(r.id)}
                              disabled={getAssociatedParcelsCount(r) > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {getAssociatedParcelsCount(r) > 0 && (
                          <TooltipContent side="top">
                            Suppression impossible: {getAssociatedParcelsCount(r)} colis associé(s)
                          </TooltipContent>
                        )}
                      </Tooltip>
                    )}
                  </div>
                </div>
              ))}
              {filteredRelais.length === 0 && <DashboardEmptyState icon={<Store className="h-5 w-5" />} title="Aucun relais" description="Aucun point relais ne correspond au filtre actuel." />}
            </div>
          )}
        </CardContent>
      </Card>

      {archivedRelais.length > 0 && filter !== 'ARCHIVED' && (
        <Card>
          <CardHeader>
            <CardTitle>Relais archivés</CardTitle>
            <CardDescription>Relais suspendus retirés des points relais disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {archivedRelais.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/80 opacity-90">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                      <Store className="h-6 w-6 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{r.commerceName}</p>
                        <Badge className="bg-slate-600 text-white">Archivé</Badge>
                        <Badge className="bg-red-600 text-white">SUSPENDU</Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{r.address}, {WILAYAS.find(w => w.id === r.ville)?.name}</p>
                      <p className="text-xs text-slate-500">{r.user?.name} - {r.user?.email}</p>
                      {(() => {
                        if (!r.commerceDocuments) return null;
                        try {
                          const docs = JSON.parse(r.commerceDocuments);
                          if (!Array.isArray(docs) || docs.length === 0) return null;
                          return (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {docs.map((doc: any, idx: number) => (
                                <a
                                  key={`${r.id}-archive-doc-${idx}`}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  {doc.filename || `Document ${idx + 1}`}
                                </a>
                              ))}
                            </div>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditRelais(r)}>
                      <Pencil className="h-4 w-4 mr-1" />Modifier
                    </Button>
                    <Button size="sm" onClick={() => handleOperationalStatusChange(r.id, 'ACTIF')} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle className="h-4 w-4 mr-1" />Réactiver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Relais Dialog */}
      <Dialog open={!!editRelais} onOpenChange={(open) => { if (!open) setEditRelais(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le relais</DialogTitle>
          </DialogHeader>
          {editRelais && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom du commerce</Label>
                <Input value={editRelais.commerceName} onChange={(e) => setEditRelais({ ...editRelais, commerceName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input value={editRelais.address} onChange={(e) => setEditRelais({ ...editRelais, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Select value={editRelais.ville} onValueChange={(v) => setEditRelais({ ...editRelais, ville: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={editRelais.status} onValueChange={(v) => setEditRelais({ ...editRelais, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">En attente</SelectItem>
                    <SelectItem value="APPROVED">Approuvé</SelectItem>
                    <SelectItem value="REJECTED">Rejeté</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut opérationnel</Label>
                <Select value={editRelais.operationalStatus || 'ACTIF'} onValueChange={(v) => setEditRelais({ ...editRelais, operationalStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIF">ACTIF</SelectItem>
                    <SelectItem value="SUSPENDU">SUSPENDU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(editRelais.operationalStatus || 'ACTIF') === 'SUSPENDU' && (
                <div className="space-y-2">
                  <Label>Raison de suspension</Label>
                  <Input value={editRelais.suspensionReason || ''} onChange={(e) => setEditRelais({ ...editRelais, suspensionReason: e.target.value })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRelais(null)}>Annuler</Button>
            <Button onClick={handleEditRelais} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteRelaisId} onOpenChange={(open) => { if (!open) setDeleteRelaisId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce point relais ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRelaisId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteRelais} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Lines Tab
function LinesTab() {
  const { toast } = useToast();
  const [lignes, setLignes] = useState<any[]>([]);
  const [availableLineCities, setAvailableLineCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editLigne, setEditLigne] = useState<any>(null);
  const [deleteLigneId, setDeleteLigneId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    villeDepart: '', villeArrivee: '', tarifPoids: '120', tarifKm: '2.5',
  });

  const normalizeCityKey = useCallback((value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''), []);

  const cityValueToWilayaId = useCallback((value: string) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const byId = WILAYAS.find((wilaya) => wilaya.id === raw);
    if (byId) return byId.id;

    const normalizedRaw = normalizeCityKey(raw);
    const byName = WILAYAS.find((wilaya) => normalizeCityKey(wilaya.name) === normalizedRaw);
    return byName?.id || '';
  }, [normalizeCityKey]);

  const getCityLabel = useCallback((value: string) => {
    const id = cityValueToWilayaId(value);
    const byId = id ? WILAYAS.find((wilaya) => wilaya.id === id) : null;
    return byId?.name || value || '—';
  }, [cityValueToWilayaId]);

  useEffect(() => {
    void fetchLignes();
    void fetchAvailableLineCities();
  }, []);

  const lineCityOptions = useMemo(() => {
    if (availableLineCities.length === 0) return [];
    return WILAYAS.filter((wilaya) => availableLineCities.includes(wilaya.id));
  }, [availableLineCities]);

  const editLineCityOptions = useMemo(() => {
    const ids = new Set(availableLineCities);
    if (editLigne?.villeDepart) ids.add(editLigne.villeDepart);
    if (editLigne?.villeArrivee) ids.add(editLigne.villeArrivee);
    return WILAYAS.filter((wilaya) => ids.has(wilaya.id));
  }, [availableLineCities, editLigne]);

  const fetchLignes = async () => {
    try {
      const response = await fetch('/api/lignes');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch lignes');
      }
      setLignes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching lignes:', error);
      setLignes([]);
      toast({
        title: 'Erreur chargement lignes',
        description: error instanceof Error ? error.message : 'Impossible de charger les lignes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableLineCities = async () => {
    try {
      const response = await fetch('/api/relais?status=APPROVED');
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) {
        return;
      }

      const uniqueCities = Array.from(new Set(
        data
          .filter((relay: any) => relay.operationalStatus === 'ACTIF')
          .map((relay: any) => cityValueToWilayaId(String(relay.ville || '').trim()))
          .filter(Boolean)
      ));

      setAvailableLineCities(uniqueCities);
    } catch {
      setAvailableLineCities([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.villeDepart || !formData.villeArrivee) {
      toast({ title: 'Champs manquants', description: 'Sélectionnez la ville de départ et la ville d\'arrivée.', variant: 'destructive' });
      return;
    }
    if (formData.villeDepart === formData.villeArrivee) {
      toast({ title: 'Villes identiques', description: 'La ville de départ et d\'arrivée doivent être différentes.', variant: 'destructive' });
      return;
    }

    const poids = parseLocaleFloat(formData.tarifPoids);
    const km = parseLocaleFloat(formData.tarifKm);
    
    if (!Number.isFinite(poids) || poids <= 0) {
      toast({ title: 'Tarif poids invalide', description: 'Entrez un montant positif en DA/kg.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(km) || km <= 0) {
      toast({ title: 'Tarif distance invalide', description: 'Entrez un montant positif en DA/km.', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/lignes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villeDepart: formData.villeDepart,
          villeArrivee: formData.villeArrivee,
          tarifPoids: parseLocaleFloat(formData.tarifPoids),
          tarifKm: parseLocaleFloat(formData.tarifKm),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const deparName = getCityLabel(formData.villeDepart);
        const arriveName = getCityLabel(formData.villeArrivee);
        
        let title = 'Erreur création';
        let description = data?.error || `Erreur ${response.status}`;
        
        if (response.status === 409) {
          title = 'Ligne déjà existante';
          description = `La route ${deparName} → ${arriveName} existe déjà.`;
        }
        
        toast({
          title,
          description,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Ligne créée',
        description: `${getCityLabel(formData.villeDepart)} → ${getCityLabel(formData.villeArrivee)}`,
      });
      fetchLignes();
      setFormData({ villeDepart: '', villeArrivee: '', tarifPoids: '120', tarifKm: '2.5' });
    } catch (err) {
      toast({ title: 'Erreur réseau', description: err instanceof Error ? err.message : 'Impossible de contacter le serveur.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditLigne = async () => {
    if (!editLigne) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/lignes/${editLigne.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villeDepart: editLigne.villeDepart,
          villeArrivee: editLigne.villeArrivee,
          tarifPoids: parseLocaleFloat(editLigne.tarifPoids ?? editLigne.tarifPetit),
          tarifKm: parseLocaleFloat(editLigne.tarifKm ?? editLigne.tarifMoyen),
          isActive: editLigne.isActive,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: 'Ligne modifiée' });
        setEditLigne(null);
        fetchLignes();
      } else {
        toast({ title: 'Erreur', description: data?.error || 'Impossible de modifier la ligne', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur réseau', description: err instanceof Error ? err.message : 'Impossible de contacter le serveur.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLigne = async () => {
    if (!deleteLigneId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/lignes/${deleteLigneId}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast({ title: 'Ligne supprimée' });
        setDeleteLigneId(null);
        fetchLignes();
      } else {
        toast({ title: 'Erreur', description: data?.error || 'Impossible de supprimer la ligne', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur réseau', description: err instanceof Error ? err.message : 'Impossible de contacter le serveur.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const safeLignes = Array.isArray(lignes) ? lignes : [];

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Créer une ligne de transport</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ville de départ</Label>
                  <Select value={formData.villeDepart} onValueChange={(v) => setFormData({ ...formData, villeDepart: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {lineCityOptions.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ville d'arrivée</Label>
                  <Select value={formData.villeArrivee} onValueChange={(v) => setFormData({ ...formData, villeArrivee: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {lineCityOptions.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {lineCityOptions.length === 0 ? (
                <p className="text-sm text-amber-600">Aucune ville n'est disponible tant qu'aucun relais actif et approuvé n'existe.</p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tarif par poids (DA/kg)</Label>
                  <Input type="number" step="0.1" value={formData.tarifPoids} onChange={(e) => setFormData({ ...formData, tarifPoids: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tarif par distance (DA/km)</Label>
                  <Input type="number" step="0.1" value={formData.tarifKm} onChange={(e) => setFormData({ ...formData, tarifKm: e.target.value })} />
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={
                  isCreating || 
                  !formData.villeDepart || 
                  !formData.villeArrivee || 
                  formData.villeDepart === formData.villeArrivee ||
                  !formData.tarifPoids ||
                  !formData.tarifKm ||
                  lineCityOptions.length < 2 ||
                  parseLocaleFloat(formData.tarifPoids) <= 0 ||
                  parseLocaleFloat(formData.tarifKm) <= 0
                } 
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Créer la ligne
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lignes de transport ({safeLignes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <DashboardSectionLoading label="Chargement des lignes tarifaires..." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Départ</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Poids (DA/kg)</TableHead>
                    <TableHead>Distance (DA/km)</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeLignes.map((ligne) => (
                    <TableRow key={ligne.id}>
                      <TableCell>{getCityLabel(ligne.villeDepart)}</TableCell>
                      <TableCell>{getCityLabel(ligne.villeArrivee)}</TableCell>
                      <TableCell>{ligne.tarifPoids ?? ligne.tarifPetit} DA</TableCell>
                      <TableCell>{ligne.tarifKm ?? ligne.tarifMoyen} DA</TableCell>
                      <TableCell>
                        <Badge className={ligne.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {ligne.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditLigne(ligne)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteLigneId(ligne.id)}>
                            <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Edit Ligne Dialog */}
      <Dialog open={!!editLigne} onOpenChange={() => setEditLigne(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la ligne</DialogTitle>
          </DialogHeader>
          {editLigne && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ville de départ</Label>
                  <Select value={editLigne.villeDepart} onValueChange={(v) => setEditLigne({ ...editLigne, villeDepart: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {editLineCityOptions.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ville d'arrivée</Label>
                  <Select value={editLigne.villeArrivee} onValueChange={(v) => setEditLigne({ ...editLigne, villeArrivee: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {editLineCityOptions.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tarif par poids (DA/kg)</Label>
                  <Input type="number" step="0.1" value={editLigne.tarifPoids ?? editLigne.tarifPetit} onChange={(e) => setEditLigne({ ...editLigne, tarifPoids: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tarif par distance (DA/km)</Label>
                  <Input type="number" step="0.1" value={editLigne.tarifKm ?? editLigne.tarifMoyen} onChange={(e) => setEditLigne({ ...editLigne, tarifKm: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ligneActive" checked={editLigne.isActive} onChange={(e) => setEditLigne({ ...editLigne, isActive: e.target.checked })} />
                <Label htmlFor="ligneActive">Ligne active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLigne(null)}>Annuler</Button>
            <Button onClick={handleEditLigne} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteLigneId} onOpenChange={() => setDeleteLigneId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette ligne de transport ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLigneId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteLigne} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Audit Tab — Journal des actions (ActionLog)
// ─────────────────────────────────────────────────────────────
const ENTITY_TYPES = ['ALL', 'COLIS', 'RELAIS', 'TRANSPORTER', 'USER', 'WALLET'] as const;
const ACTIONS_MAP: Record<string, string> = {
  QR_SCAN: 'Scan QR',
  PAYMENT_VALIDATE: 'Paiement validé',
  STATUS_CHANGE: 'Changement statut',
  PRINTER_STATUS_CHANGE: 'Changement statut imprimante',
  DEPOSIT: 'Dépôt relais',
  DELIVERY: 'Livraison',
  WITHDRAW: 'Retrait portefeuille',
  CASH_REVERSE: 'Reversement cash',
  LOGIN: 'Connexion',
  VALIDATE_RELAIS: 'Validation relais',
  VALIDATE_TRANSPORTER: 'Validation transporteur',
};
const ENTITY_COLORS: Record<string, string> = {
  COLIS: 'bg-blue-100 text-blue-700',
  RELAIS: 'bg-emerald-100 text-emerald-700',
  TRANSPORTER: 'bg-orange-100 text-orange-700',
  USER: 'bg-purple-100 text-purple-700',
  WALLET: 'bg-yellow-100 text-yellow-700',
};

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [entityType, setEntityType] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [limit, setLimit] = useState(50);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const applyQuickActionFilter = (value: string, scopedEntityType?: string) => {
    setActionFilter(value);
    if (scopedEntityType) {
      setEntityType(scopedEntityType);
    }
  };

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (entityType !== 'ALL') params.set('entityType', entityType);
      const res = await fetch(`/api/action-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        const filtered = actionFilter
          ? data.filter((l: any) => l.action?.toLowerCase().includes(actionFilter.toLowerCase()))
          : data;
        setLogs(filtered);
      }
    } finally {
      setIsLoading(false);
    }
  }, [entityType, limit, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try { return JSON.parse(details); } catch { return details; }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Type d'entité</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t === 'ALL' ? 'Tous' : t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Filtrer par action</Label>
              <Input
                placeholder="Ex: QR_SCAN, WITHDRAW…"
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Raccourcis</Label>
              <div className="flex gap-2">
                <Button
                  variant={actionFilter === 'PRINTER_STATUS_CHANGE' && entityType === 'RELAIS' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyQuickActionFilter('PRINTER_STATUS_CHANGE', 'RELAIS')}
                  className={actionFilter === 'PRINTER_STATUS_CHANGE' && entityType === 'RELAIS' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  Imprimantes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    applyQuickActionFilter('');
                    setEntityType('ALL');
                  }}
                  disabled={!actionFilter && entityType === 'ALL'}
                >
                  Réinitialiser
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Limite</Label>
              <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[50, 100, 200].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading} className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <span className="text-xs text-slate-500 self-end pb-2">{logs.length} entrée{logs.length > 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-slate-500" />
            Journal d'audit
          </CardTitle>
          <CardDescription>Toutes les actions tracées sur la plateforme</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <DashboardSectionLoading label="Chargement des logs d'audit..." />
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
              <ScrollText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Aucun log trouvé pour ces filtres</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map(log => {
                const details = parseDetails(log.details);
                const isExpanded = expandedId === log.id;
                return (
                  <div key={log.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ENTITY_COLORS[log.entityType] || 'bg-slate-100 text-slate-600'}`}>
                            {log.entityType}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {ACTIONS_MAP[log.action] || log.action}
                          </span>
                          <span className="font-mono text-xs text-slate-400 truncate max-w-[160px]" title={log.entityId}>
                            #{log.entityId.slice(-8)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>{new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {log.userId && <span className="font-mono truncate max-w-[100px]" title={log.userId}>user:{log.userId.slice(-6)}</span>}
                          {log.ipAddress && <span>{log.ipAddress}</span>}
                        </div>
                      </div>
                      {details && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-1"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                    {isExpanded && details && (
                      <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-800 rounded p-3 overflow-x-auto text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                        {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Litiges Tab ─────────────────────────────────────────────────────────────
function DisputesTab() {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED'>('ALL');
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED'>('UNDER_REVIEW');
  const [resolution, setResolution] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchDisputes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      const query = params.toString();
      const res = await fetch(`/api/disputes${query ? `?${query}` : ''}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Impossible de charger les litiges');
      }
      setDisputes(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de charger les litiges',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const openUpdateDialog = (dispute: any) => {
    setSelectedDispute(dispute);
    setNewStatus(dispute.status || 'UNDER_REVIEW');
    setResolution(dispute.resolution || '');
  };

  const handleUpdateDispute = async () => {
    if (!selectedDispute) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/disputes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: selectedDispute.id,
          status: newStatus,
          resolution: resolution.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Mise à jour impossible');
      }

      toast({ title: 'Litige mis à jour', description: `Nouveau statut: ${newStatus}` });
      setSelectedDispute(null);
      setResolution('');
      await fetchDisputes();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Mise à jour impossible',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-700';
      case 'UNDER_REVIEW':
        return 'bg-orange-100 text-orange-700';
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-700';
      case 'CLOSED':
        return 'bg-slate-200 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Litiges clients
              </CardTitle>
              <CardDescription>Traitement des litiges, arbitrage et clôture</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="UNDER_REVIEW">UNDER_REVIEW</SelectItem>
                  <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchDisputes} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DashboardSectionLoading label="Chargement des litiges..." />
          ) : disputes.length === 0 ? (
            <DashboardEmptyState icon={<AlertCircle className="h-5 w-5" />} title="Aucun litige trouvé" description="Les incidents ouverts apparaîtront ici." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colis</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-mono text-sm">{dispute.colis?.trackingNumber || dispute.colisId}</p>
                        <p className="text-xs text-slate-500">{dispute.colis?.villeDepart || '—'} → {dispute.colis?.villeArrivee || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-700">{dispute.reason}</p>
                        <p className="text-xs text-slate-500 max-w-[280px] truncate" title={dispute.description}>{dispute.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm">{dispute.openedBy?.name || 'N/A'}</p>
                        <p className="text-xs text-slate-500">{dispute.openedBy?.email || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge(dispute.status)}>{dispute.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(dispute.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openUpdateDialog(dispute)}>
                        Gérer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedDispute)} onOpenChange={(open) => { if (!open) setSelectedDispute(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre à jour le litige</DialogTitle>
            <DialogDescription>
              {selectedDispute?.colis?.trackingNumber
                ? `Colis ${selectedDispute.colis.trackingNumber}`
                : selectedDispute?.colisId || ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau statut</Label>
              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="UNDER_REVIEW">UNDER_REVIEW</SelectItem>
                  <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Résolution (optionnelle)</Label>
              <Textarea
                placeholder="Notes de résolution / décision d'arbitrage"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDispute(null)} disabled={isSaving}>Annuler</Button>
            <Button onClick={handleUpdateDispute} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Messages Tab ────────────────────────────────────────────────────────────
function MessagesTab({ onUnreadCountChange }: { onUnreadCountChange?: (count: number) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const { toast } = useToast();

  const syncUnreadCount = useCallback(async () => {
    if (!onUnreadCountChange) return;
    try {
      const res = await fetch('/api/admin/messages?filter=unread&page=1');
      if (!res.ok) return;
      const data = await res.json();
      onUnreadCountChange(typeof data?.total === 'number' ? data.total : 0);
    } catch {
      // Keep UI responsive even if this secondary request fails.
    }
  }, [onUnreadCountChange]);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ filter, page: String(page) });
      const res = await fetch(`/api/admin/messages?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFetchError(`HTTP ${res.status} — ${body.error ?? 'Erreur inconnue'}`);
        return;
      }
      const data = await res.json();
      setMessages(data.messages);
      setTotal(data.total);
      await syncUnreadCount();
    } catch (err) {
      setFetchError('Requête échouée (réseau ou serveur)');
      toast({ title: 'Erreur', description: 'Impossible de charger les messages.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [filter, page, syncUnreadCount, toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const markRead = async (msg: any, isRead: boolean) => {
    try {
    const res = await fetch('/api/admin/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: msg.id, isRead }),
    });
    if (!res.ok) return;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead } : m)));
    if (selected?.id === msg.id) setSelected({ ...msg, isRead });
    void syncUnreadCount();
    } catch { /* transient — ignore */ }
  };

  const deleteMsg = async (id: string) => {
    try {
    const res = await fetch(`/api/admin/messages?id=${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setTotal((t) => t - 1);
    } catch { /* transient — ignore */ }
    if (selected?.id === id) setSelected(null);
    void syncUnreadCount();
  };

  const selectMessage = (msg: any) => {
    setSelected(msg);
    setReplyText('');
    if (!msg.isRead) void markRead(msg, true);
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setIsSendingReply(true);
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, reply: replyText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Erreur', description: data.error ?? `HTTP ${res.status}`, variant: 'destructive' });
        return;
      }
      const desc = data.emailSent ? `Email envoyé à ${selected.email}` : `Réponse enregistrée (email non envoyé — vérifier la configuration SMTP)`;
      toast({ title: 'Réponse envoyée', description: desc });
      setReplyText('');
      const savedReply = replyText.trim();
      setMessages((prev) => prev.map((m) => m.id === selected.id ? { ...m, isRead: true, repliedAt: new Date().toISOString(), replyContent: savedReply } : m));
      setSelected((s: any) => s ? { ...s, isRead: true, repliedAt: new Date().toISOString(), replyContent: savedReply } : s);
      void syncUnreadCount();
    } catch (err) {
      toast({ title: 'Erreur réseau', description: String(err), variant: 'destructive' });
    } finally {
      setIsSendingReply(false);
    }
  };

  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-violet-500" />
              Messages de contact
              {unreadCount > 0 && <Badge className="ml-1 bg-red-500 text-white">{unreadCount} non lus</Badge>}
            </CardTitle>
            <CardDescription>{total} message{total !== 1 ? 's' : ''} au total</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onValueChange={(v) => {
                setFilter(v as 'all' | 'unread' | 'read');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="unread">Non lus</SelectItem>
                <SelectItem value="read">Lus</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchMessages} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-red-500">
              <p className="text-sm font-semibold">Erreur de chargement</p>
              <p className="text-xs font-mono bg-red-50 dark:bg-red-950/30 px-3 py-1 rounded">{fetchError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={fetchMessages}>Réessayer</Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
              <Inbox className="h-12 w-12 opacity-30" />
              <p className="text-sm">Aucun message</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => selectMessage(msg)}
                  className={`cursor-pointer px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    !msg.isRead ? 'bg-violet-50/60 dark:bg-violet-900/10' : ''
                  } ${selected?.id === msg.id ? 'ring-2 ring-inset ring-violet-400/50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {msg.isRead ? <MailOpen className="h-5 w-5 text-slate-400" /> : <Mail className="h-5 w-5 text-violet-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${!msg.isRead ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                          {msg.name}
                        </span>
                        <span className="text-xs text-slate-400">{msg.email}</span>
                        {!msg.isRead && <Badge className="bg-violet-500 px-1.5 py-0 text-[10px] text-white">Nouveau</Badge>}
                      </div>
                      <p className="truncate text-sm text-slate-600 dark:text-slate-400">{msg.subject}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{msg.message}</p>
                    </div>
                    <div className="shrink-0 space-y-1 text-right">
                      <p className="text-xs text-slate-400">
                        {new Date(msg.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </p>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markRead(msg, !msg.isRead);
                          }}
                          title={msg.isRead ? 'Marquer non lu' : 'Marquer lu'}
                        >
                          {msg.isRead ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteMsg(msg.id);
                          }}
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {total > 20 && (
            <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-slate-500">
              <span>
                {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} sur {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </Button>
                <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">{selected.subject}</CardTitle>
                <CardDescription>
                  De : <strong>{selected.name}</strong> &lt;{selected.email}&gt; •{' '}
                  {new Date(selected.createdAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
                  {selected.repliedAt && (
                    <span className="ml-2 text-green-600">✓ Répondu le {new Date(selected.repliedAt).toLocaleDateString('fr-FR')}</span>
                  )}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => setSelected(null)}>
                Fermer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              {selected.message}
            </div>
            {selected.replyContent && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
                <p className="mb-1 text-xs font-medium text-green-700 dark:text-green-400">Réponse envoyée le {new Date(selected.repliedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} :</p>
                <p className="whitespace-pre-wrap text-sm text-green-800 dark:text-green-300">{selected.replyContent}</p>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                <Reply className="mr-1.5 inline h-4 w-4 text-violet-500" />
                {selected.replyContent ? 'Envoyer une autre réponse' : 'Répondre à'} <span className="text-violet-600">{selected.email}</span>
              </p>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Écrivez votre réponse..."
                className="min-h-[120px] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={sendReply}
                  disabled={isSendingReply || !replyText.trim()}
                  className="gap-2 bg-violet-600 hover:bg-violet-700"
                >
                  {isSendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
                  Envoyer la réponse
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Settings Tab
function SettingsTab({ stats }: { stats: any }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [relayPrinters, setRelayPrinters] = useState<Array<{
    relaisId: string;
    commerceName: string;
    ville: string;
    operationalStatus: string;
    printerStatus: 'READY' | 'BROKEN' | 'OUT_OF_PAPER' | 'NOT_EQUIPPED';
  }>>([]);
  const [settings, setSettings] = useState({
    platformCommission: '10',
    pricingAdminFee: '50',
    pricingRatePerKg: '120',
    pricingRatePerKm: '2.5',
    pricingRelayDepartureRate: '10',
    pricingRelayArrivalRate: '10',
    pricingRelayPrintFee: '30',
    pricingRoundTo: '10',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const [settingsResponse, printersResponse] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/relais/printers'),
      ]);

      const data = await settingsResponse.json();
      if (!settingsResponse.ok) {
        throw new Error(data?.error || 'Failed to fetch settings');
      }

      setSettings({
        platformCommission: String(data.platformCommission || 10),
        pricingAdminFee: String(data.pricingAdminFee || 50),
        pricingRatePerKg: String(data.pricingRatePerKg || 120),
        pricingRatePerKm: String(data.pricingRatePerKm || 2.5),
        pricingRelayDepartureRate: String(((data.pricingRelayDepartureRate || 0.1) * 100).toFixed(2)),
        pricingRelayArrivalRate: String(((data.pricingRelayArrivalRate || 0.1) * 100).toFixed(2)),
        pricingRelayPrintFee: String(data.pricingRelayPrintFee || 30),
        pricingRoundTo: String(data.pricingRoundTo || 10),
      });

      if (printersResponse.ok) {
        const printersData = await printersResponse.json();
        setRelayPrinters(Array.isArray(printersData?.printers) ? printersData.printers : []);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Erreur chargement paramètres',
        description: error instanceof Error ? error.message : 'Impossible de charger les paramètres',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformCommission: parseLocaleFloat(settings.platformCommission),
          pricingAdminFee: parseLocaleFloat(settings.pricingAdminFee),
          pricingRatePerKg: parseLocaleFloat(settings.pricingRatePerKg),
          pricingRatePerKm: parseLocaleFloat(settings.pricingRatePerKm),
          pricingRelayDepartureRate: parseLocaleFloat(settings.pricingRelayDepartureRate) / 100,
          pricingRelayArrivalRate: parseLocaleFloat(settings.pricingRelayArrivalRate) / 100,
          pricingRelayPrintFee: parseLocaleFloat(settings.pricingRelayPrintFee),
          pricingRoundTo: parseLocaleFloat(settings.pricingRoundTo),
        }),
      });

      if (!response.ok) {
        throw new Error('Impossible de sauvegarder les paramètres globaux');
      }

      toast({ title: 'Paramètres sauvegardés', description: 'Paramètres globaux enregistrés avec succès' });
    } catch (error) {
      toast({ title: 'Erreur', description: error instanceof Error ? error.message : 'Impossible de sauvegarder les paramètres', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Résumé financier global</CardTitle>
          <CardDescription>Totaux calculés sur les missions terminées à l'arrivée relais sur toute la plateforme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500">Missions</p>
              <p className="text-2xl font-bold">{stats?.financialSummary?.count ?? 0}</p>
            </div>
            <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500">Tarif client</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Number(stats?.financialSummary?.clientTotal ?? 0).toFixed(0)} DA</p>
            </div>
            <div className="rounded-lg border p-4 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200">
              <p className="text-xs text-emerald-700">Commission relais</p>
              <p className="text-2xl font-bold text-emerald-700">{Number(stats?.financialSummary?.relayTotal ?? 0).toFixed(0)} DA</p>
            </div>
            <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <p className="text-xs text-blue-700">Commission admin</p>
              <p className="text-2xl font-bold text-blue-700">{Number(stats?.financialSummary?.adminTotal ?? 0).toFixed(0)} DA</p>
            </div>
            <div className="rounded-lg border p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200">
              <p className="text-xs text-purple-700">Net transporteur</p>
              <p className="text-2xl font-bold text-purple-700">{Number(stats?.financialSummary?.netTransporteurTotal ?? 0).toFixed(0)} DA</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres de la plateforme</CardTitle>
          <CardDescription>
            Définissez ici les règles de calcul des prix et des commissions pour toute la plateforme. 
            <br />
            <span className="block mt-1">Exemples&nbsp;: pourcentage prélevé par la plateforme, barème des relais, tarifs au kilo ou au kilomètre, etc.</span>
            <span className="block mt-1">Tous les taux de commission affichés ici sont modifiables par l'admin et servent aux nouveaux colis.</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <DashboardSectionLoading label="Chargement des paramètres..." />
          ) : (
            <>
              <div className="space-y-2">
                <Label>Commission plateforme (%)</Label>
                <Input 
                  type="number" 
                  value={settings.platformCommission} 
                  onChange={(e) => setSettings({ ...settings, platformCommission: e.target.value })} 
                  className="max-w-xs" 
                />
                <p className="text-xs text-slate-500">Pourcentage prélevé sur chaque transaction</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                La tarification repose sur le poids, la distance estimée et les commissions dynamiques ci-dessous.
              </div>

              <div className="space-y-4">
                <Label>Tarification dynamique colis</Label>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="mb-3 text-sm font-semibold text-emerald-800">Champs essentiels</p>
                  <div className="grid max-w-2xl gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm">Frais admin fixes (DA)</Label>
                      <Input type="number" step="1" value={settings.pricingAdminFee} onChange={(e) => setSettings({ ...settings, pricingAdminFee: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Tarif par kg (DA)</Label>
                      <Input type="number" step="1" value={settings.pricingRatePerKg} onChange={(e) => setSettings({ ...settings, pricingRatePerKg: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Tarif par km (DA)</Label>
                      <Input type="number" step="0.1" value={settings.pricingRatePerKm} onChange={(e) => setSettings({ ...settings, pricingRatePerKm: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Arrondi (DA)</Label>
                      <Input type="number" step="1" value={settings.pricingRoundTo} onChange={(e) => setSettings({ ...settings, pricingRoundTo: e.target.value })} />
                    </div>
                  </div>
                </div>

                <details className="max-w-2xl rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/40">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Options avancées (relais)
                  </summary>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm">Commission relais départ (%)</Label>
                      <Input type="number" step="0.1" min="0" max="100" value={settings.pricingRelayDepartureRate} onChange={(e) => setSettings({ ...settings, pricingRelayDepartureRate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Commission relais arrivée (%)</Label>
                      <Input type="number" step="0.1" min="0" max="100" value={settings.pricingRelayArrivalRate} onChange={(e) => setSettings({ ...settings, pricingRelayArrivalRate: e.target.value })} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm">Frais impression au relais (DA)</Label>
                      <Input type="number" step="1" value={settings.pricingRelayPrintFee} onChange={(e) => setSettings({ ...settings, pricingRelayPrintFee: e.target.value })} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Pour les commissions: 10 signifie 10% du coût transport.</p>
                </details>
              </div>

              <div className="space-y-3">
                <Label>État des imprimantes relais</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Relais</TableHead>
                        <TableHead>Ville</TableHead>
                        <TableHead>Statut relais</TableHead>
                        <TableHead>Statut imprimante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relayPrinters.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-500">Aucun relais approuvé trouvé</TableCell>
                        </TableRow>
                      ) : relayPrinters.map((row) => (
                        <TableRow key={row.relaisId}>
                          <TableCell>{row.commerceName}</TableCell>
                          <TableCell>{row.ville}</TableCell>
                          <TableCell>{row.operationalStatus}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              row.printerStatus === 'READY'
                                ? 'bg-emerald-100 text-emerald-700'
                                : row.printerStatus === 'OUT_OF_PAPER'
                                  ? 'bg-amber-100 text-amber-700'
                                  : row.printerStatus === 'BROKEN'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-slate-100 text-slate-700'
                            }`}>
                              {row.printerStatus === 'READY' && 'Prête'}
                              {row.printerStatus === 'OUT_OF_PAPER' && 'Plus de papier'}
                              {row.printerStatus === 'BROKEN' && 'En panne'}
                              {row.printerStatus === 'NOT_EQUIPPED' && 'Non équipée'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-slate-500">Statuts déclarés par les relais en temps réel. L'admin consulte et audite sans piloter le matériel.</p>
              </div>

              <Button 
                onClick={handleSave} 
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sauvegarder
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Réinitialiser le statut des relais</CardTitle>
          <CardDescription>Remettre tous les relais en attente de validation</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/api/admin/reset-relais-status" target="_blank">Réinitialiser les statuts relais</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Loyalty Tab ─────────────────────────────────────────────────────────────
function LoyaltyTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isConfigSaving, setIsConfigSaving] = useState(false);
  const [lastConfigSavedAt, setLastConfigSavedAt] = useState<string | null>(null);
  const [isCronRunning, setIsCronRunning] = useState(false);
  const [reEvalIds, setReEvalIds] = useState<Set<string>>(new Set());
  const [cronResult, setCronResult] = useState<{ processed: number; failed: number; timestamp: string } | null>(null);
  const [loyaltyConfig, setLoyaltyConfig] = useState({
    loyaltyImplicitDiscountRate: '0.05',
    loyaltyImplicitMinParcels: '5',
    loyaltyImplicitWindowDays: '7',
    loyaltyImplicitStickyDays: '30',
  });

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users?role=CLIENT');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement');
      const list = (Array.isArray(data) ? data : []).filter((u: any) => u.role === 'CLIENT');
      setClients(list);
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Impossible de charger', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchLoyaltyConfig = useCallback(async () => {
    setIsConfigLoading(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement config');
      setLoyaltyConfig({
        loyaltyImplicitDiscountRate: String(data.loyaltyImplicitDiscountRate ?? 0.05),
        loyaltyImplicitMinParcels: String(data.loyaltyImplicitMinParcels ?? 5),
        loyaltyImplicitWindowDays: String(data.loyaltyImplicitWindowDays ?? 7),
        loyaltyImplicitStickyDays: String(data.loyaltyImplicitStickyDays ?? 30),
      });
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Impossible de charger la configuration fidélité', variant: 'destructive' });
    } finally {
      setIsConfigLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClients();
    fetchLoyaltyConfig();
  }, [fetchClients, fetchLoyaltyConfig]);

  const handleSaveLoyaltyConfig = async () => {
    setIsConfigSaving(true);
    try {
      const payload = {
        loyaltyImplicitDiscountRate: parseLocaleFloat(loyaltyConfig.loyaltyImplicitDiscountRate),
        loyaltyImplicitMinParcels: parseLocaleFloat(loyaltyConfig.loyaltyImplicitMinParcels),
        loyaltyImplicitWindowDays: parseLocaleFloat(loyaltyConfig.loyaltyImplicitWindowDays),
        loyaltyImplicitStickyDays: parseLocaleFloat(loyaltyConfig.loyaltyImplicitStickyDays),
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Impossible de sauvegarder la configuration fidélité');

      setLastConfigSavedAt(new Date().toISOString());
      toast({ title: 'Configuration fidélité sauvegardée', description: 'Les nouvelles règles sont actives immédiatement' });
      await Promise.all([fetchLoyaltyConfig(), fetchClients()]);
    } catch (e) {
      toast({ title: 'Erreur sauvegarde', description: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' });
    } finally {
      setIsConfigSaving(false);
    }
  };

  const handleReEvalOne = async (clientId: string) => {
    setReEvalIds(prev => new Set(prev).add(clientId));
    try {
      const res = await fetch(`/api/loyalty/status?clientId=${clientId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur');
      setClients(prev => prev.map(c =>
        c.id === clientId
          ? { ...c, eligibleProImplicit: data.eligible, weeklyValidShipments: data.validParcelsCount, proLastEvaluatedAt: data.windowStart }
          : c
      ));
      toast({ title: data.eligible ? '✓ Client éligible' : '✗ Non éligible', description: `${data.validParcelsCount}/${data.threshold} colis valides sur ${data.windowDays}j` });
    } catch (e) {
      toast({ title: 'Erreur réévaluation', description: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' });
    } finally {
      setReEvalIds(prev => { const s = new Set(prev); s.delete(clientId); return s; });
    }
  };

  const handleCronBatch = async () => {
    setIsCronRunning(true);
    setCronResult(null);
    try {
      const res = await fetch('/api/loyalty/evaluate/admin-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 500 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur cron');
      setCronResult({ processed: data.processed, failed: data.failed, timestamp: data.timestamp });
      toast({ title: `Réévaluation batch terminée`, description: `${data.processed} clients traités, ${data.failed} erreurs` });
      await fetchClients();
    } catch (e) {
      toast({ title: 'Erreur batch', description: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' });
    } finally {
      setIsCronRunning(false);
    }
  };

  const eligible = clients.filter(c => c.eligibleProImplicit);
  const notEligible = clients.filter(c => !c.eligibleProImplicit);

  return (
    <div className="space-y-6">
      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-emerald-50 p-4">
          <p className="text-xs text-emerald-700 font-medium mb-1">Clients éligibles</p>
          <p className="text-2xl font-black text-emerald-700">{eligible.length}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs text-slate-600 font-medium mb-1">Non éligibles</p>
          <p className="text-2xl font-black text-slate-700">{notEligible.length}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs text-slate-600 font-medium mb-1">Total clients</p>
          <p className="text-2xl font-black text-slate-700">{clients.length}</p>
        </div>
        <div className="rounded-xl border bg-amber-50 p-4">
          <p className="text-xs text-amber-700 font-medium mb-1">Taux fidélité</p>
          <p className="text-2xl font-black text-amber-700">
            {clients.length > 0 ? Math.round((eligible.length / clients.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Actions globales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-emerald-600" />Fidélité implicite — pilotage admin</CardTitle>
              <CardDescription>
                Seuil: {Number(loyaltyConfig.loyaltyImplicitMinParcels) || 5} colis valides (payés/livrés) sur {Number(loyaltyConfig.loyaltyImplicitWindowDays) || 7} jours glissants ·
                Anti-yoyo {Number(loyaltyConfig.loyaltyImplicitStickyDays) || 30}j ·
                Remise {Math.round((Number(loyaltyConfig.loyaltyImplicitDiscountRate) || 0.05) * 100)}%
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchClients} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleCronBatch}
                disabled={isCronRunning}
              >
                {isCronRunning
                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  : <PlayCircle className="h-4 w-4 mr-1" />}
                Réévaluer tous les clients
              </Button>
            </div>
          </div>
          {cronResult && (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
              Dernier batch: <strong>{cronResult.processed}</strong> clients traités,{' '}
              <strong>{cronResult.failed}</strong> erreurs —{' '}
              {new Date(cronResult.timestamp).toLocaleTimeString('fr-FR')}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-xl border bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-800">Paramètres fidélité (pilotage sécurisé)</p>
                <p className="text-xs text-slate-500">Bornes: remise 0-10%, seuil 3-10 colis, fenêtre 7-14 jours, anti-yoyo 7-60 jours</p>
              </div>
              <Button size="sm" onClick={handleSaveLoyaltyConfig} disabled={isConfigSaving || isConfigLoading}>
                {isConfigSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Sauvegarder
              </Button>
            </div>
            {isConfigLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <span className="font-semibold">Règle active:</span>{' '}
                  {Number(loyaltyConfig.loyaltyImplicitMinParcels) || 5} colis / {Number(loyaltyConfig.loyaltyImplicitWindowDays) || 7} jours ·
                  remise {Math.round((Number(loyaltyConfig.loyaltyImplicitDiscountRate) || 0.05) * 100)}% ·
                  anti-yoyo {Number(loyaltyConfig.loyaltyImplicitStickyDays) || 30} jours
                  {lastConfigSavedAt ? ` · sauvegardée à ${new Date(lastConfigSavedAt).toLocaleTimeString('fr-FR')}` : ''}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Remise implicite (taux)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="0.1"
                      value={loyaltyConfig.loyaltyImplicitDiscountRate}
                      onChange={(e) => setLoyaltyConfig((prev) => ({ ...prev, loyaltyImplicitDiscountRate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Seuil colis valides</Label>
                    <Input
                      type="number"
                      step="1"
                      min="3"
                      max="10"
                      value={loyaltyConfig.loyaltyImplicitMinParcels}
                      onChange={(e) => setLoyaltyConfig((prev) => ({ ...prev, loyaltyImplicitMinParcels: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fenêtre glissante (jours)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="7"
                      max="14"
                      value={loyaltyConfig.loyaltyImplicitWindowDays}
                      onChange={(e) => setLoyaltyConfig((prev) => ({ ...prev, loyaltyImplicitWindowDays: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Anti-yoyo (jours)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="7"
                      max="60"
                      value={loyaltyConfig.loyaltyImplicitStickyDays}
                      onChange={(e) => setLoyaltyConfig((prev) => ({ ...prev, loyaltyImplicitStickyDays: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <DashboardSectionLoading label="Chargement du programme fidélité..." />
          ) : clients.length === 0 ? (
            <DashboardEmptyState icon={<Users className="h-5 w-5" />} title="Aucun client inscrit" description="Les clients éligibles fidélité apparaîtront ici." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Colis valides 7j</TableHead>
                  <TableHead>Éligible depuis</TableHead>
                  <TableHead>Dernière éval.</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map(client => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{client.email}</TableCell>
                    <TableCell>
                      {client.eligibleProImplicit
                        ? <Badge className="bg-emerald-600 text-white">✓ Éligible</Badge>
                        : <Badge className="bg-slate-200 text-slate-600">Non éligible</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${(client.weeklyValidShipments ?? 0) >= (Number(loyaltyConfig.loyaltyImplicitMinParcels) || 5) ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {client.weeklyValidShipments ?? 0}
                      </span>
                      <span className="text-slate-400 text-xs"> / {Number(loyaltyConfig.loyaltyImplicitMinParcels) || 5}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {client.eligibleProSince
                        ? new Date(client.eligibleProSince).toLocaleDateString('fr-FR')
                        : '—'
                      }
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {client.proLastEvaluatedAt
                        ? new Date(client.proLastEvaluatedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'Jamais'
                      }
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reEvalIds.has(client.id)}
                        onClick={() => handleReEvalOne(client.id)}
                        title="Réévaluer ce client maintenant"
                      >
                        {reEvalIds.has(client.id)
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RefreshCw className="h-3.5 w-3.5" />
                        }
                      </Button>
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
