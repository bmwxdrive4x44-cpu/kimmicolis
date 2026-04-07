'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { Lock, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormGlobalError } from '@/components/ui/form-error';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const emailFromUrl = useMemo(() => searchParams.get('email') || '', [searchParams]);

  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    if (countdown === 1) {
      router.push('/auth/login');
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Lien invalide: token manquant.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Veuillez saisir un email valide.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || 'Impossible de réinitialiser le mot de passe.');
        return;
      }

      setSuccess('Mot de passe réinitialisé avec succès. Vous allez être redirigé…');
      setPassword('');
      setConfirmPassword('');
      setCountdown(3);
    } catch {
      setError('Impossible de réinitialiser le mot de passe pour le moment.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-slate-800 dark:border-slate-700 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Réinitialiser le mot de passe</h1>
        <p className="text-sm text-slate-500 mt-1">Choisissez un nouveau mot de passe pour votre compte.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <FormGlobalError message={error} />

          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {success}
                {countdown > 1 && (
                  <span className="ml-1 font-semibold">Redirection dans {countdown - 1}s…</span>
                )}
              </span>
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Mettre à jour le mot de passe
          </Button>

          <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </form>
      </div>
    </div>
  );
}
