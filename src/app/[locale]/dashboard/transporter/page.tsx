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
import { Truck, Plus, Package, MapPin, DollarSign, Loader2, CheckCircle, Clock, Route, QrCode, Navigation, Scan, Wallet, ArrowUpFromLine, TrendingUp, History } from 'lucide-react';
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
        earnings: missions.reduce((sum: number, m: any) => sum + (m.colis?.netTransporteur || 0), 0),
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
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview"><MapPin className="h-4 w-4 mr-1 hidden sm:inline" />Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="trajets"><Route className="h-4 w-4 mr-1 hidden sm:inline" />Trajets</TabsTrigger>
            <TabsTrigger value="missions"><Package className="h-4 w-4 mr-1 hidden sm:inline" />Missions</TabsTrigger>
            <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-1 hidden sm:inline" />Scanner</TabsTrigger>
            <TabsTrigger value="wallet"><Wallet className="h-4 w-4 mr-1 hidden sm:inline" />Portefeuille</TabsTrigger>
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
      // Get parcels with status RECU_RELAIS (waiting for transport)
      const parcelsRes = await fetch('/api/parcels?status=RECU_RELAIS');
      const parcels = await parcelsRes.json();
      
      // Convert to mission-like format for display
      const missions = parcels.map((p: any) => ({
        id: p.id,
        colis: p,
        colisId: p.id,
      }));
      setAvailableMissions(missions);
      
      const trajetsRes = await fetch(`/api/trajets?transporteurId=${userId}`);
      setMyTrajets(await trajetsRes.json());
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
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-mono text-sm">{m.colis?.trackingNumber}</p>
                    <p className="text-xs text-slate-500">{m.colis?.villeDepart} → {m.colis?.villeArrivee}</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleAcceptMission(m.colisId)}
                    disabled={acceptingId === m.colisId}
                    className="bg-emerald-600 hover:bg-emerald-700"
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
                    <p className="text-xs text-slate-500">{new Date(t.dateDepart).toLocaleDateString('fr-FR')} - {t.placesColis - t.placesUtilisees} places restantes</p>
                  </div>
                  <Badge variant="outline">{t.placesUtilisees}/{t.placesColis}</Badge>
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await fetch('/api/trajets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          transporteurId: userId,
          placesColis: parseInt(formData.placesColis),
        }),
      });
      toast({ title: 'Trajet créé' });
      fetchTrajets();
      setFormData({ villeDepart: '', villeArrivee: '', dateDepart: '', placesColis: '10', villesEtapes: '' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
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
                <Label>Places disponibles</Label>
                <Input type="number" value={formData.placesColis} onChange={(e) => setFormData({ ...formData, placesColis: e.target.value })} />
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
                  <TableHead>Départ</TableHead>
                  <TableHead>Arrivée</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Places</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trajets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{WILAYAS.find(w => w.id === t.villeDepart)?.name}</TableCell>
                    <TableCell>{WILAYAS.find(w => w.id === t.villeArrivee)?.name}</TableCell>
                    <TableCell>{new Date(t.dateDepart).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{t.placesUtilisees}/{t.placesColis}</TableCell>
                    <TableCell>
                      <Badge className={`${TRAJET_STATUS.find(s => s.id === t.status)?.color} text-white`}>
                        {TRAJET_STATUS.find(s => s.id === t.status)?.label}
                      </Badge>
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

// Missions Tab
function MissionsTab({ userId }: { userId: string }) {
  const [missions, setMissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

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
    await fetch(`/api/missions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchMissions();
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
              <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Package className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-mono font-semibold">{m.colis?.trackingNumber}</p>
                    <p className="text-sm text-slate-500">{m.colis?.villeDepart} → {m.colis?.villeArrivee}</p>
                    <p className="text-xs text-slate-400">{m.colis?.format} - {m.colis?.netTransporteur} DA</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.status}</Badge>
                  {m.status === 'ASSIGNE' && (
                    <Button size="sm" onClick={() => handleStatusChange(m.id, 'EN_COURS')}>
                      <Navigation className="h-4 w-4 mr-1" />Démarrer
                    </Button>
                  )}
                  {m.status === 'EN_COURS' && (
                    <Button size="sm" className="bg-green-600" onClick={() => handleStatusChange(m.id, 'LIVRE')}>
                      <CheckCircle className="h-4 w-4 mr-1" />Livré
                    </Button>
                  )}
                </div>
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
      if (data.error) {
        toast({ title: 'Erreur', description: 'Colis non trouvé', variant: 'destructive' });
        setParcel(null);
      } else {
        setParcel(data);
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
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-mono font-bold">{parcel.trackingNumber}</p>
                  <p className="text-sm text-slate-500">
                    {WILAYAS.find(w => w.id === parcel.villeDepart)?.name || parcel.villeDepart} → {WILAYAS.find(w => w.id === parcel.villeArrivee)?.name || parcel.villeArrivee}
                  </p>
                  <p className="text-xs text-slate-400">Format: {parcel.format}</p>
                </div>
                <Badge className={`${PARCEL_STATUS.find(s => s.id === parcel.status)?.color} text-white`}>
                  {PARCEL_STATUS.find(s => s.id === parcel.status)?.label}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {['RECU_RELAIS'].includes(parcel.status) && (
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
                {['EN_TRANSPORT'].includes(parcel.status) && (
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleUpdateStatus('ARRIVE_RELAIS_DESTINATION')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Arrivé au relais
                  </Button>
                )}
                {['ARRIVE_RELAIS_DESTINATION', 'LIVRE'].includes(parcel.status) && (
                  <Badge className="bg-green-100 text-green-700 px-4 py-2">Colis déjà livré ou au relais</Badge>
                )}
              </div>
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
