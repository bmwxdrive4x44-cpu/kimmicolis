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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { MatchingAutoAssignPanel } from '@/components/dashboard/admin/matching-auto-assign-panel';
import { WILAYAS, USER_ROLES, PARCEL_STATUS, RELAIS_STATUS, PARCEL_FORMATS } from '@/lib/constants';
import { Users, Package, Truck, Store, DollarSign, CheckCircle, XCircle, Loader2, Plus, Settings, BarChart3, MapPin, Trash2, Pencil, Eye, EyeOff, AlertCircle, ScrollText, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Helper function to get the correct dashboard path based on role
function getRoleBasedDashboardPath(role: string, locale: string): string {
  switch (role) {
    case 'ADMIN': return `/${locale}/dashboard/admin`;
    case 'TRANSPORTER': return `/${locale}/dashboard/transporter`;
    case 'RELAIS': return `/${locale}/dashboard/relais`;
    case 'CLIENT':
    default: return `/${locale}/dashboard/client`;
  }
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    }
  }, [session?.user?.role]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!session?.user || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Administration SwiftColis</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Bienvenue, {session?.user?.name}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.counts?.users || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Colis</CardTitle>
              <Package className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.counts?.parcels || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transporteurs</CardTitle>
              <Truck className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.counts?.transporters || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points relais</CardTitle>
              <Store className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.counts?.relais || 0}</div>
              {stats?.counts?.pendingRelais > 0 && (
                <p className="text-xs text-orange-500">{stats.counts.pendingRelais} en attente</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenus</CardTitle>
              <DollarSign className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats?.revenue || 0).toFixed(0)} DA</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7 mb-8">
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-2" />Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Utilisateurs</TabsTrigger>
            <TabsTrigger value="parcels"><Package className="h-4 w-4 mr-2" />Colis</TabsTrigger>
            <TabsTrigger value="relays"><Store className="h-4 w-4 mr-2" />Relais</TabsTrigger>
            <TabsTrigger value="lines"><MapPin className="h-4 w-4 mr-2" />Lignes</TabsTrigger>
            <TabsTrigger value="audit"><ScrollText className="h-4 w-4 mr-2" />Audit</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab stats={stats} setActiveTab={setActiveTab} />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="parcels">
            <ParcelsTab />
          </TabsContent>
          <TabsContent value="relays">
            <RelaysTab />
          </TabsContent>
          <TabsContent value="lines">
            <LinesTab />
          </TabsContent>
          <TabsContent value="audit">
            <AuditTab />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
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
              <p className="text-slate-500 text-center py-4">Aucun colis</p>
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
              <p className="text-slate-500 text-center py-4">Aucune donnée</p>
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
              <p className="text-slate-500 text-center py-4">Aucun colis récent</p>
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
          isActive: editUser.isActive,
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
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Inscription</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant="outline">{USER_ROLES.find(r => r.id === user.role)?.label}</Badge></TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge className={user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {user.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
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
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={editUser.isActive} onChange={(e) => setEditUser({ ...editUser, isActive: e.target.checked })} />
                <Label htmlFor="isActive">Compte actif</Label>
              </div>
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
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Suivi</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Format</TableHead>
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
                  <TableCell>{PARCEL_FORMATS.find(f => f.id === c.format)?.label || c.format}</TableCell>
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
          commissionPetit: parseFloat(editRelais.commissionPetit),
          commissionMoyen: parseFloat(editRelais.commissionMoyen),
          commissionGros: parseFloat(editRelais.commissionGros),
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
      if (response.ok) {
        toast({ title: 'Relais supprimé' });
        setDeleteRelaisId(null);
        fetchRelais();
        fetchTracking();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de supprimer le relais', variant: 'destructive' });
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
  const filteredRelais = filter === 'all' ? safeRelais : safeRelais.filter(r => r.status === filter);

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
                <p className="text-2xl font-bold mt-1">{trackingTotals?.totalRelais || 0}</p>
              </div>
              <div className="rounded-lg border p-4 bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Actifs</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{trackingTotals?.actifRelais || 0}</p>
              </div>
              <div className="rounded-lg border p-4 bg-red-50 dark:bg-red-950/20">
                <p className="text-sm text-red-700 dark:text-red-300">Suspendus</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{trackingTotals?.suspendedRelais || 0}</p>
              </div>
              <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/60">
                <p className="text-sm text-slate-600 dark:text-slate-400">Fiabilité moyenne</p>
                <p className="text-2xl font-bold mt-1">{trackingTotals?.avgReliabilityScore || 0}%</p>
              </div>
              <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
                <p className="text-sm text-blue-700 dark:text-blue-300">Conformité moyenne</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{trackingTotals?.avgComplianceScore || 0}%</p>
              </div>
              <div className="rounded-lg border p-4 bg-orange-50 dark:bg-orange-950/20">
                <p className="text-sm text-orange-700 dark:text-orange-300">Montant dû plateforme</p>
                <p className="text-2xl font-bold mt-1 text-orange-600">{(trackingTotals?.totalMoneyPending || 0).toFixed(0)} DA</p>
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
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
            ) : trackingRelais.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Aucun relais à afficher</p>
            ) : (
              <div className="space-y-4">
                {trackingRelais.map((relay) => (
                  <div key={relay.id} className="rounded-xl border p-4 space-y-4">
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
                          <Badge variant="outline">Score {relay.metrics?.reliabilityScore || 0}%</Badge>
                          <Badge variant="outline">Conformité {relay.metrics?.complianceScore || 0}%</Badge>
                          <Badge variant="outline">Caution {relay.cautionStatus || 'PENDING'}</Badge>
                          {relay.activeSanctionsCount > 0 && (
                            <Badge className="bg-red-100 text-red-700">Sanctions actives: {relay.activeSanctionsCount}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{relay.address}, {WILAYAS.find(w => w.id === relay.ville)?.name || relay.ville}</p>
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
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
            ) : cashPickups.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Aucune collecte cash</p>
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
              <CardDescription>{safeRelais.filter(r => r.status === 'PENDING').length} demandes en attente</CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="APPROVED">Approuvés</SelectItem>
                <SelectItem value="REJECTED">Rejetés</SelectItem>
                <SelectItem value="all">Tous</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${RELAIS_STATUS.find(s => s.id === r.status)?.color} text-white`}>
                      {RELAIS_STATUS.find(s => s.id === r.status)?.label}
                    </Badge>
                    {r.status === 'PENDING' && (
                      <>
                        <Button size="sm" onClick={() => handleApprove(r.id)} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4 mr-1" />Approuver
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(r.id)}>
                          <XCircle className="h-4 w-4 mr-1" />Rejeter
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEditRelais(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteRelaisId(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredRelais.length === 0 && <p className="text-center text-slate-500 py-8">Aucun relais</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Relais Dialog */}
      <Dialog open={!!editRelais} onOpenChange={() => setEditRelais(null)}>
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
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Commission Petit (DA)</Label>
                  <Input type="number" value={editRelais.commissionPetit} onChange={(e) => setEditRelais({ ...editRelais, commissionPetit: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Commission Moyen (DA)</Label>
                  <Input type="number" value={editRelais.commissionMoyen} onChange={(e) => setEditRelais({ ...editRelais, commissionMoyen: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Commission Gros (DA)</Label>
                  <Input type="number" value={editRelais.commissionGros} onChange={(e) => setEditRelais({ ...editRelais, commissionGros: e.target.value })} />
                </div>
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
      <Dialog open={!!deleteRelaisId} onOpenChange={() => setDeleteRelaisId(null)}>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editLigne, setEditLigne] = useState<any>(null);
  const [deleteLigneId, setDeleteLigneId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    villeDepart: '', villeArrivee: '', tarifPetit: '500', tarifMoyen: '750', tarifGros: '1000',
  });

  useEffect(() => { fetchLignes(); }, []);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await fetch('/api/lignes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tarifPetit: parseFloat(formData.tarifPetit),
          tarifMoyen: parseFloat(formData.tarifMoyen),
          tarifGros: parseFloat(formData.tarifGros),
        }),
      });
      toast({ title: 'Ligne créée' });
      fetchLignes();
      setFormData({ villeDepart: '', villeArrivee: '', tarifPetit: '500', tarifMoyen: '750', tarifGros: '1000' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
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
          tarifPetit: parseFloat(editLigne.tarifPetit),
          tarifMoyen: parseFloat(editLigne.tarifMoyen),
          tarifGros: parseFloat(editLigne.tarifGros),
          isActive: editLigne.isActive,
        }),
      });
      if (response.ok) {
        toast({ title: 'Ligne modifiée' });
        setEditLigne(null);
        fetchLignes();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de modifier la ligne', variant: 'destructive' });
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
      if (response.ok) {
        toast({ title: 'Ligne supprimée' });
        setDeleteLigneId(null);
        fetchLignes();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de supprimer la ligne', variant: 'destructive' });
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
                      {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ville d'arrivée</Label>
                  <Select value={formData.villeArrivee} onValueChange={(v) => setFormData({ ...formData, villeArrivee: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tarif Petit (DA)</Label>
                  <Input type="number" value={formData.tarifPetit} onChange={(e) => setFormData({ ...formData, tarifPetit: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Moyen (DA)</Label>
                  <Input type="number" value={formData.tarifMoyen} onChange={(e) => setFormData({ ...formData, tarifMoyen: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Gros (DA)</Label>
                  <Input type="number" value={formData.tarifGros} onChange={(e) => setFormData({ ...formData, tarifGros: e.target.value })} />
                </div>
              </div>
              <Button type="submit" disabled={isCreating} className="bg-emerald-600 hover:bg-emerald-700">
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
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Départ</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Petit</TableHead>
                    <TableHead>Moyen</TableHead>
                    <TableHead>Gros</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeLignes.map((ligne) => (
                    <TableRow key={ligne.id}>
                      <TableCell>{WILAYAS.find(w => w.id === ligne.villeDepart)?.name}</TableCell>
                      <TableCell>{WILAYAS.find(w => w.id === ligne.villeArrivee)?.name}</TableCell>
                      <TableCell>{ligne.tarifPetit} DA</TableCell>
                      <TableCell>{ligne.tarifMoyen} DA</TableCell>
                      <TableCell>{ligne.tarifGros} DA</TableCell>
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
                      {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ville d'arrivée</Label>
                  <Select value={editLigne.villeArrivee} onValueChange={(v) => setEditLigne({ ...editLigne, villeArrivee: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tarif Petit (DA)</Label>
                  <Input type="number" value={editLigne.tarifPetit} onChange={(e) => setEditLigne({ ...editLigne, tarifPetit: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Moyen (DA)</Label>
                  <Input type="number" value={editLigne.tarifMoyen} onChange={(e) => setEditLigne({ ...editLigne, tarifMoyen: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Gros (DA)</Label>
                  <Input type="number" value={editLigne.tarifGros} onChange={(e) => setEditLigne({ ...editLigne, tarifGros: e.target.value })} />
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
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
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

// Settings Tab
function SettingsTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    platformCommission: '10',
    commissionPetit: '100',
    commissionMoyen: '200',
    commissionGros: '300',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch settings');
      }
      setSettings({
        platformCommission: String(data.platformCommission || 10),
        commissionPetit: String(data.commissionPetit || 100),
        commissionMoyen: String(data.commissionMoyen || 200),
        commissionGros: String(data.commissionGros || 300),
      });
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
          platformCommission: parseFloat(settings.platformCommission),
          commissionPetit: parseFloat(settings.commissionPetit),
          commissionMoyen: parseFloat(settings.commissionMoyen),
          commissionGros: parseFloat(settings.commissionGros),
        }),
      });
      
      if (response.ok) {
        toast({ title: 'Paramètres sauvegardés', description: 'Les paramètres ont été enregistrés avec succès' });
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder les paramètres', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Paramètres de la plateforme</CardTitle>
          <CardDescription>Configurez les commissions et paramètres globaux</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
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
              <div className="space-y-4">
                <Label>Commissions relais par format (DA)</Label>
                <div className="grid gap-4 md:grid-cols-3 max-w-lg">
                  <div className="space-y-2">
                    <Label className="text-sm">Petit</Label>
                    <Input 
                      type="number" 
                      value={settings.commissionPetit}
                      onChange={(e) => setSettings({ ...settings, commissionPetit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Moyen</Label>
                    <Input 
                      type="number" 
                      value={settings.commissionMoyen}
                      onChange={(e) => setSettings({ ...settings, commissionMoyen: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Gros</Label>
                    <Input 
                      type="number" 
                      value={settings.commissionGros}
                      onChange={(e) => setSettings({ ...settings, commissionGros: e.target.value })}
                    />
                  </div>
                </div>
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
