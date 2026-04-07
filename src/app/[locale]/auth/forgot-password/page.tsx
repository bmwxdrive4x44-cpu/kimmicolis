'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormGlobalError } from '@/components/ui/form-error';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setDevResetUrl('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Veuillez saisir un email valide.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Impossible de traiter la demande.');
        return;
      }

      setSuccess('Si votre email existe, un lien de réinitialisation a été généré.');
      if (typeof data?.resetUrl === 'string') {
        setDevResetUrl(data.resetUrl);
      }
    } catch {
      setError('Impossible de traiter la demande pour le moment.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-slate-800 dark:border-slate-700 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mot de passe oublié</h1>
        <p className="text-sm text-slate-500 mt-1">Entrez votre email pour réinitialiser votre mot de passe.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="pl-10"
                required
              />
            </div>
          </div>

          <FormGlobalError message={error} />

          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {devResetUrl && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 break-all">
              Dev link: <a className="underline" href={devResetUrl}>{devResetUrl}</a>
            </p>
          )}

          <Button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Envoyer le lien
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
