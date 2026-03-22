'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { WILAYAS } from '@/lib/constants';
import { Truck, MapPin, Star, CheckCircle, Loader2, Route } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function BecomeTransporterPage() {
  const { data: session } = useSession();
  const t = useTranslations('transporter.register');
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    vehicle: '',
    license: '',
    experience: '',
    regions: [] as string[],
    description: '',
  });

  const handleRegionChange = (region: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      regions: checked
        ? [...prev.regions, region]
        : prev.regions.filter(r => r !== region)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // If not logged in, create user first
      let userId = session?.user?.id;

      if (!userId) {
        // This would typically redirect to registration
        toast({
          title: 'Connexion requise',
          description: 'Veuillez vous connecter ou créer un compte pour devenir transporteur',
        });
        router.push('/auth/register');
        return;
      }

      // Create transporter registration
      const response = await fetch('/api/transporters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fullName: formData.fullName,
          phone: formData.phone,
          vehicle: formData.vehicle,
          license: formData.license,
          experience: parseInt(formData.experience),
          regions: formData.regions,
          description: formData.description,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        toast({
          title: t('success'),
          description: 'Votre demande sera examinée par notre équipe',
        });
      } else {
        throw new Error('Failed to submit');
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre la demande',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-16">
          <Card className="max-w-lg mx-auto text-center">
            <CardContent className="pt-8">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('success')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('pending')}. Notre équipe examinera votre demande et vous contactera sous 48h.
              </p>
              <Link href="/">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  Retour à l'accueil
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <Truck className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}. Transportez des colis et générez des revenus en travaillant selon vos horaires.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto mb-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Route className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold mb-2">Flexibilité</h3>
              <p className="text-sm text-muted-foreground">
                Travaillez selon vos horaires et vos régions préférées
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Revenus</h3>
              <p className="text-sm text-muted-foreground">
                Gagnez des commissions sur chaque livraison effectuée
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Star className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="font-semibold mb-2">Autonomie</h3>
              <p className="text-sm text-muted-foreground">
                Gérez votre activité de transport en toute indépendance
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Requirements */}
        <Card className="max-w-4xl mx-auto mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Conditions requises
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Véhicule adapté</h4>
                  <p className="text-sm text-muted-foreground">Voiture, camionnette ou véhicule utilitaire</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Permis de conduire valide</h4>
                  <p className="text-sm text-muted-foreground">Permis B minimum, permis poids lourd si nécessaire</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Assurance valide</h4>
                  <p className="text-sm text-muted-foreground">Assurance responsabilité civile à jour</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Téléphone portable</h4>
                  <p className="text-sm text-muted-foreground">Pour la coordination et les mises à jour</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registration Form */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Inscription Transporteur</CardTitle>
            <CardDescription>
              Remplissez ce formulaire pour rejoindre notre réseau de transporteurs partenaires
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('fullName')}</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Votre nom complet"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('phone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+213 XX XX XX XX"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vehicle">{t('vehicle')}</Label>
                  <Select value={formData.vehicle} onValueChange={(value) => setFormData(prev => ({ ...prev, vehicle: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type de véhicule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voiture">Voiture particulière</SelectItem>
                      <SelectItem value="camionnette">Camionnette</SelectItem>
                      <SelectItem value="fourgon">Fourgon</SelectItem>
                      <SelectItem value="camion">Camion léger</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience">{t('experience')}</Label>
                  <Select value={formData.experience} onValueChange={(value) => setFormData(prev => ({ ...prev, experience: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Années d'expérience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Débutant (0-1 an)</SelectItem>
                      <SelectItem value="2">2-3 ans</SelectItem>
                      <SelectItem value="4">4-5 ans</SelectItem>
                      <SelectItem value="6">6-10 ans</SelectItem>
                      <SelectItem value="10">Plus de 10 ans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="license">{t('license')}</Label>
                <Input
                  id="license"
                  value={formData.license}
                  onChange={(e) => setFormData(prev => ({ ...prev, license: e.target.value }))}
                  placeholder="Numéro de permis de conduire"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t('regions')}</Label>
                <div className="grid gap-2 md:grid-cols-3 max-h-48 overflow-y-auto border rounded-lg p-4">
                  {WILAYAS.map((wilaya) => (
                    <div key={wilaya.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`region-${wilaya.id}`}
                        checked={formData.regions.includes(wilaya.id)}
                        onCheckedChange={(checked) => handleRegionChange(wilaya.id, checked as boolean)}
                      />
                      <Label htmlFor={`region-${wilaya.id}`} className="text-sm">
                        {wilaya.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optionnel)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Décrivez brièvement votre expérience, vos disponibilités..."
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Soumission en cours...
                  </>
                ) : (
                  t('submit')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}