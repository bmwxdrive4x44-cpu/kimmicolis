'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormFieldError, FormGlobalError } from '@/components/ui/form-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Store, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WILAYAS } from '@/lib/constants';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';

export default function CompleteProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const params = useParams();
  const { toast } = useToast();
  const t = useTranslations('auth.register');

  const profileType = params.type as string; // 'relais' or 'transporter'
  const isRelais = profileType === 'relais';
  const isTransporter = profileType === 'transporter';

  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [existingTransporterId, setExistingTransporterId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    commerceRegisterNumber?: string;
    commerceName?: string;
    address?: string;
    ville?: string;
    phone?: string;
    vehicle?: string;
    license?: string;
  }>({});

  const [formData, setFormData] = useState<{
    commerceName?: string;
    address?: string;
    ville?: string;
    commerceRegisterNumber?: string;
    phone?: string;
    vehicle?: string;
    license?: string;
    experience?: string;
    regions?: string[];
    description?: string;
  }>(
    isRelais
      ? { commerceName: '', address: '', ville: '', commerceRegisterNumber: '' }
      : { phone: '', vehicle: '', license: '', experience: '', regions: [], description: '', commerceRegisterNumber: '' }
  );

  // Check if user already has a profile of this type
  useEffect(() => {
    const checkProfile = async () => {
      if (!session?.user?.id) return;

      try {
        const endpoint = isRelais ? '/api/relais' : '/api/transporters';
        const response = await fetch(`${endpoint}?userId=${session.user.id}`);
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          const existingProfile = data[0];
          const userRes = await fetch(`/api/users/${session.user.id}`);
          const userData = userRes.ok ? await userRes.json() : null;
          const hasRc = Boolean(userData?.siret?.trim());
          const isProfileComplete = isRelais
            ? Boolean(existingProfile?.commerceName?.trim() && existingProfile?.address?.trim() && existingProfile?.ville?.trim() && hasRc)
            : Boolean(existingProfile?.vehicle?.trim() && existingProfile?.license?.trim() && hasRc);

          if (isProfileComplete) {
            setHasProfile(true);
            const dashboardPath = `/${locale}/dashboard/${isRelais ? 'relais' : 'transporter'}`;
            router.push(dashboardPath);
            return;
          }

          if (isRelais) {
            setFormData({
              commerceName: existingProfile?.commerceName || '',
              address: existingProfile?.address || '',
              ville: existingProfile?.ville || '',
              commerceRegisterNumber: userData?.siret || '',
            });
          } else {
            setFormData((prev) => ({
              ...prev,
              phone: userData?.phone || '',
              vehicle: existingProfile?.vehicle || '',
              license: existingProfile?.license || '',
              experience: existingProfile?.experience !== undefined ? String(existingProfile.experience) : '',
              regions: existingProfile?.regions
                ? Array.isArray(existingProfile.regions)
                  ? existingProfile.regions
                  : (() => {
                      try {
                        return JSON.parse(existingProfile.regions);
                      } catch {
                        return [];
                      }
                    })()
                : [],
              description: existingProfile?.description || '',
              commerceRegisterNumber: userData?.siret || '',
            }));
            setExistingTransporterId(existingProfile?.id || null);
          }
        } else if (isTransporter) {
          const userRes = await fetch(`/api/users/${session.user.id}`);
          const userData = userRes.ok ? await userRes.json() : null;
          setFormData((prev) => ({
            ...prev,
            phone: userData?.phone || '',
            commerceRegisterNumber: userData?.siret || '',
          }));
        }
      } catch (error) {
        console.error('Error checking profile:', error);
      } finally {
        setIsChecking(false);
      }
    };

    if (status === 'authenticated') {
      checkProfile();
    } else if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
    }
  }, [status, session, router, locale, isRelais]);

  const handleRegionChange = (region: string, checked: boolean) => {
    setSubmitError(null);
    setFieldErrors((prev) => ({ ...prev }));
    if (isTransporter) {
      setFormData((prev) => ({
        ...prev,
        regions: checked
          ? [...(prev.regions || []), region]
          : (prev.regions || []).filter((r) => r !== region),
      }));
    }
  };

  const validateForm = () => {
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    const errors: {
      commerceRegisterNumber?: string;
      commerceName?: string;
      address?: string;
      ville?: string;
      phone?: string;
      vehicle?: string;
      license?: string;
    } = {};

    if (isRelais) {
      const data = formData as any;
      const rcNumber = normalizeCommerceRegisterNumber(String(data.commerceRegisterNumber || ''));
      const commerceName = String(data.commerceName || '').trim();
      const address = String(data.address || '').trim();
      const ville = String(data.ville || '').trim();

      if (!commerceName) errors.commerceName = 'Le nom du commerce est obligatoire.';
      if (!address) errors.address = 'L\'adresse complète est obligatoire.';
      if (!ville) errors.ville = 'La ville est obligatoire.';
      if (!rcNumber) {
        errors.commerceRegisterNumber = 'Le numéro du registre du commerce est obligatoire.';
      } else if (!isAlgerianCommerceRegisterNumber(rcNumber)) {
        errors.commerceRegisterNumber = 'Format RC invalide (ex: RC-16/1234567B21).';
      }
    } else if (isTransporter) {
      const data = formData as any;
      const phone = String(data.phone || '').trim();
      const vehicle = String(data.vehicle || '').trim();
      const license = String(data.license || '').trim();
      const rcNumber = normalizeCommerceRegisterNumber(String(data.commerceRegisterNumber || ''));

      if (!phone) {
        errors.phone = 'Le téléphone est obligatoire.';
      } else if (!phoneRegex.test(phone)) {
        errors.phone = 'Format de téléphone invalide (8 à 15 chiffres, + autorisé).';
      }
      if (!vehicle) errors.vehicle = 'Le type de véhicule est obligatoire.';
      if (!license) errors.license = 'Le numéro de permis est obligatoire.';
      if (!rcNumber) {
        errors.commerceRegisterNumber = 'Le numéro du registre du commerce est obligatoire.';
      } else if (!isAlgerianCommerceRegisterNumber(rcNumber)) {
        errors.commerceRegisterNumber = 'Format RC invalide (ex: RC-16/1234567B21).';
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitError('Veuillez corriger les champs en rouge.');
      toast({ title: 'Erreur', description: 'Veuillez corriger les champs en rouge.', variant: 'destructive' });
      return false;
    }

    setSubmitError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});
    if (!validateForm()) return;

    if (!session?.user?.id) {
      setSubmitError('Session expirée. Veuillez vous reconnecter.');
      toast({ title: 'Erreur', description: 'Session expirée. Veuillez vous reconnecter.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      if (isRelais) {
        const data = formData as any;
        const updateUserResponse = await fetch(`/api/users/${session.user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siret: normalizeCommerceRegisterNumber(data.commerceRegisterNumber) }),
        });

        if (!updateUserResponse.ok) {
          const error = await updateUserResponse.json().catch(() => null);
          const msg = error?.details || error?.error || 'Erreur lors de l\'enregistrement du numéro RC';
          if (String(msg).toLowerCase().includes('commerce register') || String(msg).toLowerCase().includes('registre')) {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide côté serveur.' }));
          }
          throw new Error(error?.error || 'Erreur lors de l\'enregistrement du numéro RC');
        }

        const response = await fetch('/api/relais', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            commerceName: data.commerceName,
            address: data.address,
            ville: data.ville,
            phone: session.user.phone || '',
            commerceRegisterNumber: normalizeCommerceRegisterNumber(data.commerceRegisterNumber),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          const msg = error?.details || error?.error || 'Erreur lors de la création du point relais';
          if (error?.code === 'MISSING_REQUIRED_FIELDS') {
            setSubmitError('Des champs obligatoires sont manquants.');
          }
          if (error?.code === 'INVALID_COMMERCE_REGISTER_NUMBER' || error?.field === 'commerceRegisterNumber') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide côté serveur.' }));
          }
          if (String(msg).toLowerCase().includes('commerce register') || String(msg).toLowerCase().includes('registre')) {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide côté serveur.' }));
          }
          throw new Error(msg);
        }

        toast({ title: 'Succès', description: 'Point relais créé avec succès!' });
        router.push(`/${locale}/dashboard/relais`);
      } else if (isTransporter) {
        const data = formData as any;
        const updateUserResponse = await fetch(`/api/users/${session.user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siret: normalizeCommerceRegisterNumber(data.commerceRegisterNumber),
            phone: data.phone?.trim(),
          }),
        });

        if (!updateUserResponse.ok) {
          const error = await updateUserResponse.json().catch(() => null);
          const msg = error?.details || error?.error || 'Erreur lors de l\'enregistrement du numéro RC';
          if (String(msg).toLowerCase().includes('commerce register') || String(msg).toLowerCase().includes('registre')) {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide côté serveur.' }));
          }
          throw new Error(msg);
        }

        const response = await fetch(existingTransporterId ? `/api/transporters/${existingTransporterId}` : '/api/transporters', {
          method: existingTransporterId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            fullName: session.user.name,
            phone: data.phone?.trim(),
            vehicle: data.vehicle,
            license: data.license,
            commerceRegisterNumber: normalizeCommerceRegisterNumber(data.commerceRegisterNumber),
            experience: parseInt(data.experience) || 0,
            regions: data.regions || [],
            description: data.description,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          const msg = error?.details || error?.error || 'Erreur lors de la création du profil transporteur';
          if (error?.code === 'APPLICATION_ALREADY_SUBMITTED') {
            throw new Error('Votre dossier transporteur existe déjà. Modifiez-le depuis cette page ou contactez le support.');
          }
          if (error?.code === 'MISSING_REQUIRED_FIELDS') {
            setSubmitError('Des champs obligatoires sont manquants.');
          }
          if (error?.code === 'INVALID_COMMERCE_REGISTER_NUMBER' || error?.field === 'commerceRegisterNumber') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide côté serveur.' }));
          }
          const lower = String(msg).toLowerCase();
          if (lower.includes('phone') || lower.includes('téléphone')) {
            setFieldErrors((prev) => ({ ...prev, phone: 'Téléphone invalide côté serveur.' }));
          }
          if (lower.includes('commerce register') || lower.includes('registre')) {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide côté serveur.' }));
          }
          throw new Error(msg);
        }

        toast({ title: 'Succès', description: 'Profil transporteur créé avec succès!' });
        router.push(`/${locale}/dashboard/transporter`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue';
      setSubmitError(message);
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Vérification...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || hasProfile) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {isRelais ? (
                <Store className="h-12 w-12 text-emerald-600" />
              ) : (
                <Truck className="h-12 w-12 text-blue-600" />
              )}
            </div>
            <CardTitle className="text-3xl">
              {isRelais ? 'Créer votre point relais' : 'Compléter votre profil transporteur'}
            </CardTitle>
            <CardDescription>
              {isRelais
                ? 'Fournissez les informations de votre point relais'
                : 'Fournissez les détails de votre véhicule et expérience'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {isRelais
                    ? 'Remplissez ces informations pour que votre point relais soit visible sur la plateforme et puisse recevoir des colis.'
                    : 'Remplissez ces informations pour que votre profil transporteur soit activé et puisse accepter des missions.'}
                </p>
              </div>

              <FormGlobalError message={submitError} />

              {isRelais ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="commerceRegisterNumberRelais" className="text-base font-semibold">
                      Numéro du registre du commerce <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="commerceRegisterNumberRelais"
                      placeholder="Ex: 16/0012345B22"
                      value={(formData as any).commerceRegisterNumber}
                      onChange={(e) => {
                        setSubmitError(null);
                        setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: undefined }));
                        setFormData({ ...formData, commerceRegisterNumber: e.target.value });
                      }}
                      required
                      className="h-11"
                    />
                    <FormFieldError message={fieldErrors.commerceRegisterNumber} />
                    <p className="text-xs text-muted-foreground">Format CNRC : WW/NNNNNNNLAA — ex : <code>16/0012345B22</code> ou <code>RC-16/0012345B22</code> (WW = wilaya, L = type B/C/H/R, AA = année)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commerceName" className="text-base font-semibold">
                      Nom du commerce <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="commerceName"
                      placeholder="Ex: Épicerie du Centre, Pharmacie Laval..."
                      value={(formData as any).commerceName}
                      onChange={(e) => {
                        setSubmitError(null);
                        setFieldErrors((prev) => ({ ...prev, commerceName: undefined }));
                        setFormData({ ...formData, commerceName: e.target.value });
                      }}
                      required
                      className="h-11"
                    />
                    <FormFieldError message={fieldErrors.commerceName} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-base font-semibold">
                      Adresse complète <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="address"
                      placeholder="Ex: 123 Rue Didouche Mourad, Alger Centre"
                      value={(formData as any).address}
                      onChange={(e) => {
                        setSubmitError(null);
                        setFieldErrors((prev) => ({ ...prev, address: undefined }));
                        setFormData({ ...formData, address: e.target.value });
                      }}
                      required
                      rows={3}
                    />
                    <FormFieldError message={fieldErrors.address} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ville" className="text-base font-semibold">
                      Ville <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={(formData as any).ville}
                      onValueChange={(value) => {
                        setSubmitError(null);
                        setFieldErrors((prev) => ({ ...prev, ville: undefined }));
                        setFormData({ ...formData, ville: value });
                      }}
                    >
                      <SelectTrigger className="h-11">
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
                    <FormFieldError message={fieldErrors.ville} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="phone" className="text-base font-semibold">
                        Téléphone <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="phone"
                        placeholder="Ex: 0550123456"
                        value={(formData as any).phone || ''}
                        onChange={(e) => {
                          setSubmitError(null);
                          setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                          setFormData({ ...formData, phone: e.target.value });
                        }}
                        required
                        className="h-11"
                      />
                      <FormFieldError message={fieldErrors.phone} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="commerceRegisterNumberTransporter" className="text-base font-semibold">
                        Numéro du registre du commerce <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="commerceRegisterNumberTransporter"
                        placeholder="Ex: 16/0012345B22"
                        value={(formData as any).commerceRegisterNumber}
                        onChange={(e) => {
                          setSubmitError(null);
                          setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: undefined }));
                          setFormData({ ...formData, commerceRegisterNumber: e.target.value });
                        }}
                        required
                        className="h-11"
                      />
                      <FormFieldError message={fieldErrors.commerceRegisterNumber} />
                      <p className="text-xs text-muted-foreground">Format CNRC : WW/NNNNNNNLAA — ex : <code>16/0012345B22</code> ou <code>RC-16/0012345B22</code> (WW = wilaya, L = type B/C/H/R, AA = année)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicle" className="text-base font-semibold">
                        Type de véhicule <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="vehicle"
                        placeholder="Ex: Utilitaire 3.5T, Van, Moto..."
                        value={(formData as any).vehicle}
                        onChange={(e) => {
                          setSubmitError(null);
                          setFieldErrors((prev) => ({ ...prev, vehicle: undefined }));
                          setFormData({ ...formData, vehicle: e.target.value });
                        }}
                        required
                        className="h-11"
                      />
                      <FormFieldError message={fieldErrors.vehicle} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="license" className="text-base font-semibold">
                        Numéro de permis <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="license"
                        placeholder="Ex: AB123456"
                        value={(formData as any).license}
                        onChange={(e) => {
                          setSubmitError(null);
                          setFieldErrors((prev) => ({ ...prev, license: undefined }));
                          setFormData({ ...formData, license: e.target.value });
                        }}
                        required
                        className="h-11"
                      />
                      <FormFieldError message={fieldErrors.license} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experience" className="text-base font-semibold">
                      Années d'expérience
                    </Label>
                    <Input
                      id="experience"
                      type="number"
                      placeholder="0"
                      value={(formData as any).experience}
                      onChange={(e) => {
                        setSubmitError(null);
                        setFormData({ ...formData, experience: e.target.value });
                      }}
                      min="0"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Régions desservies</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto p-3 border rounded-lg bg-slate-50 dark:bg-slate-900">
                      {WILAYAS.map((wilaya) => (
                        <div key={wilaya.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={wilaya.id}
                            checked={(formData as any).regions?.includes(wilaya.id) || false}
                            onCheckedChange={(checked) =>
                              handleRegionChange(wilaya.id, checked as boolean)
                            }
                          />
                          <label htmlFor={wilaya.id} className="text-sm cursor-pointer">
                            {wilaya.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-base font-semibold">
                      Description (optionnel)
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Parlez-nous un peu de vous et de votre expérience..."
                      value={(formData as any).description}
                      onChange={(e) => {
                        setSubmitError(null);
                        setFormData({ ...formData, description: e.target.value });
                      }}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </CardContent>

            <div className="px-6 pb-6 space-y-4">
              <Button
                type="submit"
                className={`w-full text-lg py-6 ${
                  isRelais
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Créer {isRelais ? 'le point relais' : 'mon profil'}
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                Vous pourrez modifier ces informations plus tard dans les paramètres
              </p>
            </div>
          </form>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
