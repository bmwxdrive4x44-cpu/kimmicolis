
'use client';

import { Suspense, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError, FormGlobalError } from '@/components/ui/form-error';
import { Package, Loader2, Mail, Lock, AlertCircle, Eye, EyeOff, ArrowRight, Truck, Store, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeRole } from '@/lib/roles';

function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const getDashboardPath = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return `/${locale}/dashboard/admin`;
      case 'TRANSPORTER':
        return `/${locale}/dashboard/transporter`;
      case 'RELAIS':
        return `/${locale}/dashboard/relais`;
      case 'ENSEIGNE':
        return `/${locale}/dashboard/enseigne`;
      case 'CLIENT':
      default:
        return `/${locale}/dashboard/client`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: { email?: string; password?: string } = {};

    if (!normalizedEmail) {
      nextErrors.email = 'L\'email est obligatoire.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Le format de l\'email est invalide.';
    }

    if (!password) {
      nextErrors.password = 'Le mot de passe est obligatoire.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setLoginError('Veuillez corriger les champs en rouge.');
      return;
    }

    setFieldErrors({});
    setLoginError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: normalizedEmail,
        password,
        redirect: false,
      });

      if (result?.error || !result?.ok) {
        const errorMessage = result?.error || 'Connexion impossible pour le moment. Réessayez.';
        if (result?.error === 'CredentialsSignin') {
          setFieldErrors({
            email: 'Vérifiez votre email.',
            password: 'Mot de passe incorrect.',
          });
        }
        setLoginError(
          result?.error === 'CredentialsSignin'
            ? 'Email ou mot de passe incorrect. Vérifiez vos identifiants.'
            : `Connexion impossible pour le moment. (${errorMessage})`
        );
        console.error('signIn error', result);
      } else {
        // Fetch session to get user role
        const sessionRes = await fetch('/api/auth/session');
        if (!sessionRes.ok) {
          toast({
            title: 'Connexion réussie',
            description: 'Session ouverte. Redirection vers votre espace client...',
          });
          window.location.href = getDashboardPath('CLIENT');
          return;
        }

        const sessionData = await sessionRes.json();
        const userRole = normalizeRole(sessionData?.user?.role);

        toast({
          title: 'Connexion réussie',
          description: `Bienvenue, ${sessionData?.user?.name || 'utilisateur'}!`,
        });

        // Redirect based on role - force full page reload
        const dashboardPath = getDashboardPath(userRole);
        window.location.href = dashboardPath;
      }
    } catch {
      setLoginError('Impossible de se connecter pour le moment. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('email')}
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="email"
            type="email"
            placeholder="email@exemple.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setLoginError('');
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            className={`pl-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus-visible:ring-emerald-500/20 ${
              fieldErrors.email ? 'border-red-400 focus-visible:ring-red-400/20' : ''
            }`}
            required
          />
        </div>
        <FormFieldError message={fieldErrors.email} />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('password')}
          </Label>
          <Link
            href="/auth/forgot-password"
            className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
          >
            {t('forgotPassword')}
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setLoginError('');
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            className={`pl-10 pr-10 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus-visible:ring-emerald-500/20 ${
              fieldErrors.password ? 'border-red-400 focus-visible:ring-red-400/20' : ''
            }`}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FormFieldError message={fieldErrors.password} />
      </div>

      {/* Inline error */}
      <FormGlobalError message={loginError} />

      {/* Submit */}
      <Button
        type="submit"
        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm shadow-emerald-600/20 transition-all hover:shadow-md hover:shadow-emerald-600/30"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" />
        )}
        {t('submit')}
      </Button>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {t('noAccount')}{' '}
        <Link href="/auth/register" className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors">
          {t('registerLink')}
        </Link>
      </p>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-center text-slate-400 mb-2">Je suis professionnel</p>
        <Link
          href="/pro"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Building2 className="h-3.5 w-3.5" />
          Acceder a l'espace professionnel
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  const t = useTranslations('auth.login');

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 p-12 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>

        <BrandLogo variant="branded" />

        <div className="relative space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Livrez plus vite,<br />gérez plus simplement
            </h2>
            <p className="text-emerald-100 text-lg leading-relaxed">
              La plateforme logistique algérienne qui connecte clients, transporteurs et points relais.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: Package, label: 'Suivi en temps réel de vos colis' },
              { icon: Truck, label: 'Réseau de transporteurs vérifiés' },
              { icon: Store, label: 'Plus de 500 points relais en Algérie' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-emerald-50">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-emerald-200">
          © {new Date().getFullYear()} SwiftColis — Plateforme de livraison
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-950">
        {/* Mobile logo */}
        <BrandLogo className="mb-10 lg:hidden" />

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </div>

          <Suspense fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
