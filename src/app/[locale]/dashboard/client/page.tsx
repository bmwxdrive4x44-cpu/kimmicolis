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
import Image from 'next/image';

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

  const initialTab = useMemo(() => searchParams.get('track') ? 'track' : 'create', [searchParams]);
  const initialTracking = useMemo(() => searchParams.get('track') || '', [searchParams]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [stats, setStats] = useState({ created: 0, inTransit: 0, delivered: 0, totalSpent: 0 });

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
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Créer un colis
            </TabsTrigger>
            <TabsTrigger value="track" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Suivi
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Paiement
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <CreateParcelForm
              userId={session.user.id}
              onCreated={fetchStats}
              onGoToHistory={() => { fetchStats(); setActiveTab('history'); }}
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
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

// Create Parcel Form
function CreateParcelForm({ userId, onCreated, onGoToHistory }: { userId: string; onCreated: () => void; onGoToHistory: () => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [relais, setRelais] = useState<any[]>([]);
  const [createdParcel, setCreatedParcel] = useState<any>(null);
  const [formData, setFormData] = useState({
    villeDepart: '',
    villeArrivee: '',
    format: 'PETIT',
    relaisDepartId: '',
    relaisArriveeId: '',
    description: '',
    weight: '',
    senderFirstName: '',
    senderLastName: '',
    senderPhone: '',
    recipientFirstName: '',
    recipientLastName: '',
    recipientPhone: '',
  });
  const [calculatedPrice, setCalculatedPrice] = useState<any>(null);

  const formatRelayHours = (relay: any) => {
    if (!relay?.openTime || !relay?.closeTime) return 'Horaires non renseignés';
    return `${relay.openTime} - ${relay.closeTime}`;
  };

  useEffect(() => { fetchRelais(); }, []);

  useEffect(() => {
    if (formData.villeDepart && formData.villeArrivee && formData.format) calculatePrice();
  }, [formData.villeDepart, formData.villeArrivee, formData.format]);

  const fetchRelais = async () => {
    try {
      const response = await fetch('/api/relais?status=APPROVED');
      setRelais(await response.json());
    } catch (error) {
      console.error('Error fetching relais:', error);
    }
  };

  const calculatePrice = () => {
    const tarif = getTariff(formData.villeDepart, formData.villeArrivee, formData.format);
    const commissionRelais = DEFAULT_RELAY_COMMISSION[formData.format as keyof typeof DEFAULT_RELAY_COMMISSION] || 100;
    const commissionPlateforme = Math.round(tarif * PLATFORM_COMMISSION);
    setCalculatedPrice({ tarif, commissionRelais, commissionPlateforme, prixClient: tarif + commissionRelais + commissionPlateforme });
  };

  const resetForm = () => {
    setFormData({ villeDepart: '', villeArrivee: '', format: 'PETIT', relaisDepartId: '', relaisArriveeId: '', description: '', weight: '', senderFirstName: '', senderLastName: '', senderPhone: '', recipientFirstName: '', recipientLastName: '', recipientPhone: '' });
    setCalculatedPrice(null);
    setCreatedParcel(null);
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
          senderFirstName: formData.senderFirstName,
          senderLastName: formData.senderLastName,
          senderPhone: formData.senderPhone,
          recipientFirstName: formData.recipientFirstName,
          recipientLastName: formData.recipientLastName,
          recipientPhone: formData.recipientPhone,
          prixClient: calculatedPrice?.prixClient || 0,
          commissionPlateforme: calculatedPrice?.commissionPlateforme || 0,
          commissionRelais: calculatedPrice?.commissionRelais || 0,
          netTransporteur: calculatedPrice?.tarif || 0,
          qrCode: qrData,
          status: 'CREATED',
        }),
      });
      if (response.ok) {
        const created = await response.json();
        setCreatedParcel(created);
        toast({ title: 'Colis créé avec succès', description: `Suivi: ${created.trackingNumber}` });
        onCreated();
      } else {
        toast({ title: 'Erreur', description: 'Impossible de créer le colis', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de créer le colis', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const relaisDepart = relais.filter(r => r.ville === formData.villeDepart);
  const relaisArrivee = relais.filter(r => r.ville === formData.villeArrivee);

  // — Success card after creation
  if (createdParcel) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 pb-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-9 w-9 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold mb-1">Colis créé !</h2>
            <p className="text-slate-500 text-sm">Déposez le colis au relais et réglez en espèces.</p>
          </div>

          {/* Numéro de suivi */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Numéro de suivi</p>
            <p className="font-mono text-2xl font-bold text-emerald-600">{createdParcel.trackingNumber}</p>
          </div>

          {/* Code de retrait */}
          {createdParcel.withdrawalCode && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-center mb-3">
              <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Code de retrait destinataire</p>
              <p className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-300">{createdParcel.withdrawalCode}</p>
              <p className="text-xs text-blue-500 mt-1">À communiquer uniquement au destinataire</p>
            </div>
          )}

          {/* QR Code */}
          {createdParcel.qrCodeImage && (
            <div className="flex flex-col items-center mb-4">
              <p className="text-xs text-slate-500 mb-2">QR Code à présenter au relais</p>
              <div className="p-3 bg-white border rounded-lg shadow-sm">
                <Image src={createdParcel.qrCodeImage} alt="QR Code colis" width={150} height={150} />
              </div>
            </div>
          )}

          {/* Info relais dépôt */}
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3 text-sm mb-6">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-0.5">📍 Relais de dépôt</p>
            <p className="text-amber-700 dark:text-amber-400">{relais.find(r => r.id === formData.relaisDepartId)?.commerceName}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />Créer un autre colis
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={onGoToHistory}>
              <History className="h-4 w-4 mr-2" />Voir mon historique
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un nouveau colis</CardTitle>
        <CardDescription>Remplissez les informations pour envoyer votre colis</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Barre de progression */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <div className={`flex items-center gap-1.5 ${formData.villeDepart && formData.villeArrivee ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${formData.villeDepart && formData.villeArrivee ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
            Itinéraire
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className={`flex items-center gap-1.5 ${formData.relaisDepartId && formData.relaisArriveeId ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${formData.relaisDepartId && formData.relaisArriveeId ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
            Relais
          </div>
          <div className="flex-1 h-px bg-slate-200" />
          <div className={`flex items-center gap-1.5 ${formData.senderFirstName && formData.recipientFirstName ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${formData.senderFirstName && formData.recipientFirstName ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</span>
            Colis &amp; identités
          </div>
        </div>

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
                        <SelectItem key={r.id} value={r.id}>{r.commerceName} - {r.address} ({formatRelayHours(r)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Dépôt obligatoire dans ce relais uniquement (aucun dépôt possible dans un autre relais, même ville).
                  </p>
                  {relaisDepart.length === 0 && <p className="text-sm text-orange-500">Aucun relais disponible dans cette ville</p>}
                </div>
                <div className="space-y-2">
                  <Label>Point relais destination</Label>
                  <Select value={formData.relaisArriveeId} onValueChange={(v) => setFormData({ ...formData, relaisArriveeId: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {relaisArrivee.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.commerceName} - {r.address} ({formatRelayHours(r)})</SelectItem>
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom expéditeur</Label>
                  <Input value={formData.senderLastName} onChange={(e) => setFormData({ ...formData, senderLastName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Prénom expéditeur</Label>
                  <Input value={formData.senderFirstName} onChange={(e) => setFormData({ ...formData, senderFirstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone expéditeur</Label>
                  <Input value={formData.senderPhone} onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })} placeholder="Ex: 0550123456" />
                </div>
                <div className="space-y-2">
                  <Label>Nom destinataire</Label>
                  <Input value={formData.recipientLastName} onChange={(e) => setFormData({ ...formData, recipientLastName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Prénom destinataire</Label>
                  <Input value={formData.recipientFirstName} onChange={(e) => setFormData({ ...formData, recipientFirstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone destinataire</Label>
                  <Input value={formData.recipientPhone} onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })} placeholder="Ex: 0660123456" />
                </div>
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
                  <div className="flex justify-between">
                    <span>Code de retrait</span>
                    <span>{formData.withdrawalCode || 'Généré automatiquement'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {formData.relaisDepartId && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 p-3 text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                ⚠️ Relais de dépôt obligatoire
              </p>
              <p className="text-amber-700 dark:text-amber-400">
                Vous devez remettre ce colis exclusivement à :
                <span className="font-bold"> {relais.find((r: any) => r.id === formData.relaisDepartId)?.commerceName}</span>
              </p>
              <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                Aucun dépôt possible dans un autre relais, même ville.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={
                isLoading ||
                !formData.relaisDepartId ||
                !formData.relaisArriveeId ||
                !formData.senderFirstName ||
                !formData.senderLastName ||
                !formData.senderPhone ||
                !formData.recipientFirstName ||
                !formData.recipientLastName ||
                !formData.recipientPhone
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
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
  const currentStatusIndex = result ? statusOrder.indexOf(result.status) : -1;

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
                <Badge className={`${PARCEL_STATUS.find(s => s.id === result.status)?.color} text-white shrink-0`}>
                  {PARCEL_STATUS.find(s => s.id === result.status)?.label}
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
                <Truck className="h-5 w-5 text-emerald-500 shrink-0" />
                <div className="flex-1 text-right">
                  <p className="text-xs text-slate-500">Arrivée</p>
                  <p className="font-semibold text-sm">{WILAYAS.find(w => w.id === result.villeArrivee)?.name || result.villeArrivee}</p>
                  {result.relaisArrivee?.commerceName && (
                    <p className="text-xs text-slate-400">{result.relaisArrivee.commerceName}</p>
                  )}
                </div>
              </div>

              {/* Barre de progression statut */}
              <div className="flex items-center gap-1">
                {statusOrder.map((s, i) => (
                  <div
                    key={s}
                    className={`flex-1 h-1.5 rounded-full transition-all ${
                      i <= currentStatusIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Créé</span>
                <span>{PARCEL_STATUS.find(s => s.id === result.status)?.label}</span>
                <span>Livré</span>
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
                  <Image src={result.qrCodeImage} alt="QR Code" width={120} height={120} />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Payment Tab - Show parcels awaiting cash payment at relay
function PaymentTab({ userId }: { userId: string }) {
  const { push } = useRouter();
  const locale = useLocale();
  const [parcels, setParcels] = useState<any[]>([]);
  const [relaisMap, setRelaisMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const [parcelRes, relaisRes] = await Promise.all([
        fetch(`/api/parcels?clientId=${userId}&status=CREATED`),
        fetch('/api/relais?status=APPROVED'),
      ]);
      const parcelData = await parcelRes.json();
      const relaisData = await relaisRes.json();
      
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
        <CardTitle>Paiement au relais</CardTitle>
        <CardDescription>Colis en attente de paiement en espèces au point relais de départ</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : parcels.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-slate-600 mb-4">Aucun colis en attente de paiement</p>
            <Button variant="outline" onClick={() => push(`/${locale}/dashboard/client?tab=create`)}>
              Créer un nouveau colis
            </Button>
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
                        <p className="text-sm text-muted-foreground">Format</p>
                        <p className="font-semibold">{parcel.format}</p>
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
                        💳 <span className="font-semibold">Paiement en espèces au point relais de départ</span>
                        <br />
                        📍 {relaisDept?.commerceName || 'Relais non disponible'} - {relaisDept?.address}
                      </p>
                    </div>
                    <Button
                      onClick={() => push(`/${locale}/dashboard/client?tab=track&track=${parcel.trackingNumber}`)}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Voir les détails
                    </Button>
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
  const [colis, setColis] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchColis(); }, [userId]);

  const fetchColis = async () => {
    try {
      const response = await fetch(`/api/parcels?clientId=${userId}`);
      setColis(await response.json());
    } catch (error) {
      console.error('Error fetching parcels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = filter === 'all' ? colis : colis.filter(c => c.status === filter);

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
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Suivi</TableHead>
                <TableHead>Trajet</TableHead>
                <TableHead>Format</TableHead>
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
                  <TableCell>{PARCEL_FORMATS.find(f => f.id === c.format)?.label}</TableCell>
                  <TableCell className="font-semibold">{c.prixClient} DA</TableCell>
                  <TableCell>
                    <Badge className={`${PARCEL_STATUS.find(s => s.id === c.status)?.color} text-white text-xs`}>
                      {PARCEL_STATUS.find(s => s.id === c.status)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => onTrack(c.trackingNumber)}>
                      <MapPin className="h-3 w-3 mr-1" />Suivre
                    </Button>
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
