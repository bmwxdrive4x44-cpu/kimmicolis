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
import { Truck, Plus, Package, MapPin, DollarSign, Loader2, CheckCircle, Clock, Route, QrCode, Scan, Wallet } from 'lucide-react';
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
  const [wallet, setWallet] = useState({ pending: 0, available: 0, paid: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    } else if (status === 'authenticated' && session?.user?.role !== 'TRANSPORTER') {
      router.push(getRoleBasedDashboardPath(session.user.role, locale));
    }
  }, [status, session, router, locale]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchStats();
    }
  }, [session?.user?.id]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [trajetsRes, missionsRes, gainsRes] = await Promise.all([
        fetch(`/api/trajets?transporteurId=${session?.user?.id}`),
        fetch(`/api/missions?transporteurId=${session?.user?.id}`),
        fetch(`/api/transporteur/gains`),
      ]);
      const trajets = await trajetsRes.json();
      const missions = await missionsRes.json();
      const gains = gainsRes.ok ? await gainsRes.json() : null;
      
      setStats({
        trajets: trajets.length,
        missions: missions.filter((m: any) => ['ASSIGNE', 'PICKED_UP'].includes(m.status)).length,
        completed: missions.filter((m: any) => m.status === 'COMPLETED').length,
        earnings: gains?.wallet?.total ?? missions.reduce((sum: number, m: any) => sum + (m.gainAmount || m.colis?.netTransporteur || 0), 0),
      });
      if (gains?.wallet) setWallet(gains.wallet);
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

  if (!session?.user || session.user.role !== 'TRANSPORTER') {
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
              <CardTitle className="text-sm font-medium">Gains disponibles</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{wallet.available.toFixed(0)} DA</div>
              {wallet.pending > 0 && <p className="text-xs text-slate-500">{wallet.pending.toFixed(0)} DA en attente</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gains totaux</CardTitle>
              <Wallet className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.earnings.toFixed(0)} DA</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="overview"><MapPin className="h-4 w-4 mr-2" />Vue d&apos;ensemble</TabsTrigger>
            <TabsTrigger value="trajets"><Route className="h-4 w-4 mr-2" />Mes trajets</TabsTrigger>
            <TabsTrigger value="missions"><Package className="h-4 w-4 mr-2" />Missions</TabsTrigger>
            <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-2" />Scanner</TabsTrigger>
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
            <ScanTab userId={session.user.id} />
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
      // Get parcels available for transport (new + legacy statuses)
      const parcelsRes = await fetch('/api/parcels?available=true');
      const parcels = await parcelsRes.json();
      
      // Convert to mission-like format for display
      const missions = (Array.isArray(parcels) ? parcels : []).map((p: any) => ({
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
  const { toast } = useToast();
  const [missions, setMissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const handleDeliveryAction = async (missionId: string, trackingNumber: string, action: 'pickup' | 'arrive_relay') => {
    setActionLoading(missionId);
    try {
      const response = await fetch('/api/delivery/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, missionId, action }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast({ title: 'Erreur', description: result.error ?? 'Action échouée', variant: 'destructive' });
      } else {
        toast({ title: '✅ Succès', description: result.message });
        fetchMissions();
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setActionLoading(null);
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
              <SelectItem value="PICKED_UP">En transit</SelectItem>
              <SelectItem value="COMPLETED">Livrées</SelectItem>
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
                    <p className="text-xs text-slate-400">
                      {m.colis?.format} · Gain: {(m.gainAmount || m.colis?.netTransporteur || 0).toFixed(0)} DA
                      {m.gainStatus === 'AVAILABLE' && <span className="ml-1 text-emerald-600 font-semibold">✓ Disponible</span>}
                      {m.gainStatus === 'PAID' && <span className="ml-1 text-blue-600 font-semibold">✓ Payé</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{m.status}</Badge>
                  {/* Pickup action: ASSIGNE → PICKED_UP */}
                  {m.status === 'ASSIGNE' && (
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600"
                      onClick={() => handleDeliveryAction(m.id, m.colis?.trackingNumber, 'pickup')}
                      disabled={actionLoading === m.id}
                    >
                      {actionLoading === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Scan className="h-3 w-3 mr-1" />Prendre en charge</>}
                    </Button>
                  )}
                  {/* Arrive relay action: PICKED_UP → ARRIVED_RELAY */}
                  {m.status === 'PICKED_UP' && (
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700"
                      onClick={() => handleDeliveryAction(m.id, m.colis?.trackingNumber, 'arrive_relay')}
                      disabled={actionLoading === m.id}
                    >
                      {actionLoading === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-3 w-3 mr-1" />Livrer au relais</>}
                    </Button>
                  )}
                  {m.status === 'COMPLETED' && (
                    <Badge className="bg-green-100 text-green-700 text-xs">Livré</Badge>
                  )}
                </div>
              </div>
            ))}
            {filteredMissions.length === 0 && (
              <p className="text-center text-slate-500 py-8">Aucune mission</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Scan Tab (transporter)
function ScanTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [trackingInput, setTrackingInput] = useState('');
  const [parcel, setParcel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const handleSearch = async () => {
    if (!trackingInput.trim()) return;
    setIsLoading(true);
    setParcel(null);
    try {
      const response = await fetch(`/api/parcels?tracking=${trackingInput.trim().toUpperCase()}`);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setParcel(data[0]);
      } else if (data?.trackingNumber) {
        setParcel(data);
      } else {
        toast({ title: 'Introuvable', description: 'Aucun colis avec ce numéro', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeliveryAction = async (action: 'pickup' | 'arrive_relay') => {
    if (!parcel) return;
    setIsActioning(true);
    try {
      const response = await fetch('/api/delivery/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: parcel.trackingNumber, action }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast({ title: 'Erreur', description: result.error ?? 'Action échouée', variant: 'destructive' });
      } else {
        toast({ title: '✅ Succès', description: result.message });
        setParcel({ ...parcel, status: result.newStatus });
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
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
          <CardTitle className="flex items-center gap-2"><Scan className="h-5 w-5" />Scanner QR Code</CardTitle>
          <CardDescription>Scannez le QR code du colis lors de la prise en charge ou de la livraison au relais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Numéro de suivi"
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

          {parcel && (
            <Card className="border-2 border-slate-200">
              <CardContent className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold">{parcel.trackingNumber}</p>
                    <p className="text-sm text-slate-500">{parcel.villeDepart} → {parcel.villeArrivee} · {parcel.format}</p>
                    <p className="text-xs text-slate-400">Gain: {(parcel.netTransporteur ?? 0).toFixed(0)} DA</p>
                  </div>
                  <Badge className={`${statusColor(parcel.status)} text-white`}>{statusLabel(parcel.status)}</Badge>
                </div>

                {/* Pickup action */}
                {['DEPOSITED_RELAY', 'ASSIGNED', 'RECU_RELAIS'].includes(parcel.status) && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg p-4">
                    <p className="font-semibold text-orange-800 mb-2 text-sm">Prise en charge du colis au relais de départ</p>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      disabled={isActioning}
                      onClick={() => handleDeliveryAction('pickup')}
                    >
                      {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                      Scanner — Prise en charge
                    </Button>
                  </div>
                )}

                {/* Arrive relay action */}
                {['PICKED_UP', 'EN_TRANSPORT'].includes(parcel.status) && (
                  <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 rounded-lg p-4">
                    <p className="font-semibold text-teal-800 mb-2 text-sm">Livraison au relais de destination</p>
                    <Button
                      className="bg-teal-600 hover:bg-teal-700"
                      disabled={isActioning}
                      onClick={() => handleDeliveryAction('arrive_relay')}
                    >
                      {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Scanner — Livré au relais
                    </Button>
                  </div>
                )}

                {['ARRIVED_RELAY', 'ARRIVE_RELAIS_DESTINATION', 'DELIVERED', 'LIVRE'].includes(parcel.status) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-700 text-sm font-semibold">✅ Colis livré au relais de destination</p>
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
