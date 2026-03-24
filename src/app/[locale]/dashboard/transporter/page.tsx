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
import { WILAYAS, PARCEL_STATUS, TRAJET_STATUS } from '@/lib/constants';
import { Truck, Plus, Package, MapPin, DollarSign, Loader2, CheckCircle, Clock, Route, QrCode, Navigation, Scan, Wallet, ArrowUpFromLine, TrendingUp, History, Save, Pencil, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function getRoleBasedDashboardPath(role: string, locale: string): string {
  switch (role) {
    case 'ADMIN': return `/${locale}/dashboard/admin`;
    case 'TRANSPORTER': return `/${locale}/dashboard/transporter`;
    case 'RELAIS': return `/${locale}/dashboard/relais`;
    default: return `/${locale}/dashboard/client`;
  }
}

export default function TransporterDashboard() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ trajets: 0, missions: 0, completed: 0, earnings: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    } else if (status === 'authenticated' && session?.user?.role !== 'TRANSPORTER') {
      router.push(getRoleBasedDashboardPath(session.user.role, locale));
    }
  }, [status, session, router, locale]);

  // Check if user has transporter profile
  useEffect(() => {
    const checkProfile = async () => {
      if (!session?.user?.id) return;
      try {
        const response = await fetch(`/api/transporters?userId=${session.user.id}`);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setHasProfile(true);
        } else {
          // Redirect to profile completion page
          router.push(`/${locale}/complete-profile/transporter`);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
      }
    };

    if (status === 'authenticated' && session?.user?.role === 'TRANSPORTER') {
      checkProfile();
    }
  }, [status, session, router, locale]);

  useEffect(() => {
    if (session?.user?.id && hasProfile) {
      fetchStats();
    }
  }, [session?.user?.id, hasProfile]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [trajetsRes, missionsRes] = await Promise.all([
        fetch(`/api/trajets?transporteurId=${session?.user?.id}`),
        fetch(`/api/missions?transporteurId=${session?.user?.id}`),
      ]);
      const trajets = await trajetsRes.json();
      const missions = await missionsRes.json();
      
      setStats({
        trajets: trajets.length,
        missions: missions.filter((m: any) => m.status === 'ASSIGNE' || m.status === 'EN_COURS').length,
        completed: missions.filter((m: any) => m.status === 'LIVRE').length,
        earnings: missions.filter((m: any) => m.status === 'LIVRE').reduce((sum: number, m: any) => sum + (m.colis?.netTransporteur || 0), 0),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || (isLoading && hasProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!session?.user || session.user.role !== 'TRANSPORTER' || !hasProfile) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Espace Transporteur</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Bienvenue, {session.user.name}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mes trajets</CardTitle>
              <Route className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.trajets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Missions actives</CardTitle>
              <Truck className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.missions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Livrés</CardTitle>
              <CheckCircle className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gains</CardTitle>
              <DollarSign className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.earnings} DA</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="overview"><MapPin className="h-4 w-4 mr-1 hidden sm:inline" />Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="trajets"><Route className="h-4 w-4 mr-1 hidden sm:inline" />Trajets</TabsTrigger>
            <TabsTrigger value="missions"><Package className="h-4 w-4 mr-1 hidden sm:inline" />Missions</TabsTrigger>
            <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-1 hidden sm:inline" />Scanner</TabsTrigger>
            <TabsTrigger value="wallet"><Wallet className="h-4 w-4 mr-1 hidden sm:inline" />Portefeuille</TabsTrigger>
            <TabsTrigger value="profil"><Truck className="h-4 w-4 mr-1 hidden sm:inline" />Mon profil</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab userId={session.user.id} setActiveTab={setActiveTab} />
          </TabsContent>
          <TabsContent value="trajets">
            <TrajetsTab userId={session.user.id} />
          </TabsContent>
          <TabsContent value="missions">
            <MissionsTab userId={session.user.id} />
          </TabsContent>
          <TabsContent value="scan">
            <ScanTab />
          </TabsContent>
          <TabsContent value="wallet">
            <WalletTab userId={session.user.id} />
          </TabsContent>
          <TabsContent value="profil">
            <ProfilTab userId={session.user.id} userName={session.user.name || ''} />
          </TabsContent>
        </Tabs>
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Missions disponibles</CardTitle>
          <CardDescription>Colis en attente de transport</CardDescription>
        </CardHeader>
        <CardContent>
          {availableMissions.length === 0 ? (
            <p className="text-center text-slate-500 py-4">Aucune mission disponible</p>
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
                      {m.colis?.format} · Relais: {m.colis?.relaisDepart?.commerceName || '—'}
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
            <p className="text-center text-slate-500 py-4">Aucun trajet programmé</p>
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
  const [trajets, setTrajets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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
  });

  useEffect(() => { fetchTrajets(); }, [userId]);

  const fetchTrajets = async () => {
    try {
      const response = await fetch(`/api/trajets?transporteurId=${userId}`);
      setTrajets(await response.json());
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
    setIsCreating(true);
    try {
      const response = await fetch('/api/trajets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          transporteurId: userId,
          placesColis: parseInt(formData.placesColis),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Impossible d\'enregistrer le trajet');
      }

      toast({ title: 'Trajet enregistré', description: 'Le trajet a bien été publié.' });
      fetchTrajets();
      setFormData({ villeDepart: '', villeArrivee: '', dateDepart: '', placesColis: '10', villesEtapes: '' });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'enregistrer le trajet',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Publier un trajet</CardTitle>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Date de départ</Label>
                <Input type="datetime-local" value={formData.dateDepart} onChange={(e) => setFormData({ ...formData, dateDepart: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Capacité colis (max)</Label>
                <Input type="number" min={1} step={1} value={formData.placesColis} onChange={(e) => setFormData({ ...formData, placesColis: e.target.value })} placeholder="Ex: 10" />
                <p className="text-xs text-slate-500">Nombre maximum de colis que vous pouvez transporter sur ce trajet.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Villes étapes (optionnel, séparées par des virgules)</Label>
              <Input value={formData.villesEtapes} onChange={(e) => setFormData({ ...formData, villesEtapes: e.target.value })} placeholder="Ex: blida, medea" />
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
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(t.dateDepart).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{Math.max((t.placesColis || 0) - (t.placesUtilisees || 0), 0)} dispo</p>
                      <p className="text-xs text-slate-500">Chargé {t.placesUtilisees}/{t.placesColis}</p>
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
  LIVRE: 'Livré',
};

// Missions Tab
function MissionsTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [missions, setMissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { fetchMissions(); }, [userId]);

  const fetchMissions = async () => {
    try {
      const response = await fetch(`/api/missions?transporteurId=${userId}`);
      setMissions(await response.json());
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
        const labels: Record<string, string> = { EN_COURS: 'Transport démarré', LIVRE: 'Colis livré au relais' };
        toast({ title: labels[status] || 'Statut mis à jour' });
        fetchMissions();
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
              <SelectItem value="LIVRE">Livrées</SelectItem>
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
                        {m.colis?.format}
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
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={processingId === m.id} onClick={() => handleStatusChange(m.id, 'LIVRE')}>
                        {processingId === m.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                        Livré
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
  );
}

// Scan Tab
function ScanTab() {
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
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/parcels/${parcel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        toast({ title: 'Statut mis à jour', description: `Le colis est maintenant: ${PARCEL_STATUS.find(s => s.id === status)?.label}` });
        setParcel({ ...parcel, status });
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
                  <p className="text-xs text-slate-400">Format : {parcel.format}</p>
                </div>
                <Badge className={`${PARCEL_STATUS.find(s => s.id === parcel.status)?.color} text-white shrink-0`}>
                  {PARCEL_STATUS.find(s => s.id === parcel.status)?.label}
                </Badge>
              </div>

              {/* Relais */}
              {(parcel.relaisDepart || parcel.relaisArrivee) && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-white dark:bg-slate-700 rounded border">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Relais départ</p>
                    <p>{parcel.relaisDepart?.commerceName}</p>
                    <p className="text-slate-400">{parcel.relaisDepart?.ville} · {parcel.relaisDepart?.address}</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-700 rounded border">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">Relais arrivée</p>
                    <p>{parcel.relaisArrivee?.commerceName}</p>
                    <p className="text-slate-400">{parcel.relaisArrivee?.ville} · {parcel.relaisArrivee?.address}</p>
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
                  <Badge className="bg-green-100 text-green-700 px-4 py-2">✓ Colis livré / au relais</Badge>
                )}
              </div>

              {/* Historique tracking */}
              {parcel.trackingHistory && parcel.trackingHistory.length > 0 && (
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
  );
}

// Wallet Tab — Portefeuille transporteur
function WalletTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const fetchWallet = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/wallet?transporteurId=${userId}`);
      const data = await res.json();
      setWallet(data.wallet);
      setMissions(data.missions || []);
    } catch {
      // wallet API might not exist yet
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchWallet(); }, [userId]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { toast({ title: 'Montant invalide', variant: 'destructive' }); return; }
    if (wallet && amount > wallet.availableEarnings) {
      toast({ title: 'Solde insuffisant', description: `Disponible : ${wallet.availableEarnings.toFixed(0)} DA`, variant: 'destructive' });
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
      else { toast({ title: 'Retrait enregistré', description: `${amount.toFixed(0)} DA retiré avec succès` }); setWithdrawAmount(''); fetchWallet(); }
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Solde cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 border-yellow-200">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-yellow-700 mb-1">En attente (livraisons en cours)</p>
            <p className="text-3xl font-bold text-yellow-700">{wallet?.pendingEarnings?.toFixed(0) ?? 0} DA</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 border-emerald-200">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-emerald-700 mb-1">Disponible au retrait</p>
            <p className="text-3xl font-bold text-emerald-700">{wallet?.availableEarnings?.toFixed(0) ?? 0} DA</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 border-blue-200">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-blue-700 mb-1">Total retiré</p>
            <p className="text-3xl font-bold text-blue-700">{wallet?.totalWithdrawn?.toFixed(0) ?? 0} DA</p>
          </CardContent>
        </Card>
      </div>

      {/* Retrait */}
      {(wallet?.availableEarnings ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowUpFromLine className="h-5 w-5 text-emerald-600" />Demander un retrait</CardTitle>
            <CardDescription>Retirez vos gains disponibles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 max-w-sm">
              <Input type="number" placeholder={`Max : ${wallet?.availableEarnings?.toFixed(0)} DA`} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} min="1" max={wallet?.availableEarnings} />
              <Button onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount} className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0">
                {isWithdrawing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                Retirer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique missions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Historique des missions</CardTitle>
        </CardHeader>
        <CardContent>
          {missions.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Aucune mission terminée</p>
          ) : (
            <div className="space-y-3">
              {missions.slice(0, 20).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold text-sm">{m.colis?.villeDepart} → {m.colis?.villeArrivee}</p>
                    <p className="text-xs text-slate-500 font-mono">#{m.colis?.trackingNumber}</p>
                    <p className="text-xs text-slate-400">{new Date(m.updatedAt ?? m.createdAt).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{m.colis?.netTransporteur?.toFixed(0) ?? 0} DA</p>
                    <Badge className={`text-xs ${m.status === 'LIVRE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {m.status === 'LIVRE' ? 'Livré' : m.status}
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

// Profil Tab
function ProfilTab({ userId, userName }: { userId: string; userName: string }) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
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
        name: uData?.name || '',
        email: uData?.email || '',
        phone: uData?.phone || '',
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
      const userPayload: any = { name: form.name, email: form.email, phone: form.phone };
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
            fullName: form.fullName || form.name,
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
    <div className="space-y-6 max-w-2xl">
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
                  <Label>Nom complet</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, fullName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
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
                <p className="text-xs text-slate-400 uppercase tracking-wide">Nom complet</p>
                <p className="font-medium">{profile.fullName || userName}</p>
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
