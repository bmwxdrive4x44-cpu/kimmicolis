'use client';

import { useState, Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Package, Loader2, Mail, Lock, User, Phone, Store, MapPin, Truck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WILAYAS } from '@/lib/constants';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';

function RegisterForm() {
  const t = useTranslations('auth.register');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    address?: string;
    ville?: string;
  }>({});

  const roleFromUrl = searchParams.get('role') || 'CLIENT';

  const [formData, setFormData] = useState({
    // Common fields
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    personalAddress: '',
    password: '',
    confirmPassword: '',
    role: roleFromUrl,

    // Transporter fields
    vehicle: '',
    license: '',
    experience: '',
    regions: [] as string[],
    description: '',
    commerceRegisterNumber: '',

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
    const errors: typeof fieldErrors = {};

    if (!formData.firstName || !formData.lastName || !formData.phone) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs requis', variant: 'destructive' });
      return false;
    }

    if (!formData.email) {
      errors.email = 'L\'adresse email est obligatoire.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Le format de l\'email est invalide.';
    }

    if (!formData.password) {
      errors.password = 'Le mot de passe est obligatoire.';
    } else if (formData.password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères.';
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
    }

    if ((formData.role === 'TRANSPORTER' || formData.role === 'RELAIS') && !formData.commerceRegisterNumber.trim()) {
      toast({ title: 'Erreur', description: 'Le numéro du registre du commerce est obligatoire', variant: 'destructive' });
      return false;
    }

    if ((formData.role === 'TRANSPORTER' || formData.role === 'RELAIS') && !isAlgerianCommerceRegisterNumber(formData.commerceRegisterNumber)) {
      toast({ title: 'Erreur', description: 'Format RC invalide (ex: RC-16/1234567B21)', variant: 'destructive' });
      return false;
    }

    if (formData.role === 'RELAIS') {
      if (!formData.address.trim()) {
        errors.address = 'L\'adresse du point relais est obligatoire.';
      }
      if (!formData.ville) {
        errors.ville = 'La ville est obligatoire.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // 1. Create user account
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          firstName: formData.firstName,
          lastName: formData.lastName,
          address: formData.personalAddress,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: formData.role,
          siret: (formData.role === 'TRANSPORTER' || formData.role === 'RELAIS') ? normalizeCommerceRegisterNumber(formData.commerceRegisterNumber) : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const rawError = `${data?.error || ''} ${data?.details || ''}`.toLowerCase();

        if (rawError.includes('email already exists')) {
          setFieldErrors(prev => ({ ...prev, email: 'Cet email est déjà utilisé. Connectez-vous ou utilisez une autre adresse.' }));
          throw new Error('Cet email est déjà utilisé.');
        } else if (rawError.includes('invalid email format')) {
          setFieldErrors(prev => ({ ...prev, email: 'Le format de l\'email est invalide.' }));
          throw new Error('Email invalide.');
        } else if (rawError.includes('password too short')) {
          setFieldErrors(prev => ({ ...prev, password: 'Le mot de passe doit contenir au moins 6 caractères.' }));
          throw new Error();
        } else {
          throw new Error(data?.error || 'Erreur lors de l\'inscription');
        }
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
      if (formData.role === 'TRANSPORTER' && formData.vehicle && formData.license && formData.commerceRegisterNumber.trim()) {
        const transporterResponse = await fetch('/api/transporters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            fullName,
            phone: formData.phone,
            vehicle: formData.vehicle,
            license: formData.license,
            commerceRegisterNumber: normalizeCommerceRegisterNumber(formData.commerceRegisterNumber),
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

      if (formData.role === 'RELAIS' && formData.commerceRegisterNumber.trim()) {
        const relaisResponse = await fetch('/api/relais', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            commerceName: formData.commerceName,
            address: formData.address,
            ville: formData.ville,
            phone: formData.phone,
            commerceRegisterNumber: normalizeCommerceRegisterNumber(formData.commerceRegisterNumber),
          }),
        });

        if (!relaisResponse.ok) {
          const relaisError = await relaisResponse.json().catch(() => null);
          throw new Error(relaisError?.error || 'Erreur lors de la création du point relais');
        }

        toast({ title: 'Profil relais créé', description: 'Votre point relais a été enregistré avec succès.' });
      }

      toast({ title: 'Compte créé', description: 'Bienvenue sur SwiftColis!' });

      // If TRANSPORTER without vehicle details, redirect to completion page
      if (formData.role === 'TRANSPORTER' && !formData.vehicle) {
        window.location.href = `/${locale}/complete-profile/transporter`;
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
                <Label htmlFor="firstName">Prénom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    placeholder="Votre prénom"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lastName"
                    placeholder="Votre nom"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemple.com"
                    value={formData.email}
                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFieldErrors(p => ({ ...p, email: undefined })); }}
                    className={`pl-10 ${fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{fieldErrors.email}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="personalAddress">Adresse personnelle</Label>
                <Input
                  id="personalAddress"
                  placeholder="Ex: 12 Rue Didouche Mourad"
                  value={formData.personalAddress}
                  onChange={(e) => setFormData({ ...formData, personalAddress: e.target.value })}
                />
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
                  required
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
                    onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFieldErrors(p => ({ ...p, password: undefined })); }}
                    className={`pl-10 ${fieldErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    required
                  />
                </div>
                {fieldErrors.password && (
                  <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{fieldErrors.password}</span>
                  </div>
                )}
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
                    onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); setFieldErrors(p => ({ ...p, confirmPassword: undefined })); }}
                    className={`pl-10 ${fieldErrors.confirmPassword ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    required
                  />
                </div>
                {fieldErrors.confirmPassword && (
                  <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{fieldErrors.confirmPassword}</span>
                  </div>
                )}
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
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="commerceRegisterNumberTransporter">Numéro du registre du commerce <span className="text-red-500">*</span></Label>
                    <Input
                      id="commerceRegisterNumberTransporter"
                      placeholder="Ex: 16/0012345B22"
                      value={formData.commerceRegisterNumber}
                      onChange={(e) => setFormData({ ...formData, commerceRegisterNumber: e.target.value })}
                      required={formData.role === 'TRANSPORTER'}
                    />
                    <p className="text-xs text-muted-foreground">Format CNRC : WW/NNNNNNNLAA — ex : <code>16/0012345B22</code> ou <code>RC-16/0012345B22</code> (WW = wilaya, L = type B/C/H/R, AA = année)</p>
                  </div>
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



                <div className="space-y-2">
                  <Label htmlFor="commerceRegisterNumberRelais">Numéro du registre du commerce <span className="text-red-500">*</span></Label>
                  <Input
                    id="commerceRegisterNumberRelais"
                    placeholder="Ex: 16/0012345B22"
                    value={formData.commerceRegisterNumber}
                    onChange={(e) => setFormData({ ...formData, commerceRegisterNumber: e.target.value })}
                    required={formData.role === 'RELAIS'}
                  />
                  <p className="text-xs text-muted-foreground">Format CNRC : WW/NNNNNNNLAA — ex : <code>16/0012345B22</code> ou <code>RC-16/0012345B22</code> (WW = wilaya, L = type B/C/H/R, AA = année)</p>
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
                  <Label htmlFor="address">Adresse du point relais <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="address"
                    placeholder="Ex: 123 Rue Didouche Mourad, Alger Centre"
                    value={formData.address}
                    onChange={(e) => { setFormData({ ...formData, address: e.target.value }); setFieldErrors(p => ({ ...p, address: undefined })); }}
                    rows={2}
                    className={fieldErrors.address ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {fieldErrors.address && (
                    <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{fieldErrors.address}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ville">Ville <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={formData.ville} onValueChange={(value) => { setFormData({ ...formData, ville: value }); setFieldErrors(p => ({ ...p, ville: undefined })); }}>
                      <SelectTrigger className={`pl-10 ${fieldErrors.ville ? 'border-red-500 focus-visible:ring-red-500' : ''}`}>
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
                  {fieldErrors.ville && (
                    <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{fieldErrors.ville}</span>
                    </div>
                  )}
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
