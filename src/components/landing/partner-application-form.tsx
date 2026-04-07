'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormFieldError, FormGlobalError } from '@/components/ui/form-error';
import { useToast } from '@/hooks/use-toast';
import { WILAYAS } from '@/lib/constants';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';
import { AlertCircle, CheckCircle, Loader2, Store, Truck } from 'lucide-react';

type PartnerRole = 'RELAIS' | 'TRANSPORTER';

type PartnerApplicationFormProps = {
  role: PartnerRole;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  commerceRegisterNumber: string;
  commerceName: string;
  address: string;
  ville: string;
  vehicle: string;
  license: string;
  experience: string;
  regions: string[];
  description: string;
};

const initialFormState: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  commerceRegisterNumber: '',
  commerceName: '',
  address: '',
  ville: '',
  vehicle: '',
  license: '',
  experience: '',
  regions: [],
  description: '',
};

export function PartnerApplicationForm({ role }: PartnerApplicationFormProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const { toast } = useToast();
  const isRelais = role === 'RELAIS';
  const theme = isRelais
    ? {
        accent: 'emerald',
        icon: Store,
        title: 'Postuler comme point relais',
        description: 'Déposez votre dossier en ligne. Activation après vérification, conformité opérationnelle et caution possible selon le profil.',
        dashboardPath: `/${locale}/dashboard/relais`,
      }
    : {
        accent: 'blue',
        icon: Truck,
        title: 'Postuler comme transporteur',
        description: 'Créez votre dossier transporteur en quelques minutes, avec création de compte si nécessaire.',
        dashboardPath: `/${locale}/dashboard/transporter`,
      };

  const Icon = theme.icon;
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const wrongRole = Boolean(session?.user?.role && status === 'authenticated' && session.user.role !== role);

  const fullName = useMemo(
    () => `${form.firstName} ${form.lastName}`.trim() || session?.user?.name || '',
    [form.firstName, form.lastName, session?.user?.name]
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSubmitError(null);
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegionChange = (region: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      regions: checked ? [...prev.regions, region] : prev.regions.filter((item) => item !== region),
    }));
  };

  const fetchExistingApplication = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id || wrongRole) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    try {
      const endpoint = isRelais ? '/api/relais' : '/api/transporters';
      const [profileRes, userRes] = await Promise.all([
        fetch(`${endpoint}?userId=${session.user.id}`),
        fetch(`/api/users/${session.user.id}`),
      ]);

      const profileData = profileRes.ok ? await profileRes.json() : [];
      const userData = userRes.ok ? await userRes.json() : null;
      const existing = Array.isArray(profileData) && profileData.length > 0 ? profileData[0] : null;

      setForm((prev) => ({
        ...prev,
        firstName: userData?.firstName || session.user.name?.split(' ')[0] || '',
        lastName: userData?.lastName || session.user.name?.split(' ').slice(1).join(' ') || '',
        email: userData?.email || session.user.email || '',
        phone: userData?.phone || '',
        commerceRegisterNumber: userData?.siret || '',
        commerceName: existing?.commerceName || '',
        address: existing?.address || '',
        ville: existing?.ville || '',
        vehicle: existing?.vehicle || '',
        license: existing?.license || '',
        experience: existing?.experience !== undefined ? String(existing.experience) : '',
        regions: existing?.regions
          ? Array.isArray(existing.regions)
            ? existing.regions
            : (() => {
                try {
                  return JSON.parse(existing.regions);
                } catch {
                  return [];
                }
              })()
          : [],
        description: existing?.description || '',
      }));

      setExistingRecordId(existing?.id || null);
      setExistingStatus(existing?.status || null);
    } catch (error) {
      console.error('Error checking partner application:', error);
    } finally {
      setIsChecking(false);
    }
  }, [isRelais, session?.user?.email, session?.user?.id, session?.user?.name, status, wrongRole]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setIsChecking(false);
      return;
    }
    void fetchExistingApplication();
  }, [fetchExistingApplication, status]);

  const validateForm = () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    const rcNumber = normalizeCommerceRegisterNumber(form.commerceRegisterNumber);
    const phoneRegex = /^\+?[0-9]{8,15}$/;

    if (!rcNumber) {
      errors.commerceRegisterNumber = 'Le numéro du registre du commerce est obligatoire.';
    } else if (!isAlgerianCommerceRegisterNumber(rcNumber)) {
      errors.commerceRegisterNumber = 'Format RC invalide. Exemple : 16/0012345B22';
    }

    if (status !== 'authenticated') {
      if (!form.firstName.trim()) errors.firstName = 'Le prénom est obligatoire.';
      if (!form.lastName.trim()) errors.lastName = 'Le nom est obligatoire.';
      if (!form.email.trim()) {
        errors.email = 'L\'email est obligatoire.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Le format de l\'email est invalide.';
      }
      if (!form.phone.trim()) {
        errors.phone = 'Le téléphone est obligatoire.';
      } else if (!phoneRegex.test(form.phone.trim())) {
        errors.phone = 'Format de téléphone invalide (8 à 15 chiffres, + autorisé).';
      }
      if (!form.password) {
        errors.password = 'Le mot de passe est obligatoire.';
      } else if (form.password.length < 6) {
        errors.password = 'Le mot de passe doit contenir au moins 6 caractères.';
      }
      if (!form.confirmPassword) {
        errors.confirmPassword = 'La confirmation du mot de passe est obligatoire.';
      } else if (form.password !== form.confirmPassword) {
        errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
      }
    }

    if (isRelais) {
      if (!form.commerceName.trim()) errors.commerceName = 'Le nom du commerce est obligatoire.';
      if (!form.address.trim()) errors.address = 'L\'adresse complète est obligatoire.';
      if (!form.ville.trim()) errors.ville = 'La ville est obligatoire.';
    } else {
      if (!form.vehicle.trim()) errors.vehicle = 'Le type de véhicule est obligatoire.';
      if (!form.license.trim()) errors.license = 'Le numéro de permis est obligatoire.';
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

  const ensureAuthenticatedUser = async () => {
    if (status === 'authenticated' && session?.user?.id) {
      return session.user.id;
    }

    await signOut({ redirect: false }).catch(() => undefined);

    const createUserRes = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fullName,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role,
        siret: normalizeCommerceRegisterNumber(form.commerceRegisterNumber),
      }),
    });

    const createUserData = await createUserRes.json().catch(() => null);
    if (!createUserRes.ok) {
      const isExistingAccount = createUserRes.status === 409
        || createUserData?.code === 'EMAIL_ALREADY_EXISTS'
        || String(createUserData?.error || '').toLowerCase().includes('email already exists');

      if (isExistingAccount) {
        setFieldErrors((prev) => ({ ...prev, email: 'Cet email est déjà utilisé.' }));
        throw new Error('Un compte existe déjà avec cet email. Connectez-vous puis complétez votre dossier.');
      }

      if (createUserData?.code === 'INVALID_COMMERCE_REGISTER_NUMBER') {
        setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide.' }));
      }

      throw new Error(createUserData?.details || createUserData?.error || 'Impossible de créer le compte.');
    }

    const signInResult = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (!signInResult?.ok) {
      throw new Error('Compte créé, mais la connexion automatique a échoué. Connectez-vous pour continuer.');
    }

    return createUserData.id as string;
  };

  const updateUserProfile = async (userId: string) => {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        name: fullName || undefined,
        phone: form.phone || undefined,
        siret: normalizeCommerceRegisterNumber(form.commerceRegisterNumber),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || 'Impossible de mettre à jour le profil utilisateur.');
    }
  };

  const submitRelais = async (userId: string) => {
    const payload = {
      userId,
      commerceName: form.commerceName,
      address: form.address,
      ville: form.ville,
      commerceRegisterNumber: normalizeCommerceRegisterNumber(form.commerceRegisterNumber),
    };

    const response = existingRecordId
      ? await fetch(`/api/relais/${existingRecordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/relais', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (data?.field === 'commerceRegisterNumber' || data?.code === 'INVALID_COMMERCE_REGISTER_NUMBER') {
        setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide côté serveur.' }));
      }
      if (response.status === 409 && data?.code === 'DUPLICATE_RELAIS_RC') {
        throw new Error('Ce numéro de Registre du Commerce est déjà utilisé par un autre point relais.');
      }
      throw new Error(data?.error || 'Impossible d\'enregistrer la demande relais.');
    }
  };

  const submitTransporter = async (userId: string) => {
    const payload = {
      userId,
      fullName,
      phone: form.phone,
      vehicle: form.vehicle,
      license: form.license,
      experience: parseInt(form.experience || '0', 10) || 0,
      regions: form.regions,
      description: form.description,
      commerceRegisterNumber: normalizeCommerceRegisterNumber(form.commerceRegisterNumber),
    };

    const response = existingRecordId
      ? await fetch(`/api/transporters/${existingRecordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/transporters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (data?.field === 'commerceRegisterNumber' || data?.code === 'INVALID_COMMERCE_REGISTER_NUMBER') {
        setFieldErrors((prev) => ({ ...prev, commerceRegisterNumber: 'Numéro RC invalide côté serveur.' }));
      }
      if (data?.code === 'MISSING_REQUIRED_FIELDS') {
        setSubmitError('Des champs obligatoires sont manquants.');
      }
      if (response.status === 409 && data?.code === 'DUPLICATE_TRANSPORTER_RC') {
        throw new Error('Ce numéro de Registre du Commerce est déjà utilisé par un autre transporteur.');
      }
      throw new Error(data?.error || 'Impossible d\'enregistrer la demande transporteur.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    if (wrongRole) {
      toast({ title: 'Compte incompatible', description: 'Connectez-vous avec un compte du bon type pour compléter ce dossier.', variant: 'destructive' });
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const userId = await ensureAuthenticatedUser();
      await updateUserProfile(userId);

      if (isRelais) {
        await submitRelais(userId);
      } else {
        await submitTransporter(userId);
      }

      toast({
        title: existingRecordId ? 'Dossier mis à jour' : 'Candidature envoyée',
        description: isRelais
          ? 'Votre point relais est enregistré. Vous pouvez suivre son statut depuis votre espace.'
          : 'Votre dossier transporteur est enregistré. Vous pouvez suivre son statut depuis votre espace.',
      });

      router.push(theme.dashboardPath);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
      setSubmitError(message);
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card id={isRelais ? 'relay-application-form' : 'transporter-application-form'} className="border-slate-200 shadow-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-3 ${isRelais ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>{theme.title}</CardTitle>
            <CardDescription>{theme.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {wrongRole && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              Ce compte est connecté comme {session?.user?.role}. Utilisez un compte {role} ou créez-en un nouveau pour envoyer ce dossier.
            </div>
          </div>
        )}

        {existingStatus && !wrongRole && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              Dossier existant détecté. Statut actuel : <strong>{existingStatus}</strong>. Vous pouvez modifier les informations ci-dessous puis enregistrer.
            </div>
          </div>
        )}

        <FormGlobalError message={submitError} className="mb-6" />

        <form className="space-y-6" onSubmit={handleSubmit}>
          {status !== 'authenticated' && (
            <div className="space-y-4 rounded-xl border bg-slate-50 p-5">
              <div>
                <h3 className="font-semibold text-slate-900">Informations de compte</h3>
                <p className="text-sm text-slate-500">Un compte sera créé automatiquement avant l'envoi du dossier.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
                  <FormFieldError message={fieldErrors.firstName} />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
                  <FormFieldError message={fieldErrors.lastName} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                  <FormFieldError message={fieldErrors.email} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                  <FormFieldError message={fieldErrors.phone} />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe</Label>
                  <Input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} />
                  <FormFieldError message={fieldErrors.password} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Confirmer le mot de passe</Label>
                  <Input type="password" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} />
                  <FormFieldError message={fieldErrors.confirmPassword} />
                </div>
              </div>
            </div>
          )}

          {status === 'authenticated' && !wrongRole && (
            <div className="grid gap-4 md:grid-cols-2 rounded-xl border bg-slate-50 p-5">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                <FormFieldError message={fieldErrors.phone} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Numéro du registre du commerce</Label>
            <Input
              placeholder="Ex: 16/0012345B22"
              value={form.commerceRegisterNumber}
              onChange={(e) => setField('commerceRegisterNumber', e.target.value)}
            />
            <FormFieldError message={fieldErrors.commerceRegisterNumber} />
            <p className="text-xs text-slate-500">Format CNRC : WW/NNNNNNNLAA. Exemple : 16/0012345B22</p>
          </div>

          {isRelais ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Nom du commerce</Label>
                <Input value={form.commerceName} onChange={(e) => setField('commerceName', e.target.value)} />
                <FormFieldError message={fieldErrors.commerceName} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Adresse complète</Label>
                <Textarea rows={3} value={form.address} onChange={(e) => setField('address', e.target.value)} />
                <FormFieldError message={fieldErrors.address} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Ville</Label>
                <Select value={form.ville} onValueChange={(value) => setField('ville', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une wilaya" />
                  </SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map((wilaya) => (
                      <SelectItem key={wilaya.id} value={wilaya.id}>
                        {wilaya.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormFieldError message={fieldErrors.ville} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type de véhicule <span className="text-red-500">*</span></Label>
                  <Input value={form.vehicle} onChange={(e) => setField('vehicle', e.target.value)} />
                  <FormFieldError message={fieldErrors.vehicle} />
                </div>
                <div className="space-y-2">
                  <Label>Numéro de permis <span className="text-red-500">*</span></Label>
                  <Input value={form.license} onChange={(e) => setField('license', e.target.value)} />
                  <FormFieldError message={fieldErrors.license} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Années d'expérience</Label>
                  <Input type="number" min="0" value={form.experience} onChange={(e) => setField('experience', e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Régions desservies</Label>
                <div className="grid max-h-56 grid-cols-2 gap-3 overflow-y-auto rounded-lg border bg-slate-50 p-4 md:grid-cols-3">
                  {WILAYAS.map((wilaya) => (
                    <label key={wilaya.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.regions.includes(wilaya.id)}
                        onCheckedChange={(checked) => handleRegionChange(wilaya.id, Boolean(checked))}
                      />
                      <span>{wilaya.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Décrivez votre expérience, vos disponibilités, votre zone d'activité..."
                />
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || isChecking || wrongRole}
            className={`w-full ${isRelais ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting || isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement en cours...
              </>
            ) : existingRecordId ? (
              'Mettre à jour mon dossier'
            ) : (
              'Envoyer ma candidature'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}