'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import {
  Mail,
  User,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormGlobalError } from '@/components/ui/form-error';

const SUBJECTS = [
  'Question générale',
  'Problème avec une livraison',
  'Signalement d\'un transporteur',
  'Demande de remboursement',
  'Partenariat',
  'Autre',
];

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setIsLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || 'Impossible d\'envoyer le message.');
        return;
      }

      setSuccess(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setError('Une erreur est survenue. Réessayez plus tard.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Contactez-nous</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Une question, un problème ? Nous vous répondons sous 24&nbsp;h.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm p-8">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Message envoyé !
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                Merci pour votre message. Nous vous répondrons à l&apos;adresse indiquée dans les plus
                brefs délais.
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => setSuccess(false)}
              >
                Envoyer un autre message
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              {/* Nom */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Votre nom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    value={form.name}
                    onChange={set('name')}
                    className="pl-10"
                    placeholder="Jean Dupont"
                    required
                    minLength={2}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Adresse email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    className="pl-10"
                    placeholder="jean@exemple.com"
                    required
                  />
                </div>
              </div>

              {/* Sujet */}
              <div className="space-y-1.5">
                <Label htmlFor="subject">Sujet</Label>
                <select
                  id="subject"
                  value={form.subject}
                  onChange={set('subject')}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="">Sélectionnez un sujet…</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="message">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </span>
                </Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={set('message')}
                  placeholder="Décrivez votre demande en détail…"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={6}
                />
                <p className="text-xs text-slate-400 text-right">{form.message.length}/2000</p>
              </div>

              <FormGlobalError message={error} />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Envoyer le message
              </Button>
            </form>
          )}
        </div>

        {/* Info complémentaire */}
        <div className="mt-6 text-center text-sm text-slate-400 dark:text-slate-500">
          Vous pouvez aussi nous écrire directement à{' '}
          <a href="mailto:support@swiftcolis.com" className="underline hover:text-slate-700">
            support@swiftcolis.com
          </a>
        </div>
      </div>
    </div>
  );
}
