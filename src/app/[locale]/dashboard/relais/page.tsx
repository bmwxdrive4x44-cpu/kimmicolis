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
import { WILAYAS, PARCEL_STATUS, RELAIS_STATUS, DEFAULT_RELAY_COMMISSION } from '@/lib/constants';
import { Store, Package, QrCode, DollarSign, Loader2, CheckCircle, Clock, Scan, ArrowDownToLine, ArrowUpFromLine, Settings, BarChart3, AlertCircle, Save } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Set a timeout to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    } else if (status === 'authenticated' && session?.user?.role && session.user.role !== 'RELAIS') {
      const correctPath = getRoleBasedDashboardPath(session.user.role, locale);
      window.location.href = correctPath;
    }
  }, [status, session, router, locale]);

  useEffect(() => {
    if (session?.user?.id && session?.user?.role === 'RELAIS') {
      fetchRelaisInfo();
    } else if (status === 'authenticated') {
      setIsLoading(false);
    }
  }, [session?.user?.id, session?.user?.role, status]);

  const fetchRelaisInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/relais?userId=${session?.user?.id}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const relais = data[0];
        setRelaisInfo(relais);
        
        // Fetch stats
        try {
          const statsRes = await fetch(`/api/relais/${relais.id}/stats`);
          const statsData = await statsRes.json();
          setStats(statsData);
        } catch {
          // Stats API might not work, use defaults
        }
      } else {
        setError('Aucun point relais associé à votre compte. Veuillez contacter l\'administrateur.');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking authentication (with timeout)
  if ((status === 'loading' || isLoading) && !loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // If loading timed out without session, show login option
  if ((status === 'unauthenticated' || !session?.user) && loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Session expirée</h2>
          <p className="text-slate-600 mb-4">Veuillez vous reconnecter pour accéder à votre espace.</p>
          <Button onClick={() => {
            window.location.href = `/${locale}/auth/login`;
          }}>
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  // If authenticated but not a relais, redirect
  if (session?.user?.role && session.user.role !== 'RELAIS') {
    const correctPath = getRoleBasedDashboardPath(session.user.role, locale);
    window.location.href = correctPath;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Redirection...</p>
        </div>
      </div>
    );
  }

  // If not a relais user after loading, show error
  if (!session?.user?.role && loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Accès non autorisé</h2>
          <p className="text-slate-600 mb-4">Ce compte n'a pas les permissions nécessaires.</p>
          <Button onClick={() => {
            window.location.href = `/${locale}/auth/login`;
          }}>
            Se connecter avec un autre compte
          </Button>
        </div>
      </div>
    );
  }

  // Still loading with no timeout
  if (!session?.user?.role && !loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Header />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Espace Point Relais</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {relaisInfo?.commerceName || session.user.name}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Relais Status Banner */}
        {relaisInfo && relaisInfo.status === 'PENDING' && (
          <Card className="mb-8 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Clock className="h-6 w-6 text-orange-600" />
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-400">Inscription en attente de validation</p>
                  <p className="text-sm text-orange-600 dark:text-orange-500">Votre demande est en cours d'examen par l'administrateur</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {relaisInfo && relaisInfo.status === 'REJECTED' && (
          <Card className="mb-8 border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-400">Inscription refusée</p>
                  <p className="text-sm text-red-600 dark:text-red-500">Veuillez contacter le support pour plus d'informations</p>
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reçus</CardTitle>
              <ArrowDownToLine className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.received}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remis</CardTitle>
              <ArrowUpFromLine className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.handedOver}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commissions</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.earnings} DA</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-2" />Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-2" />Scanner</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab relaisInfo={relaisInfo} setActiveTab={setActiveTab} />
          </TabsContent>
          <TabsContent value="scan">
            <ScanTab relaisId={relaisInfo?.id} />
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
function OverviewTab({ relaisInfo, setActiveTab }: { relaisInfo: any; setActiveTab: (tab: string) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Information du relais</CardTitle>
        </CardHeader>
        <CardContent>
          {relaisInfo ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Commerce:</span>
                <span className="font-semibold">{relaisInfo.commerceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Adresse:</span>
                <span>{relaisInfo.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ville:</span>
                <span>{WILAYAS.find(w => w.id === relaisInfo.ville)?.name || relaisInfo.ville}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Statut:</span>
                <Badge className={`${RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.color} text-white`}>
                  {RELAIS_STATUS.find(s => s.id === relaisInfo.status)?.label}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">Chargement...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commissions par format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionPetit || DEFAULT_RELAY_COMMISSION.PETIT} DA</p>
              <p className="text-sm text-slate-500">Petit colis</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionMoyen || DEFAULT_RELAY_COMMISSION.MOYEN} DA</p>
              <p className="text-sm text-slate-500">Moyen colis</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{relaisInfo?.commissionGros || DEFAULT_RELAY_COMMISSION.GROS} DA</p>
              <p className="text-sm text-slate-500">Gros colis</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Button variant="outline" className="justify-start h-auto py-4" onClick={() => setActiveTab('scan')}>
              <QrCode className="h-5 w-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold">Scanner un QR Code</p>
                <p className="text-sm text-slate-500">Réceptionner ou remettre un colis</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4" onClick={() => setActiveTab('settings')}>
              <Settings className="h-5 w-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold">Mes paramètres</p>
                <p className="text-sm text-slate-500">Modifier les informations du relais</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Scan Tab
function ScanTab({ relaisId }: { relaisId: string | undefined }) {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState('');
  const [parcel, setParcel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      toast({ title: 'Erreur', description: 'Impossible de rechercher le colis', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!parcel) return;
    try {
      const response = await fetch(`/api/parcels/${parcel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        toast({ title: 'Statut mis à jour', description: 'Le statut du colis a été modifié' });
        setParcel({ ...parcel, status });
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour le statut', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Scan className="h-5 w-5" />Scanner QR Code</CardTitle>
        <CardDescription>Scannez le QR code d'un colis pour le réceptionner ou le remettre</CardDescription>
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
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
            Rechercher
          </Button>
        </div>

        {parcel && !parcel.error && (
          <Card className="bg-slate-50 dark:bg-slate-800">
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="font-mono font-bold text-lg">{parcel.trackingNumber}</p>
                  <p className="text-slate-500">{parcel.villeDepart} → {parcel.villeArrivee}</p>
                </div>
                <Badge className={`${PARCEL_STATUS.find(s => s.id === parcel.status)?.color} text-white px-4 py-2`}>
                  {PARCEL_STATUS.find(s => s.id === parcel.status)?.label}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mb-6">
                <div>
                  <p className="text-sm text-slate-500">Client</p>
                  <p className="font-semibold">{parcel.client?.name || 'N/A'}</p>
                  <p className="text-sm">{parcel.client?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Format</p>
                  <p className="font-semibold">{parcel.format}</p>
                  <p className="text-sm">Commission: {parcel.commissionRelais || 0} DA</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                {['CREATED', 'PAID'].includes(parcel.status) && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusChange('RECU_RELAIS')}>
                    <ArrowDownToLine className="h-4 w-4 mr-2" />Confirmer réception
                  </Button>
                )}
                {parcel.status === 'ARRIVE_RELAIS_DESTINATION' && (
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange('LIVRE')}>
                    <CheckCircle className="h-4 w-4 mr-2" />Confirmer remise au client
                  </Button>
                )}
                {parcel.status === 'LIVRE' && (
                  <Badge className="bg-green-100 text-green-700 px-4 py-2 text-base">Colis déjà livré</Badge>
                )}
                {parcel.status === 'RECU_RELAIS' && (
                  <Badge className="bg-yellow-100 text-yellow-700 px-4 py-2 text-base">En attente de transport</Badge>
                )}
                {parcel.status === 'EN_TRANSPORT' && (
                  <Badge className="bg-orange-100 text-orange-700 px-4 py-2 text-base">En cours de transport</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
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
    toast({ title: 'Horaires mis à jour', description: `Ouverture: ${hours.open}, Fermeture: ${hours.close}` });
    // Note: Could add API call here to persist hours in database
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
          <Button variant="outline" className="mt-4" disabled={!relaisInfo} onClick={handleUpdateHours}>
            Mettre à jour les horaires
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
