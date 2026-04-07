'use client';

import { useState, Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Link } from '@/i18n/routing';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError, FormGlobalError } from '@/components/ui/form-error';
import { Loader2, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function RegisterForm() {
  const t = useTranslations('auth.register');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    commerceRegisterNumber?: string;
    vehicle?: string;
    license?: string;
    commerceName?: string;
    address?: string;
    ville?: string;
  }>({});

  const [formData, setFormData] = useState({
    // Common fields
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    personalAddress: '',
    password: '',
    confirmPassword: '',
    role: 'CLIENT',
  });

  const validateForm = () => {
    const errors: typeof fieldErrors = {};
    const phoneRegex = /^\+?[0-9]{8,15}$/;

    if (!formData.firstName.trim()) errors.firstName = 'Le prénom est obligatoire.';
    if (!formData.lastName.trim()) errors.lastName = 'Le nom est obligatoire.';
    if (!formData.phone.trim()) {
      errors.phone = 'Le téléphone est obligatoire.';
    } else if (!phoneRegex.test(formData.phone.trim())) {
      errors.phone = 'Format de téléphone invalide (8 à 15 chiffres, + autorisé).';
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

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError('Veuillez corriger les champs en rouge.');
      toast({ title: 'Erreur', description: 'Veuillez corriger les champs en rouge.', variant: 'destructive' });
      return false;
    }

    setSubmitError(null);
    setFieldErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
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
          role: 'CLIENT',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const rawError = `${data?.error || ''} ${data?.details || ''}`.toLowerCase();
        const isExistingEmail = response.status === 409
          || data?.code === 'EMAIL_ALREADY_EXISTS'
          || rawError.includes('email already exists');

        if (isExistingEmail) {
          setFieldErrors(prev => ({ ...prev, email: 'Cet email est déjà utilisé. Connectez-vous ou utilisez une autre adresse.' }));
          throw new Error('Un compte existe déjà avec cet email. Connectez-vous pour continuer.');
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

      toast({ title: 'Compte créé', description: 'Bienvenue sur SwiftColis!' });
      const dashboardPath = `/${locale}/dashboard/client`;
      window.location.href = dashboardPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de creer le compte';
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


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 p-4 py-8">
      <div className="text-center mb-8">
        <BrandLogo className="mb-6" />
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        <div className="mt-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          Inscription client
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <FormGlobalError message={submitError} className="mx-6 mt-6" />

          {/* Common Fields */}
          <div className="p-6 space-y-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Informations personnelles</h3>

            {/* Common Fields */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm font-medium text-slate-700 dark:text-slate-300">Prénom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="firstName" placeholder="Votre prénom" value={formData.firstName}
                    onChange={(e) => { setFormData({ ...formData, firstName: e.target.value }); setFieldErrors(p => ({ ...p, firstName: undefined })); setSubmitError(null); }}
                    className="pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700" required />
                </div>
                <FormFieldError message={fieldErrors.firstName} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm font-medium text-slate-700 dark:text-slate-300">Nom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="lastName" placeholder="Votre nom" value={formData.lastName}
                    onChange={(e) => { setFormData({ ...formData, lastName: e.target.value }); setFieldErrors(p => ({ ...p, lastName: undefined })); setSubmitError(null); }}
                    className="pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700" required />
                </div>
                <FormFieldError message={fieldErrors.lastName} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="email" type="email" placeholder="email@exemple.com" value={formData.email}
                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFieldErrors(p => ({ ...p, email: undefined })); }}
                    className={`pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 ${fieldErrors.email ? 'border-red-400' : ''}`}
                    required />
                </div>
                <FormFieldError message={fieldErrors.email} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="phone" type="tel" placeholder="+213 XX XX XX XX" value={formData.phone}
                    onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); setFieldErrors(p => ({ ...p, phone: undefined })); setSubmitError(null); }}
                    className={`pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 ${fieldErrors.phone ? 'border-red-400' : ''}`} required />
                </div>
                <FormFieldError message={fieldErrors.phone} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="personalAddress" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Adresse personnelle <span className="text-slate-400 font-normal">(optionnel)</span>
              </Label>
              <Input id="personalAddress" placeholder="Ex: 12 Rue Didouche Mourad" value={formData.personalAddress}
                onChange={(e) => setFormData({ ...formData, personalAddress: e.target.value })}
                className="h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFieldErrors(p => ({ ...p, password: undefined })); }}
                    className={`pl-10 pr-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 ${fieldErrors.password ? 'border-red-400' : ''}`}
                    required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FormFieldError message={fieldErrors.password} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); setFieldErrors(p => ({ ...p, confirmPassword: undefined })); }}
                    className={`pl-10 pr-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 ${fieldErrors.confirmPassword ? 'border-red-400' : ''}`}
                    required />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FormFieldError message={fieldErrors.confirmPassword} />
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition-all" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer mon compte
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Vous avez un compte ?{' '}
              <Link href={`/${locale}/auth/login`} className="text-emerald-600 hover:underline font-medium">
                Connectez-vous
              </Link>
            </p>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 text-center">Je suis professionnel</p>
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Vous pourrez activer un profil pro plus tard.
              </p>
              <Link
                href={`/${locale}/pro`}
                className="flex items-center justify-center rounded-lg border border-slate-300 bg-white dark:bg-slate-800 px-3 py-2.5 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Acceder a l'espace professionnel
              </Link>
            </div>
          </div>
        </form>
      </div>
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
