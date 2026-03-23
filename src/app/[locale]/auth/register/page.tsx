'use client';

import { useState, Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Package, Loader2, Mail, Lock, User, Phone, Store, MapPin, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WILAYAS } from '@/lib/constants';

function RegisterForm() {
  const t = useTranslations('auth.register');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const roleFromUrl = searchParams.get('role') || 'CLIENT';

  const [formData, setFormData] = useState({
    // Common fields
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: roleFromUrl,

    // Transporter fields
    vehicle: '',
    license: '',
    experience: '',
    regions: [] as string[],
    description: '',

    // Relais fields
    commerceName: '',
    address: '',
    ville: '',
  });

  const handleRegionChange = (region: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      regions: checked
        ? [...prev.regions, region]
        : prev.regions.filter(r => r !== region)
    }));
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs requis', variant: 'destructive' });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: 'Erreur', description: 'Les mots de passe ne correspondent pas', variant: 'destructive' });
      return false;
    }

    if (formData.password.length < 6) {
      toast({ title: 'Erreur', description: 'Le mot de passe doit contenir au moins 6 caractères', variant: 'destructive' });
      return false;
    }

    // Role-specific fields are optional at signup - user can complete them later
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      try {
        await signOut({ redirect: false });
      } catch {
        // ignore
      }

      // 1. Create user account
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const rawError = `${data?.error || ''} ${data?.details || ''}`.toLowerCase();
        let message = 'Erreur lors de l\'inscription';

        if (rawError.includes('email already exists')) {
          message = 'Cet email est déjà utilisé. Essayez de vous connecter ou utilisez une autre adresse.';
        } else if (rawError.includes('invalid email format')) {
          message = 'Le format de l\'email est invalide.';
        } else if (rawError.includes('password too short')) {
          message = 'Le mot de passe doit contenir au moins 6 caractères.';
        } else if (rawError.includes('missing required fields')) {
          message = 'Veuillez remplir tous les champs obligatoires.';
        }

        throw new Error(message);
      }

      const userId = data.id;

      // 2. Auto login before protected profile creation
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (!result?.ok) {
        toast({ title: 'Compte créé', description: 'Vous pouvez maintenant vous connecter' });
        router.push(`/${locale}/auth/login`);
        return;
      }

      // 3. Create role-specific application (only if details provided)
      if (formData.role === 'TRANSPORTER' && formData.vehicle && formData.license) {
        const transporterResponse = await fetch('/api/transporters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            fullName: formData.name,
            phone: formData.phone,
            vehicle: formData.vehicle,
            license: formData.license,
            experience: parseInt(formData.experience) || 0,
            regions: formData.regions,
            description: formData.description,
          }),
        });

        if (!transporterResponse.ok) {
          const transporterError = await transporterResponse.json().catch(() => null);
          throw new Error(transporterError?.error || 'Erreur lors de la création du profil transporteur');
        }

        toast({ title: 'Profil transporteur créé', description: 'Votre demande a été enregistrée avec succès.' });
      }

      if (formData.role === 'RELAIS' && formData.commerceName && formData.address && formData.ville) {
        const relaisResponse = await fetch('/api/relais', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            commerceName: formData.commerceName,
            address: formData.address,
            ville: formData.ville,
            phone: formData.phone,
          }),
        });

        if (!relaisResponse.ok) {
          const relaisError = await relaisResponse.json().catch(() => null);
          throw new Error(relaisError?.error || 'Erreur lors de la création du point relais');
        }

        toast({ title: 'Profil relais créé', description: 'Votre point relais a été enregistré avec succès.' });
      }

      toast({ title: 'Compte créé', description: 'Bienvenue sur SwiftColis!' });

      // If RELAIS or TRANSPORTER without details, redirect to completion page
      if ((formData.role === 'RELAIS' && !formData.commerceName) || 
          (formData.role === 'TRANSPORTER' && !formData.vehicle)) {
        window.location.href = `/${locale}/complete-profile/${formData.role === 'TRANSPORTER' ? 'transporter' : 'relais'}`;
      } else {
        const dashboardPath = `/${locale}/dashboard/${
          formData.role === 'TRANSPORTER' ? 'transporter' : formData.role === 'RELAIS' ? 'relais' : 'client'
        }`;
        window.location.href = dashboardPath;
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de créer le compte',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 p-4 py-8">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Package className="h-10 w-10 text-emerald-600" />
        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          SwiftColis
        </span>
      </Link>

      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label>{t('role.label')}</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">
                    <div className="flex items-center gap-2">
                      <span>📦</span>
                      <span>{t('role.client')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="TRANSPORTER">
                    <div className="flex items-center gap-2">
                      <span>🚚</span>
                      <span>{t('role.transporter')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="RELAIS">
                    <div className="flex items-center gap-2">
                      <span>🏪</span>
                      <span>{t('role.relais')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Common Fields */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t('name')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Votre nom complet"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemple.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+213 XX XX XX XX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Transporter Fields */}
            {formData.role === 'TRANSPORTER' && (
              <>
                <Separator />
                <div className="space-y-1 mb-4">
                  <h3 className="font-semibold text-sm uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
                    <Truck className="h-4 w-4" /> Informations du transporteur
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle">Type de véhicule (optionnel)</Label>
                    <Input
                      id="vehicle"
                      placeholder="Ex: Utilitaire 3.5T"
                      value={formData.vehicle}
                      onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license">Numéro de permis (optionnel)</Label>
                    <Input
                      id="license"
                      placeholder="Ex: AB123456"
                      value={formData.license}
                      onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience">Années d'expérience</Label>
                  <Input
                    id="experience"
                    type="number"
                    placeholder="0"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Régions desservies</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto p-2 border rounded-lg">
                    {WILAYAS.map((wilaya) => (
                      <div key={wilaya.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={wilaya.id}
                          checked={formData.regions.includes(wilaya.id)}
                          onCheckedChange={(checked) => handleRegionChange(wilaya.id, checked as boolean)}
                        />
                        <label htmlFor={wilaya.id} className="text-sm cursor-pointer">
                          {wilaya.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (optionnel)</Label>
                  <Textarea
                    id="description"
                    placeholder="Parlez-nous un peu de vous et de votre expérience..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* Relais Fields */}
            {formData.role === 'RELAIS' && (
              <>
                <Separator />
                <div className="space-y-1 mb-4">
                  <h3 className="font-semibold text-sm uppercase tracking-wide flex items-center gap-2 text-muted-foreground">
                    <Store className="h-4 w-4" /> Informations du point relais
                  </h3>
                </div>

                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    Les détails du point relais sont optionnels à l'inscription. Vous pourrez les ajouter après.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commerceName">Nom du commerce (optionnel)</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="commerceName"
                      placeholder="Ex: Épicerie du Centre"
                      value={formData.commerceName}
                      onChange={(e) => setFormData({ ...formData, commerceName: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse (optionnel)</Label>
                  <Textarea
                    id="address"
                    placeholder="Ex: 123 Rue Didouche Mourad, Alger Centre"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ville">Ville (optionnel)</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={formData.ville} onValueChange={(value) => setFormData({ ...formData, ville: value })}>
                      <SelectTrigger className="pl-10">
                        <SelectValue placeholder="Sélectionnez votre ville" />
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
              </>
            )}
          </CardContent>

          <div className="px-6 pb-6 space-y-4">
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg py-6" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer mon compte
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Vous avez un compte ?{' '}
              <Link href={`/${locale}/auth/login`} className="text-emerald-600 hover:underline font-medium">
                Connectez-vous
              </Link>
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
