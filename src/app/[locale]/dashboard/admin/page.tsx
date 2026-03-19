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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { WILAYAS, USER_ROLES, PARCEL_STATUS, RELAIS_STATUS, PARCEL_FORMATS } from '@/lib/constants';
import { Users, Package, Truck, Store, DollarSign, CheckCircle, XCircle, Loader2, Plus, Settings, BarChart3, MapPin, Trash2, Pencil, Eye, EyeOff } from 'lucide-react';
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
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-2" />Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Utilisateurs</TabsTrigger>
            <TabsTrigger value="parcels"><Package className="h-4 w-4 mr-2" />Colis</TabsTrigger>
            <TabsTrigger value="relays"><Store className="h-4 w-4 mr-2" />Relais</TabsTrigger>
            <TabsTrigger value="lines"><MapPin className="h-4 w-4 mr-2" />Lignes</TabsTrigger>
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
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Colis par statut</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.parcelsByStatus?.length > 0 ? (
              stats.parcelsByStatus.map((item: any) => (
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
            {stats?.recentParcels?.length > 0 ? (
              stats.recentParcels.slice(0, 5).map((p: any) => (
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
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
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

  const filteredUsers = filter === 'all' ? users : users.filter(u => u.role === filter);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestion des utilisateurs</CardTitle>
              <CardDescription>{users.length} utilisateurs inscrits</CardDescription>
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
      setColis(data);
    } catch (error) {
      console.error('Error fetching parcels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredColis = filter === 'all' ? colis : colis.filter(c => c.status === filter);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestion des colis</CardTitle>
            <CardDescription>{colis.length} colis au total</CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {PARCEL_STATUS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
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
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => { fetchRelais(); }, []);

  const fetchRelais = async () => {
    try {
      const response = await fetch('/api/relais');
      const data = await response.json();
      setRelais(data);
    } catch (error) {
      console.error('Error fetching relais:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    await fetch(`/api/relais/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    toast({ title: 'Relais approuvé' });
    fetchRelais();
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/relais/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED' }),
    });
    toast({ title: 'Relais rejeté' });
    fetchRelais();
  };

  const filteredRelais = filter === 'all' ? relais : relais.filter(r => r.status === filter);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Validation des points relais</CardTitle>
            <CardDescription>{relais.filter(r => r.status === 'PENDING').length} demandes en attente</CardDescription>
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
                </div>
              </div>
            ))}
            {filteredRelais.length === 0 && <p className="text-center text-slate-500 py-8">Aucun relais</p>}
          </div>
        )}
      </CardContent>
    </Card>
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
      setLignes(data);
    } catch (error) {
      console.error('Error fetching lignes:', error);
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
            <CardTitle>Lignes de transport ({lignes.length})</CardTitle>
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
                  {lignes.map((ligne) => (
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
      setSettings({
        platformCommission: String(data.platformCommission || 10),
        commissionPetit: String(data.commissionPetit || 100),
        commissionMoyen: String(data.commissionMoyen || 200),
        commissionGros: String(data.commissionGros || 300),
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
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
          <CardTitle>Initialiser les données</CardTitle>
          <CardDescription>Créer les utilisateurs de test et les lignes de transport</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <a href="/api/seed" target="_blank">Initialiser les données de démo</a>
          </Button>
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
