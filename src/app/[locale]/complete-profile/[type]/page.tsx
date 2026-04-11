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
import { Loader2, Store, Truck, CheckCircle, AlertCircle, Upload, X } from 'lucide-react';
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
    const [uploadedDocs, setUploadedDocs] = useState<Array<{ url: string; filename: string; size: number }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
  
    // Load existing documents when profile exists
    useEffect(() => {
      if (isRelais && session?.user?.id) {
        const loadExistingDocs = async () => {
          try {
            const response = await fetch(`/api/relais?userId=${session.user.id}&_=${Date.now()}`, {
              cache: 'no-store',
            });
            const data = await response.json();
            if (Array.isArray(data) && data[0]?.commerceDocuments) {
              const docs = JSON.parse(data[0].commerceDocuments || '[]');
              setUploadedDocs(Array.isArray(docs) ? docs : []);
            }
          } catch (error) {
            console.error('Error loading documents:', error);
          }
        };
        loadExistingDocs();
      }
    }, [isRelais, session?.user?.id]);

      // Load existing transporter documents
      useEffect(() => {
        if (isTransporter && session?.user?.id) {
          const loadTransporterDocs = async () => {
            try {
              const response = await fetch(`/api/transporters?userId=${session.user.id}&_=${Date.now()}`, {
                cache: 'no-store',
              });
              const data = await response.json();
              if (Array.isArray(data) && data[0]?.documents) {
                const docs = JSON.parse(data[0].documents || '[]');
                setUploadedDocs(Array.isArray(docs) ? docs : []);
              }
            } catch (error) {
              console.error('Error loading transporter documents:', error);
            }
          };
          loadTransporterDocs();
        }
      }, [isTransporter, session?.user?.id]);
  
    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputEl = e.currentTarget;
      const files = inputEl.files;
      if (!files) return;
  
      for (const file of Array.from(files)) {
        setIsUploading(true);
        setUploadError(null);
  
        try {
          const formDataToSend = new FormData();
          formDataToSend.append('file', file);
  
            const uploadEndpoint = isRelais ? '/api/relais/upload' : '/api/transporters/upload';
            const response = await fetch(uploadEndpoint, {
            method: 'POST',
            body: formDataToSend,
          });
  
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur lors de l\'upload');
          }
  
          const result = await response.json();
          setUploadedDocs((prev) => [
            ...prev,
            { url: result.url, filename: result.filename, size: result.size },
          ]);
  
          toast({
            title: 'Succès',
            description: `Document "${file.name}" uploadé avec succès`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur lors de l\'upload';
          setUploadError(message);
          toast({
            title: 'Erreur upload',
            description: message,
            variant: 'destructive',
          });
        } finally {
          setIsUploading(false);
        }
      }
  
      // Reset file input safely after async operations
      if (inputEl) {
        inputEl.value = '';
      }
    };
  
    const handleRemoveDocument = (url: string) => {
      setUploadedDocs((prev) => prev.filter((doc) => doc.url !== url));
    };
  
    const getFormattedFileSize = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

  // Check if user already has a profile of this type
  useEffect(() => {
    const checkProfile = async () => {
      if (!session?.user?.id) return;

      try {
        const endpoint = isRelais ? '/api/relais' : '/api/transporters';
        const response = await fetch(`${endpoint}?userId=${session.user.id}&_=${Date.now()}`, {
          cache: 'no-store',
        });
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          const existingProfile = data[0];
          const userRes = await fetch(`/api/users/${session.user.id}`);
          const userData = userRes.ok ? await userRes.json() : null;
          const hasRc = Boolean(userData?.siret?.trim());
          const hasCommerceDocuments = (() => {
            try {
              const docs = JSON.parse(existingProfile?.commerceDocuments || '[]');
              return Array.isArray(docs) && docs.length > 0;
            } catch {
              return false;
            }
          })();
          const isApproved = existingProfile?.status === 'APPROVED';
          const isProfileComplete = isRelais
            ? Boolean(existingProfile?.commerceName?.trim() && existingProfile?.address?.trim() && existingProfile?.ville?.trim() && hasRc && hasCommerceDocuments && isApproved)
            : Boolean(existingProfile?.vehicle?.trim() && existingProfile?.license?.trim() && hasRc && isApproved);

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

      if (uploadedDocs.length === 0) {
        setSubmitError('Veuillez uploader au moins un document de preuve du commerce.');
        return false;
      }
    } else if (isTransporter) {
      const data = formData as any;
      const phone = String(data.phone || '').trim();
            if (uploadedDocs.length === 0) {
              setSubmitError('Veuillez uploader au moins un document justificatif (permis, RC, carte grise...).');
              return false;
            }
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
          if (updateUserResponse.status === 409 && error?.code === 'DUPLICATE_RELAIS_RC') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Ce numéro RC est déjà utilisé par un autre point relais actif.' }));
            throw new Error('Ce numéro RC est déjà utilisé par un autre point relais actif.');
          }
          if (updateUserResponse.status === 409 && error?.code === 'DUPLICATE_TRANSPORTER_RC') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Ce numéro RC est déjà utilisé par un transporteur actif.' }));
            throw new Error('Ce numéro RC est déjà utilisé par un transporteur actif.');
          }
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
            commerceDocuments: uploadedDocs,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          const msg = error?.details || error?.error || 'Erreur lors de la création du point relais';
          if (error?.code === 'MISSING_REQUIRED_FIELDS') {
            setSubmitError('Des champs obligatoires sont manquants.');
          }
          if (response.status === 409 && error?.code === 'DUPLICATE_RELAIS_RC') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Ce numéro RC est déjà utilisé par un autre point relais actif.' }));
            throw new Error('Ce numéro RC est déjà utilisé par un autre point relais actif.');
          }
          if (response.status === 409 && error?.code === 'DUPLICATE_TRANSPORTER_RC') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Ce numéro RC est déjà utilisé par un transporteur actif.' }));
            throw new Error('Ce numéro RC est déjà utilisé par un transporteur actif.');
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
          if (updateUserResponse.status === 409 && error?.code === 'DUPLICATE_TRANSPORTER_RC') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Ce numéro RC est déjà utilisé par un autre transporteur actif.' }));
            throw new Error('Ce numéro RC est déjà utilisé par un autre transporteur actif.');
          }
          if (updateUserResponse.status === 409 && error?.code === 'DUPLICATE_RELAIS_RC') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Ce numéro RC est déjà utilisé par un point relais actif.' }));
            throw new Error('Ce numéro RC est déjà utilisé par un point relais actif.');
          }
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
            documents: uploadedDocs,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          const msg = error?.details || error?.error || 'Erreur lors de la création du profil transporteur';
          if (response.status === 409 && error?.code === 'DUPLICATE_TRANSPORTER_RC') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Ce numéro RC est déjà utilisé par un autre transporteur actif.' }));
            throw new Error('Ce numéro RC est déjà utilisé par un autre transporteur actif.');
          }
          if (response.status === 409 && error?.code === 'DUPLICATE_RELAIS_RC') {
            setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Ce numéro RC est déjà utilisé par un point relais actif.' }));
            throw new Error('Ce numéro RC est déjà utilisé par un point relais actif.');
          }
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
                    <Input
                      id="address"
                      placeholder="Ex: 123 Rue Didouche Mourad, Alger Centre"
                      value={(formData as any).address || ''}
                      onChange={(e) => {
                        setSubmitError(null);
                        setFieldErrors((prev) => ({ ...prev, address: undefined }));
                        setFormData({ ...formData, address: e.target.value });
                      }}
                      required
                      className="h-11"
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

                  <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-amber-600" />
                      <Label htmlFor="commerceDocs" className="text-base font-semibold">
                        Preuves du commerce <span className="text-red-500">*</span>
                      </Label>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Ajoutez les pièces justificatives (RC, certificat, etc.). Formats: PDF, JPEG, PNG. Taille max: 5 MB par fichier.
                    </p>

                    {uploadError && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                        {uploadError}
                      </div>
                    )}

                    <input
                      id="commerceDocs"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleDocumentUpload}
                      disabled={isUploading}
                      className="block w-full text-sm file:mr-4 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm"
                    />

                    {isUploading && (
                      <p className="text-sm text-slate-600 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Upload en cours...
                      </p>
                    )}

                    {uploadedDocs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Documents ajoutés ({uploadedDocs.length})
                        </p>
                        <div className="space-y-2">
                          {uploadedDocs.map((doc) => (
                            <div key={doc.url} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                              <div className="min-w-0">
                                <p className="text-sm truncate">{doc.filename}</p>
                                <p className="text-xs text-slate-500">{getFormattedFileSize(doc.size)}</p>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveDocument(doc.url)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

                  <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-blue-600" />
                      <Label htmlFor="transporterDocs" className="text-base font-semibold">
                        Documents justificatifs <span className="text-red-500">*</span>
                      </Label>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Joignez vos pièces justificatives : permis de conduire, RC, carte grise... Formats: PDF, JPEG, PNG. Taille max: 5 MB.
                    </p>

                    {uploadError && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                        {uploadError}
                      </div>
                    )}

                    <input
                      id="transporterDocs"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleDocumentUpload}
                      disabled={isUploading}
                      className="block w-full text-sm file:mr-4 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm"
                    />

                    {isUploading && (
                      <p className="text-sm text-slate-600 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Upload en cours...
                      </p>
                    )}

                    {uploadedDocs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Documents ajoutés ({uploadedDocs.length})
                        </p>
                        <div className="space-y-2">
                          {uploadedDocs.map((doc) => (
                            <div key={doc.url} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                              <div className="min-w-0">
                                <p className="text-sm truncate">{doc.filename}</p>
                                <p className="text-xs text-slate-500">{getFormattedFileSize(doc.size)}</p>
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveDocument(doc.url)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
