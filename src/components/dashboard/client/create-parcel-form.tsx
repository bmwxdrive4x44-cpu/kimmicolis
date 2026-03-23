'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { WILAYAS, PARCEL_FORMATS, PLATFORM_COMMISSION, DEFAULT_RELAY_COMMISSION } from '@/lib/constants';
import { Package, Loader2, CreditCard, CheckCircle, QrCode, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface CreateParcelFormProps {
  userId: string;
}

export function CreateParcelForm({ userId }: CreateParcelFormProps) {
  const t = useTranslations('parcel.create');
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [relaisList, setRelaisList] = useState<any[]>([]);
  const [tariff, setTariff] = useState(400);
  const [formData, setFormData] = useState({
    villeDepart: '',
    villeArrivee: '',
    relaisDepartId: '',
    relaisArriveeId: '',
    format: 'PETIT',
    weight: '',
    description: '',
  });
  const [createdParcel, setCreatedParcel] = useState<any>(null);

  const formatRelayHours = (relay: any) => {
    if (!relay?.openTime || !relay?.closeTime) return 'Horaires non renseignés';
    return `${relay.openTime} - ${relay.closeTime}`;
  };

  // Fetch relays when cities change
  useEffect(() => {
    const fetchRelais = async () => {
      try {
        const response = await fetch('/api/relais?status=APPROVED');
        const data = await response.json();
        setRelaisList(data);
      } catch (error) {
        console.error('Error fetching relais:', error);
      }
    };
    fetchRelais();
  }, []);

  // Calculate price when form changes
  useEffect(() => {
    const calculatePrice = async () => {
      if (formData.villeDepart && formData.villeArrivee) {
        try {
          const response = await fetch(
            `/api/lignes?villeDepart=${formData.villeDepart}&villeArrivee=${formData.villeArrivee}`
          );
          const lignes = await response.json();
          if (lignes && lignes.length > 0) {
            const ligne = lignes[0];
            const baseTariff = formData.format === 'PETIT' 
              ? ligne.tarifPetit 
              : formData.format === 'MOYEN' 
              ? ligne.tarifMoyen 
              : ligne.tarifGros;
            setTariff(baseTariff);
          }
        } catch (error) {
          console.error('Error calculating price:', error);
        }
      }
    };
    calculatePrice();
  }, [formData.villeDepart, formData.villeArrivee, formData.format]);

  const platformFee = tariff * PLATFORM_COMMISSION;
  const relayFee = DEFAULT_RELAY_COMMISSION[formData.format as keyof typeof DEFAULT_RELAY_COMMISSION] || 100;
  const totalPrice = tariff + platformFee + relayFee;

  const filteredDepartRelais = relaisList.filter((r) => r.ville === formData.villeDepart);
  const filteredArriveeRelais = relaisList.filter((r) => r.ville === formData.villeArrivee);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: userId,
          ...formData,
          weight: formData.weight ? parseFloat(formData.weight) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create parcel');

      const parcel = await response.json();
      setCreatedParcel(parcel);
      setStep(3);
      toast({
        title: 'Colis créé',
        description: `Votre colis ${parcel.trackingNumber} a été créé avec succès`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le colis',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    setIsLoading(true);
    // Simulate payment
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Update parcel status to PAID
    if (createdParcel) {
      await fetch(`/api/parcels/${createdParcel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID', notes: 'Paiement confirmé' }),
      });
    }

    setIsLoading(false);
    setStep(4);
    toast({
      title: 'Paiement confirmé',
      description: 'Votre colis est prêt à être déposé au point relais',
    });
  };

  const handleDownloadQR = () => {
    if (!createdParcel?.qrCodeImage) return;
    const link = document.createElement('a');
    link.href = createdParcel.qrCodeImage;
    link.download = `qr-${createdParcel.trackingNumber}.png`;
    link.click();
  };

  if (step === 4) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Colis créé avec succès!</h2>
          <p className="text-muted-foreground mb-4">
            Votre numéro de suivi: <Badge className="text-base ml-1">{createdParcel?.trackingNumber}</Badge>
          </p>

          {/* QR Code Display */}
          {createdParcel?.qrCodeImage && (
            <div className="flex flex-col items-center mb-6">
              <div className="p-4 bg-white border rounded-xl shadow-sm inline-block">
                <Image
                  src={createdParcel.qrCodeImage}
                  alt={`QR Code ${createdParcel.trackingNumber}`}
                  width={180}
                  height={180}
                  className="block"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 mb-3">
                Présentez ce QR code au point relais de départ
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadQR} className="gap-2">
                <Download className="h-4 w-4" />
                Télécharger le QR code
              </Button>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold mb-4">Prochaines étapes:</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Déposez votre colis au point relais de départ</li>
              <li>2. Présentez le QR code ou ce numéro de suivi au commerçant</li>
              <li>3. Suivez votre colis en temps réel</li>
              <li>4. Récupérez votre colis au point relais de destination</li>
            </ol>
          </div>
          <Button onClick={() => router.push('/dashboard/client')} className="bg-emerald-600 hover:bg-emerald-700">
            Retour au tableau de bord
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-6">
            {/* Cities */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('departure.title')}</Label>
                <Select
                  value={formData.villeDepart}
                  onValueChange={(value) => setFormData({ ...formData, villeDepart: value, relaisDepartId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('departure.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('arrival.title')}</Label>
                <Select
                  value={formData.villeArrivee}
                  onValueChange={(value) => setFormData({ ...formData, villeArrivee: value, relaisArriveeId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('arrival.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Relay Points */}
            {formData.villeDepart && (
              <div className="space-y-2">
                <Label>{t('relayDepart.title')}</Label>
                <Select
                  value={formData.relaisDepartId}
                  onValueChange={(value) => setFormData({ ...formData, relaisDepartId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('relayDepart.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDepartRelais.length > 0 ? (
                      filteredDepartRelais.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.commerceName} - {r.address} ({formatRelayHours(r)})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>Aucun point relais disponible</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.villeArrivee && (
              <div className="space-y-2">
                <Label>{t('relayArrival.title')}</Label>
                <Select
                  value={formData.relaisArriveeId}
                  onValueChange={(value) => setFormData({ ...formData, relaisArriveeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('relayArrival.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredArriveeRelais.length > 0 ? (
                      filteredArriveeRelais.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.commerceName} - {r.address} ({formatRelayHours(r)})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>Aucun point relais disponible</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Format */}
            <div className="space-y-2">
              <Label>{t('format.title')}</Label>
              <Select
                value={formData.format}
                onValueChange={(value) => setFormData({ ...formData, format: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARCEL_FORMATS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label} ({f.dimensions})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight & Description */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('weight')}</Label>
                <Input
                  type="number"
                  placeholder="Ex: 2.5"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Textarea
                placeholder="Description du contenu..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!formData.villeDepart || !formData.villeArrivee || !formData.relaisDepartId || !formData.relaisArriveeId}
            >
              Continuer
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Récapitulatif</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trajet:</span>
                  <span>
                    {WILAYAS.find(w => w.id === formData.villeDepart)?.name} → {WILAYAS.find(w => w.id === formData.villeArrivee)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span>{PARCEL_FORMATS.find(f => f.id === formData.format)?.label}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between">
                  <span>{t('price.tariff')}</span>
                  <span>{tariff.toFixed(0)} DA</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('price.platformFee')}</span>
                  <span>{platformFee.toFixed(0)} DA</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('price.relayFee')}</span>
                  <span>{relayFee.toFixed(0)} DA</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('price.total')}</span>
                  <span className="text-emerald-600">{totalPrice.toFixed(0)} DA</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Retour
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                Créer le colis
              </Button>
            </div>
          </div>
        )}

        {step === 3 && createdParcel && (
          <div className="space-y-6">
            <div className="text-center">
              <Package className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold">Colis créé!</h3>
              <p className="text-muted-foreground">Numéro de suivi: {createdParcel.trackingNumber}</p>
            </div>

            {/* Preview QR Code */}
            {createdParcel?.qrCodeImage && (
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white border rounded-lg shadow-sm inline-block">
                  <Image
                    src={createdParcel.qrCodeImage}
                    alt="QR Code colis"
                    width={120}
                    height={120}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <QrCode className="h-3 w-3 inline mr-1" />
                  QR code généré pour ce colis
                </p>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold">Total à payer</span>
                <span className="text-2xl font-bold text-emerald-600">{totalPrice.toFixed(0)} DA</span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => router.push('/dashboard/client')} className="flex-1">
                Payer plus tard
              </Button>
              <Button onClick={handlePayment} disabled={isLoading} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Payer maintenant
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
