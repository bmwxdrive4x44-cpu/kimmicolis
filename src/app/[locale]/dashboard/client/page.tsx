'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { WILAYAS, PARCEL_FORMATS, PARCEL_STATUS, PLATFORM_COMMISSION, DEFAULT_RELAY_COMMISSION, getTariff, generateTrackingNumber, generateQRData } from '@/lib/constants';
import { Package, Plus, History, MapPin, Loader2, CreditCard, Search, Truck, CheckCircle, Clock, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Helper function for role-based dashboard path
function getRoleBasedDashboardPath(role: string, locale: string): string {
  switch (role) {
    case 'ADMIN': return `/${locale}/dashboard/admin`;
    case 'TRANSPORTER': return `/${locale}/dashboard/transporter`;
    case 'RELAIS': return `/${locale}/dashboard/relais`;
    case 'CLIENT':
    default: return `/${locale}/dashboard/client`;
  }
}

function ClientDashboardContent() {
  const { data: session, status } = useSession();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialTab = useMemo(() => searchParams.get('track') ? 'track' : 'create', [searchParams]);
  const initialTracking = useMemo(() => searchParams.get('track') || '', [searchParams]);
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [stats, setStats] = useState({ created: 0, inTransit: 0, delivered: 0, totalSpent: 0 });

  // Simple redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    }
  }, [status, router, locale]);

  // Redirect if wrong role
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role && session.user.role !== 'CLIENT') {
      const paths: Record<string, string> = {
        'ADMIN': `/${locale}/dashboard/admin`,
        'TRANSPORTER': `/${locale}/dashboard/transporter`,
        'RELAIS': `/${locale}/dashboard/relais`,
      };
      const path = paths[session.user.role] || `/${locale}/dashboard/client`;
      window.location.href = path;
    }
  }, [status, session, locale]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchStats();
    }
  }, [session?.user?.id]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/parcels?clientId=${session?.user?.id}`);
      const parcels = await response.json();
      
      setStats({
        created: parcels.filter((p: any) => p.status === 'CREATED' || p.status === 'PAID').length,
        inTransit: parcels.filter((p: any) => ['RECU_RELAIS', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION'].includes(p.status)).length,
        delivered: parcels.filter((p: any) => p.status === 'LIVRE').length,
        totalSpent: parcels.reduce((sum: number, p: any) => sum + (p.prixClient || 0), 0),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="flex-1 container px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Mon Espace Client
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Bienvenue, {session.user.name}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Colis créés</CardTitle>
              <Package className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.created}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En transit</CardTitle>
              <Truck className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inTransit}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Livrés</CardTitle>
              <CheckCircle className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.delivered}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total dépensé</CardTitle>
              <CreditCard className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSpent} DA</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Créer un colis
            </TabsTrigger>
            <TabsTrigger value="track" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Suivi
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <CreateParcelForm userId={session.user.id} onCreated={() => { fetchStats(); setActiveTab('history'); }} />
          </TabsContent>

          <TabsContent value="track">
            <TrackingTab initialTracking={trackingNumber} setTrackingNumber={setTrackingNumber} />
          </TabsContent>

          <TabsContent value="history">
            <ParcelHistory userId={session.user.id} />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

// Create Parcel Form
function CreateParcelForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [relais, setRelais] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    villeDepart: '',
    villeArrivee: '',
    format: 'PETIT',
    relaisDepartId: '',
    relaisArriveeId: '',
    description: '',
    weight: '',
  });
  const [calculatedPrice, setCalculatedPrice] = useState<any>(null);

  useEffect(() => {
    fetchRelais();
  }, []);

  useEffect(() => {
    if (formData.villeDepart && formData.villeArrivee && formData.format) {
      calculatePrice();
    }
  }, [formData.villeDepart, formData.villeArrivee, formData.format]);

  const fetchRelais = async () => {
    try {
      const response = await fetch('/api/relais?status=APPROVED');
      const data = await response.json();
      setRelais(data);
    } catch (error) {
      console.error('Error fetching relais:', error);
    }
  };

  const calculatePrice = () => {
    const tarif = getTariff(formData.villeDepart, formData.villeArrivee, formData.format);
    const commissionRelais = DEFAULT_RELAY_COMMISSION[formData.format as keyof typeof DEFAULT_RELAY_COMMISSION] || 100;
    const commissionPlateforme = Math.round(tarif * PLATFORM_COMMISSION);
    const prixClient = tarif + commissionRelais + commissionPlateforme;

    setCalculatedPrice({
      tarif,
      commissionRelais,
      commissionPlateforme,
      prixClient,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const trackingNumber = generateTrackingNumber();
      const qrData = generateQRData(trackingNumber);

      const response = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber,
          clientId: userId,
          relaisDepartId: formData.relaisDepartId,
          relaisArriveeId: formData.relaisArriveeId,
          villeDepart: formData.villeDepart,
          villeArrivee: formData.villeArrivee,
          format: formData.format,
          description: formData.description,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          prixClient: calculatedPrice?.prixClient || 0,
          commissionPlateforme: calculatedPrice?.commissionPlateforme || 0,
          commissionRelais: calculatedPrice?.commissionRelais || 0,
          netTransporteur: calculatedPrice?.tarif || 0,
          qrCode: qrData,
          status: 'CREATED',
        }),
      });

      if (response.ok) {
        toast({ title: 'Colis créé avec succès', description: `N° de suivi: ${trackingNumber}` });
        setFormData({
          villeDepart: '',
          villeArrivee: '',
          format: 'PETIT',
          relaisDepartId: '',
          relaisArriveeId: '',
          description: '',
          weight: '',
        });
        setStep(1);
        onCreated();
      } else {
        throw new Error('Failed to create parcel');
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de créer le colis', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const relaisDepart = relais.filter(r => r.ville === formData.villeDepart);
  const relaisArrivee = relais.filter(r => r.ville === formData.villeArrivee);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un nouveau colis</CardTitle>
        <CardDescription>Remplissez les informations pour envoyer votre colis</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Route */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">1</span>
              Itinéraire
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ville de départ</Label>
                <Select value={formData.villeDepart} onValueChange={(v) => setFormData({ ...formData, villeDepart: v, relaisDepartId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ville d'arrivée</Label>
                <Select value={formData.villeArrivee} onValueChange={(v) => setFormData({ ...formData, villeArrivee: v, relaisArriveeId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Step 2: Relay Points */}
          {formData.villeDepart && formData.villeArrivee && (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">2</span>
                Points relais
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Point relais départ</Label>
                  <Select value={formData.relaisDepartId} onValueChange={(v) => setFormData({ ...formData, relaisDepartId: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {relaisDepart.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.commerceName} - {r.address}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {relaisDepart.length === 0 && <p className="text-sm text-orange-500">Aucun relais disponible dans cette ville</p>}
                </div>
                <div className="space-y-2">
                  <Label>Point relais destination</Label>
                  <Select value={formData.relaisArriveeId} onValueChange={(v) => setFormData({ ...formData, relaisArriveeId: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {relaisArrivee.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.commerceName} - {r.address}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {relaisArrivee.length === 0 && <p className="text-sm text-orange-500">Aucun relais disponible dans cette ville</p>}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Package Details */}
          {formData.relaisDepartId && formData.relaisArriveeId && (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">3</span>
                Détails du colis
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PARCEL_FORMATS.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label} ({f.dimensions})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Poids (kg) - Optionnel</Label>
                  <Input type="number" step="0.1" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} placeholder="Ex: 2.5" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description du contenu (optionnel)" />
              </div>
            </div>
          )}

          {/* Price Summary */}
          {calculatedPrice && (
            <Card className="bg-slate-50 dark:bg-slate-800">
              <CardContent className="py-4">
                <h4 className="font-semibold mb-3">Récapitulatif prix</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tarif transport</span>
                    <span>{calculatedPrice.tarif} DA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Commission relais</span>
                    <span>{calculatedPrice.commissionRelais} DA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Commission plateforme</span>
                    <span>{calculatedPrice.commissionPlateforme} DA</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total à payer</span>
                    <span className="text-emerald-600">{calculatedPrice.prixClient} DA</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading || !formData.relaisDepartId || !formData.relaisArriveeId} className="bg-emerald-600 hover:bg-emerald-700">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
              Créer le colis
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Tracking Tab
function TrackingTab({ initialTracking, setTrackingNumber }: { initialTracking: string; setTrackingNumber: (v: string) => void }) {
  const [tracking, setTracking] = useState(initialTracking);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!tracking) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/parcels?tracking=${tracking}`);
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error tracking parcel:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialTracking) {
      handleSearch();
    }
  }, [initialTracking]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suivi de colis</CardTitle>
        <CardDescription>Entrez votre numéro de suivi pour suivre votre colis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input
            placeholder="SCXXXXXXXXX"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className="font-mono"
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {result && !result.error && (
          <div className="space-y-6">
            {/* Status Timeline */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-slate-500">Numéro de suivi</p>
                  <p className="font-mono font-bold text-lg">{result.trackingNumber}</p>
                </div>
                <Badge className={`${PARCEL_STATUS.find(s => s.id === result.status)?.color} text-white px-4 py-2`}>
                  {PARCEL_STATUS.find(s => s.id === result.status)?.label}
                </Badge>
              </div>

              {/* Route */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <p className="text-sm text-slate-500">Départ</p>
                  <p className="font-semibold">{WILAYAS.find(w => w.id === result.villeDepart)?.name}</p>
                </div>
                <div className="flex-1 flex justify-center">
                  <Truck className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm text-slate-500">Arrivée</p>
                  <p className="font-semibold">{WILAYAS.find(w => w.id === result.villeArrivee)?.name}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                {PARCEL_STATUS.map((status, index) => {
                  const isActive = PARCEL_STATUS.findIndex(s => s.id === result.status) >= index;
                  const isCurrent = status.id === result.status;
                  return (
                    <div key={status.id} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                        {isActive ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>
                      <div className={isCurrent ? 'font-semibold' : 'text-slate-500'}>
                        {status.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="text-center">
                <div className="w-32 h-32 bg-white border rounded-lg flex items-center justify-center mb-2">
                  <QrCode className="h-20 w-20 text-slate-800" />
                </div>
                <p className="text-sm text-slate-500">QR Code</p>
              </div>
            </div>
          </div>
        )}

        {result?.error && (
          <div className="text-center py-8 text-red-500">
            Colis non trouvé
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Parcel History
function ParcelHistory({ userId }: { userId: string }) {
  const [colis, setColis] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchColis();
  }, [userId]);

  const fetchColis = async () => {
    try {
      const response = await fetch(`/api/parcels?clientId=${userId}`);
      const data = await response.json();
      setColis(data);
    } catch (error) {
      console.error('Error fetching parcels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique de mes colis</CardTitle>
        <CardDescription>{colis.length} colis</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : colis.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun colis pour le moment</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Suivi</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colis.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-medium">{c.trackingNumber}</TableCell>
                  <TableCell>{WILAYAS.find(w => w.id === c.villeDepart)?.name}</TableCell>
                  <TableCell>{WILAYAS.find(w => w.id === c.villeArrivee)?.name}</TableCell>
                  <TableCell>{PARCEL_FORMATS.find(f => f.id === c.format)?.label}</TableCell>
                  <TableCell>{c.prixClient} DA</TableCell>
                  <TableCell>
                    <Badge className={`${PARCEL_STATUS.find(s => s.id === c.status)?.color} text-white`}>
                      {PARCEL_STATUS.find(s => s.id === c.status)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
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
