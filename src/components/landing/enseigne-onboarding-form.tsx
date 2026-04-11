'use client';

import { useCallback, useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError, FormGlobalError } from '@/components/ui/form-error';
import { useToast } from '@/hooks/use-toast';
import { Building2, CheckCircle, Loader2 } from 'lucide-react';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  legalName: string;
  website: string;
  billingEmail: string;
  operationalCity: string;
  monthlyVolume: string;
};

const initialFormState: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  businessName: '',
  legalName: '',
  website: '',
  billingEmail: '',
  operationalCity: '',
  monthlyVolume: '0',
};

export function EnseigneOnboardingForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const wrongRole = Boolean(session?.user?.role && status === 'authenticated' && session.user.role !== 'ENSEIGNE');

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSubmitError(null);
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadExisting = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setIsLoading(false);
      return;
    }

    if (wrongRole) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [userRes, enseigneRes] = await Promise.all([
        fetch(`/api/users/${session.user.id}`),
        fetch('/api/enseignes'),
      ]);

      const userData = userRes.ok ? await userRes.json() : null;
      const enseigneData = enseigneRes.ok ? await enseigneRes.json() : null;

      setForm((prev) => ({
        ...prev,
        firstName: userData?.firstName || session.user.name?.split(' ')[0] || '',
        lastName: userData?.lastName || session.user.name?.split(' ').slice(1).join(' ') || '',
        email: userData?.email || session.user.email || '',
        phone: userData?.phone || '',
        businessName: enseigneData?.enseigne?.businessName || '',
        legalName: enseigneData?.enseigne?.legalName || '',
        website: enseigneData?.enseigne?.website || '',
        billingEmail: enseigneData?.enseigne?.billingEmail || '',
        operationalCity: enseigneData?.enseigne?.operationalCity || '',
        monthlyVolume: String(enseigneData?.enseigne?.monthlyVolume ?? 0),
      }));
    } catch (error) {
      console.error('Erreur chargement onboarding enseigne:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email, session?.user?.id, session?.user?.name, status, wrongRole]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const validateForm = () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    const phoneRegex = /^\+?[0-9]{8,15}$/;

    if (!form.businessName.trim()) errors.businessName = 'Le nom commercial est obligatoire.';
    if (form.website.trim()) {
      try {
        const u = new URL(form.website);
        if (!['http:', 'https:'].includes(u.protocol)) errors.website = 'URL invalide (http/https).';
      } catch {
        errors.website = 'URL invalide (http/https).';
      }
    }

    if (form.billingEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.billingEmail.trim())) {
      errors.billingEmail = 'Email de facturation invalide.';
    }

    const monthly = Number.parseInt(form.monthlyVolume, 10);
    if (!Number.isInteger(monthly) || monthly < 0) {
      errors.monthlyVolume = 'Volume mensuel invalide.';
    }

    if (status !== 'authenticated') {
      if (!form.firstName.trim()) errors.firstName = 'Le prenom est obligatoire.';
      if (!form.lastName.trim()) errors.lastName = 'Le nom est obligatoire.';
      if (!form.email.trim()) {
        errors.email = 'L email est obligatoire.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Le format de l email est invalide.';
      }
      if (!form.phone.trim()) {
        errors.phone = 'Le telephone est obligatoire.';
      } else if (!phoneRegex.test(form.phone.trim())) {
        errors.phone = 'Format telephone invalide (8 a 15 chiffres).';
      }
      if (!form.password) {
        errors.password = 'Le mot de passe est obligatoire.';
      } else if (form.password.length < 6) {
        errors.password = 'Le mot de passe doit contenir au moins 6 caracteres.';
      }
      if (!form.confirmPassword) {
        errors.confirmPassword = 'La confirmation est obligatoire.';
      } else if (form.confirmPassword !== form.password) {
        errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitError('Veuillez corriger les champs en rouge.');
      return false;
    }

    setSubmitError(null);
    return true;
  };

  const ensureAuthenticatedEnseigne = async () => {
    if (status === 'authenticated' && session?.user?.id && session.user.role === 'ENSEIGNE') {
      return session.user.id;
    }

    await signOut({ redirect: false }).catch(() => undefined);

    const fullName = `${form.firstName} ${form.lastName}`.trim();
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
        role: 'ENSEIGNE',
      }),
    });

    const createUserData = await createUserRes.json().catch(() => null);
    if (!createUserRes.ok) {
      if (createUserRes.status === 409 || createUserData?.code === 'EMAIL_ALREADY_EXISTS') {
        setFieldErrors((prev) => ({ ...prev, email: 'Cet email est deja utilise.' }));
        throw new Error('Un compte existe deja avec cet email. Connectez-vous puis completez votre profil enseigne.');
      }
      if (createUserRes.status === 403 || createUserData?.code === 'BANNED_IDENTITY') {
        if (createUserData?.blockedType === 'EMAIL') {
          setFieldErrors((prev) => ({ ...prev, email: 'Cette adresse email est bannie.' }));
        }
        throw new Error(createUserData?.details || 'Cette identité est bannie suite à la suspension d un point relais.');
      }
      throw new Error(createUserData?.details || createUserData?.error || 'Impossible de creer le compte.');
    }

    if (createUserData?.emailConfirmationSent) {
      toast({
        title: 'Email de confirmation envoye',
        description: 'Votre inscription enseigne est confirmee par email.',
      });
    }

    if (createUserData?.requiresEmailVerification) {
      throw new Error('EMAIL_NOT_VERIFIED_REGISTRATION');
    }

    const signInResult = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (!signInResult?.ok) {
      throw new Error('Compte cree, mais connexion automatique echouee. Connectez-vous puis recommencez.');
    }

    return createUserData.id as string;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    if (wrongRole) {
      setSubmitError('Ce compte est connecte avec un role incompatible. Utilisez un compte ENSEIGNE.');
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const userId = await ensureAuthenticatedEnseigne();

      await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          name: `${form.firstName} ${form.lastName}`.trim() || undefined,
          phone: form.phone || undefined,
        }),
      }).catch(() => undefined);

      const saveRes = await fetch('/api/enseignes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          legalName: form.legalName,
          website: form.website,
          monthlyVolume: Number.parseInt(form.monthlyVolume, 10),
          billingEmail: form.billingEmail,
          operationalCity: form.operationalCity,
        }),
      });

      const saveText = await saveRes.text();
      let saveData: { error?: string; code?: string } | null = null;
      try {
        saveData = saveText ? JSON.parse(saveText) as { error?: string; code?: string } : null;
      } catch {
        saveData = null;
      }

      if (!saveRes.ok) {
        if (saveRes.status === 409 && saveData?.code === 'DUPLICATE_ENSEIGNE_RC') {
          throw new Error('Ce numéro de Registre du Commerce est déjà utilisé par un autre compte.');
        }
        throw new Error(saveData?.error || saveText || 'Impossible d enregistrer le profil enseigne.');
      }

      toast({
        title: 'Profil enseigne enregistre',
        description: 'Bienvenue sur votre espace enseigne.',
      });

      router.replace(`/${locale}/dashboard/enseigne`);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
      const message = rawMessage === 'EMAIL_NOT_VERIFIED_REGISTRATION'
        ? 'Compte cree. Votre profil enseigne est en attente de finalisation: verifiez votre email, puis reconnectez-vous pour terminer votre dossier. Il sera ensuite pris en compte dans votre espace.'
        : rawMessage;
      setSubmitError(message);
      toast({
        title: rawMessage === 'EMAIL_NOT_VERIFIED_REGISTRATION' ? 'Action requise' : 'Erreur',
        description: message,
        variant: rawMessage === 'EMAIL_NOT_VERIFIED_REGISTRATION' ? 'default' : 'destructive',
      });
      if (rawMessage === 'EMAIL_NOT_VERIFIED_REGISTRATION') {
        router.replace(`/${locale}/auth/login?notice=enseigne-email-verification`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card id="enseigne-onboarding-form" className="border-slate-200 shadow-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Demarrer en tant qu enseigne</CardTitle>
            <CardDescription>
              Creez votre compte enseigne et activez votre espace B2B en quelques minutes.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {status === 'authenticated' && session?.user?.role === 'ENSEIGNE' && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>Compte enseigne detecte. Vous pouvez mettre a jour vos informations ci-dessous.</div>
          </div>
        )}

        <FormGlobalError message={submitError} className="mb-6" />

        <form className="space-y-6" onSubmit={handleSubmit}>
          {status !== 'authenticated' && (
            <div className="space-y-4 rounded-xl border bg-slate-50 p-5">
              <h3 className="font-semibold text-slate-900">Informations de compte</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prenom</Label>
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
                  <Label>Telephone</Label>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nom commercial</Label>
              <Input value={form.businessName} onChange={(e) => setField('businessName', e.target.value)} />
              <FormFieldError message={fieldErrors.businessName} />
            </div>
            <div className="space-y-2">
              <Label>Raison sociale</Label>
              <Input value={form.legalName} onChange={(e) => setField('legalName', e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Site web</Label>
              <Input value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://..." />
              <FormFieldError message={fieldErrors.website} />
            </div>
            <div className="space-y-2">
              <Label>Email facturation</Label>
              <Input type="email" value={form.billingEmail} onChange={(e) => setField('billingEmail', e.target.value)} placeholder="facturation@enseigne.dz" />
              <FormFieldError message={fieldErrors.billingEmail} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ville operationnelle</Label>
              <Input value={form.operationalCity} onChange={(e) => setField('operationalCity', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Volume mensuel estime</Label>
              <Input type="number" min={0} step={1} value={form.monthlyVolume} onChange={(e) => setField('monthlyVolume', e.target.value)} />
              <FormFieldError message={fieldErrors.monthlyVolume} />
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting || isLoading || wrongRole} className="w-full bg-amber-600 hover:bg-amber-700">
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Activer mon espace enseigne'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
