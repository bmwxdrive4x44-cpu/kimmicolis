'use client';

import { Suspense, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const getDashboardPath = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return `/${locale}/dashboard/admin`;
      case 'TRANSPORTER':
        return `/${locale}/dashboard/transporter`;
      case 'RELAIS':
        return `/${locale}/dashboard/relais`;
      case 'CLIENT':
      default:
        return `/${locale}/dashboard/client`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setLoginError('Veuillez saisir votre email et votre mot de passe');
      return;
    }

    setLoginError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: normalizedEmail,
        password,
        redirect: false,
      });

      if (result?.error || !result?.ok) {
        toast({
          title: 'Erreur',
          description: result?.error === 'CredentialsSignin'
        setLoginError(
          result?.error === 'CredentialsSignin'
            ? 'Email ou mot de passe incorrect. Vérifiez vos identifiants.'
            : 'Connexion impossible pour le moment. Réessayez.'
        onst sessionRes = await fetch('/api/auth/session');
        if (!sessionRes.ok) {
          toast({
            title: 'Connexion réussie',
            description: 'Session ouverte. Redirection vers votre espace client...',
          });
          window.location.href = getDashboardPath('CLIENT');
          return;
        }

        const sessionData = await sessionRes.json();
        const userRole = sessionData?.user?.role || 'CLIENT';

        toast({
          title: 'Connexion réussie',
          description: `Bienvenue, ${sessionData?.user?.name || 'utilisateur'}!`,
        });

        // Redirect based on role - force full page reload
        const dashboardPath = getDashboardPath(userRole);
        window.location.href = dashboardPath;
      }
    } catch {
      toast({
        title: 'Erreur',
      setLoginError('Impossible de se connecter pour le moment. Réessayez.'etIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: 'Mot de passe oublié',
      description: 'La récupération de mot de passe sera disponible très bientôt.',
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setLoginError(''); }}
              className={`pl-10 ${loginError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
              className={`pl-10 ${loginError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              required
            />
          </div>
        </div>

        {/* Inline error message */}
        {loginError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button type="button" variant="link" className="px-0 text-emerald-600" onClick={handleForgotPassword}>
            {t('forgotPassword')}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('submit')}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/auth/register" className="text-emerald-600 hover:underline font-medium">
            {t('registerLink')}
          </Link>
        </p>
      </CardFooter>
    </form>
  );
}

function LoginLoading() {
  const t = useTranslations('auth.login');
  
  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </CardContent>
    </Card>
  );
}

const DEV_DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@swiftcolis.dz', password: 'admin123' },
  { role: 'Client', email: 'client@demo.dz', password: 'client123' },
  { role: 'Transporteur', email: 'transport@demo.dz', password: 'transport123' },
  { role: 'Relais', email: 'relais@demo.dz', password: 'relais123' },
];

export default function LoginPage() {
  const t = useTranslations('auth.login');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Package className="h-10 w-10 text-emerald-600" />
        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          SwiftColis
        </span>
      </Link>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <Suspense fallback={<LoginLoading />}>
          <LoginForm />
        </Suspense>
      </Card>

      {process.env.NODE_ENV !== 'production' && (
        <Card className="w-full max-w-md mt-4 border-dashed border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle className="text-base">Comptes de démonstration</CardTitle>
            <CardDescription>Disponibles automatiquement en développement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {DEV_DEMO_ACCOUNTS.map((account) => (
              <div key={account.email} className="rounded-md border bg-white/70 dark:bg-slate-900/40 px-3 py-2">
                <div className="font-semibold">{account.role}</div>
                <div>{account.email}</div>
                <div className="text-muted-foreground">{account.password}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
