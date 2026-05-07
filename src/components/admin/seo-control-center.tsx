'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, CheckCircle, FileSearch, Globe, LineChart, Loader2, Search, Sparkles, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STORAGE_KEY = 'swiftcolis-admin-seo-v1';

type SeoMainParams = {
  siteTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  robotsDirective: string;
};

const defaultSeoMain: SeoMainParams = {
  siteTitle: 'Livraison de colis en Algerie | SwiftColis',
  metaDescription:
    'SwiftColis simplifie la livraison de colis en Algerie avec un reseau de transporteurs, relais et suivi en temps reel.',
  canonicalUrl: 'https://kimmicolis.vercel.app/fr',
  robotsDirective: 'index, follow, max-image-preview:large',
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type KeywordStatus = 'Prioritaire' | 'A surveiller' | 'Stable';

type KeywordRow = {
  id: string;
  keyword: string;
  targetPage: string;
  currentPosition: number;
  targetPosition: number;
  monthlyVolume: number;
  status: KeywordStatus;
};

type SeoPageRow = {
  id: string;
  pageName: string;
  route: string;
  title: string;
  description: string;
  focusKeyword: string;
  notes: string;
};

type SeoDraft = {
  seoNotes: string;
  keywords: KeywordRow[];
  pages: SeoPageRow[];
};

const defaultDraft: SeoDraft = {
  seoNotes:
    'Brancher Google Search Console pour remplacer les positions saisies manuellement par des donnees reelles.',
  keywords: [
    {
      id: 'kw-home-1',
      keyword: 'livraison colis Algerie',
      targetPage: '/fr',
      currentPosition: 18,
      targetPosition: 5,
      monthlyVolume: 900,
      status: 'Prioritaire',
    },
    {
      id: 'kw-home-2',
      keyword: 'transport colis Alger',
      targetPage: '/fr',
      currentPosition: 11,
      targetPosition: 3,
      monthlyVolume: 450,
      status: 'Prioritaire',
    },
    {
      id: 'kw-home-3',
      keyword: 'point relais Algerie',
      targetPage: '/fr',
      currentPosition: 7,
      targetPosition: 3,
      monthlyVolume: 320,
      status: 'A surveiller',
    },
  ],
  pages: [
    {
      id: 'page-home',
      pageName: 'Accueil FR',
      route: '/fr',
      title: 'Livraison de colis en Algerie | SwiftColis',
      description:
        'Plateforme de livraison de colis en Algerie avec suivi, reseau de relais et transporteurs verifies.',
      focusKeyword: 'livraison colis Algerie',
      notes: 'Priorite absolue: creer une vraie metadata App Router et une version Open Graph.',
    },
    {
      id: 'page-register',
      pageName: 'Inscription client',
      route: '/fr/auth/register',
      title: 'Creer un compte SwiftColis',
      description:
        'Inscrivez-vous pour expedier, suivre et recevoir vos colis avec SwiftColis.',
      focusKeyword: 'compte livraison colis',
      notes: 'Optimiser pour la conversion plus que pour le volume SEO pur.',
    },
  ],
};

const technicalAudit = [
  {
    title: 'Metadata App Router',
    value: 'En place',
    tone: 'default' as const,
    detail: 'Metadata globale et generateMetadata locale sont actives sur l app.',
  },
  {
    title: 'Balises sociales',
    value: 'En place',
    tone: 'default' as const,
    detail: 'Open Graph et Twitter Card sont configurees dans les metadata Next.js.',
  },
  {
    title: 'robots.txt',
    value: 'Present',
    tone: 'default' as const,
    detail: 'Le fichier reference le sitemap et bloque les routes privees.',
  },
  {
    title: 'Sitemap XML',
    value: 'Actif',
    tone: 'default' as const,
    detail: 'Route sitemap.ts active avec priorites et frequences par type de page.',
  },
  {
    title: 'Locales indexables',
    value: 'fr, ar, en, es',
    tone: 'outline' as const,
    detail: 'Le routage next-intl expose 4 locales, a cadrer avec des alternates hreflang.',
  },
  {
    title: 'Source classement',
    value: 'Manuelle',
    tone: 'outline' as const,
    detail: 'Les positions doivent etre alimentees depuis Search Console, Ahrefs ou Semrush.',
  },
];

const actionBacklog = [
  'Publier 2 nouvelles pages locales par mois pour couvrir les villes prioritaires.',
  'Optimiser le CTR des pages qui ont > 500 impressions et CTR < 2%.',
  'Mettre a jour les FAQ des pages locales avec les questions clients recurrentes.',
  'Obtenir des backlinks locaux (partenaires, annuaires pros, presse regionale).',
  'Connecter Search Console API pour automatiser les positions et clics hebdomadaires.',
];

const monitoringPlan = [
  {
    period: 'Chaque lundi',
    action: 'Exporter Search Console: clics, impressions, CTR, position moyenne.',
    owner: 'Marketing',
    kpi: '100% des pages cibles mises a jour dans le cockpit',
  },
  {
    period: 'Chaque mardi',
    action: 'Reecrire les titres/descriptions des pages en dessous de 2% CTR.',
    owner: 'Content',
    kpi: 'CTR moyen des pages prioritaires > 3.5%',
  },
  {
    period: 'Chaque mercredi',
    action: 'Publier ou enrichir 1 page locale (ville ou service).',
    owner: 'SEO',
    kpi: '4 nouvelles pages qualifiees par mois',
  },
  {
    period: 'Chaque vendredi',
    action: 'Suivre les positions des 20 mots-cles prioritaires.',
    owner: 'Growth',
    kpi: 'Au moins 8 mots-cles dans le Top 10',
  },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function getLengthBadge(length: number, type: 'title' | 'description') {
  if (type === 'title') {
    if (length >= 50 && length <= 60) return { label: `${length} caracteres`, className: 'bg-emerald-100 text-emerald-800' };
    if (length >= 40 && length <= 70) return { label: `${length} caracteres`, className: 'bg-amber-100 text-amber-800' };
    return { label: `${length} caracteres`, className: 'bg-red-100 text-red-800' };
  }

  if (length >= 140 && length <= 160) return { label: `${length} caracteres`, className: 'bg-emerald-100 text-emerald-800' };
  if (length >= 120 && length <= 175) return { label: `${length} caracteres`, className: 'bg-amber-100 text-amber-800' };
  return { label: `${length} caracteres`, className: 'bg-red-100 text-red-800' };
}

function getStatusBadgeClass(status: KeywordStatus) {
  if (status === 'Prioritaire') return 'bg-red-100 text-red-800';
  if (status === 'A surveiller') return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

export function SeoControlCenter({ locale }: { locale: string }) {
  const [draft, setDraft] = useState<SeoDraft>(defaultDraft);
  const [isHydrated, setIsHydrated] = useState(false);

  // Paramètres SEO principaux — chargés depuis l'API
  const [seoMain, setSeoMain] = useState<SeoMainParams>(defaultSeoMain);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Chargement initial depuis l'API
  useEffect(() => {
    fetch('/api/admin/seo-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { title?: string; description?: string; canonical?: string; robots?: string } | null) => {
        if (data && data.title) {
          setSeoMain({
            siteTitle: data.title,
            metaDescription: data.description ?? defaultSeoMain.metaDescription,
            canonicalUrl: data.canonical ?? defaultSeoMain.canonicalUrl,
            robotsDirective: data.robots ?? defaultSeoMain.robotsDirective,
          });
        }
      })
      .catch(() => {/* silently use defaults */});
  }, []);

  // Enregistrer les paramètres SEO principaux vers l'API
  async function handleSaveSeoMain() {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/seo-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: seoMain.siteTitle,
          description: seoMain.metaDescription,
          canonical: seoMain.canonicalUrl,
          robots: seoMain.robotsDirective,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(payload.error ?? 'Erreur lors de l\'enregistrement');
        setSaveStatus('error');
        return;
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveError('Erreur réseau. Réessayez.');
      setSaveStatus('error');
    }
  }

  // localStorage pour mots-clés / pages / notes
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SeoDraft>;
        setDraft({
          ...defaultDraft,
          ...parsed,
          keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 ? parsed.keywords : defaultDraft.keywords,
          pages: Array.isArray(parsed.pages) && parsed.pages.length > 0 ? parsed.pages : defaultDraft.pages,
        });
      }
    } catch {
      setDraft(defaultDraft);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, isHydrated]);

  const trackedKeywords = draft.keywords.length;
  const top3Count = draft.keywords.filter((item) => item.currentPosition > 0 && item.currentPosition <= 3).length;
  const top10Count = draft.keywords.filter((item) => item.currentPosition > 0 && item.currentPosition <= 10).length;
  const priorityCount = draft.keywords.filter((item) => item.status === 'Prioritaire').length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-6 sm:space-y-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-cyan-50 p-4 shadow-sm sm:rounded-3xl sm:p-8">
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline" className="border-emerald-200 bg-white/80 text-emerald-700">Admin SEO</Badge>
              <Button asChild variant="outline" size="sm" className="shrink-0 bg-white/85 sm:hidden">
                <Link href={`/${locale}/dashboard/admin`}>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Retour</span>
                </Link>
              </Button>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Cockpit referencement</h1>
              <p className="text-sm leading-6 text-slate-600">
                Centralisez les mots-cles, les titres, les meta descriptions et les priorites techniques.
              </p>
            </div>
            <div className="hidden flex-wrap gap-2 text-sm text-slate-600 sm:flex">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm"><Search className="h-4 w-4 text-emerald-600" />Positions mots-cles</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm"><FileSearch className="h-4 w-4 text-cyan-600" />Titres et descriptions</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm"><Globe className="h-4 w-4 text-sky-600" />Audit technique</span>
            </div>
          </div>
          <div className="hidden flex-col gap-3 sm:flex sm:min-w-64 lg:flex">
            <Button asChild variant="outline" className="justify-start bg-white/85">
              <Link href={`/${locale}/dashboard/admin`}>
                <ArrowLeft className="h-4 w-4" />
                Retour au dashboard admin
              </Link>
            </Button>
            <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Note</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Les positions affichees ici sont pilotables manuellement tant qu&apos;une integration Search Console n&apos;est pas en place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardDescription>Mots-cles suivis</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl"><Target className="h-5 w-5 text-emerald-600 sm:h-6 sm:w-6" />{trackedKeywords}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardDescription>Top 3</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl"><Sparkles className="h-5 w-5 text-amber-500 sm:h-6 sm:w-6" />{top3Count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardDescription>Top 10</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl"><LineChart className="h-5 w-5 text-cyan-600 sm:h-6 sm:w-6" />{top10Count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardDescription>Mots-cles prioritaires</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl"><BarChart3 className="h-5 w-5 text-red-500 sm:h-6 sm:w-6" />{priorityCount}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Parametres SEO principaux</CardTitle>
            <CardDescription>Titre cible, description, canonical et directives d&apos;indexation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="siteTitle">Titre principal</Label>
              <Input id="siteTitle" value={seoMain.siteTitle} onChange={(event) => setSeoMain((current) => ({ ...current, siteTitle: event.target.value }))} />
              <Badge className={getLengthBadge(seoMain.siteTitle.length, 'title').className}>{getLengthBadge(seoMain.siteTitle.length, 'title').label}</Badge>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="metaDescription">Meta description</Label>
              <Textarea id="metaDescription" value={seoMain.metaDescription} onChange={(event) => setSeoMain((current) => ({ ...current, metaDescription: event.target.value }))} className="min-h-28" />
              <Badge className={getLengthBadge(seoMain.metaDescription.length, 'description').className}>{getLengthBadge(seoMain.metaDescription.length, 'description').label}</Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="canonicalUrl">URL canonique</Label>
              <Input id="canonicalUrl" value={seoMain.canonicalUrl} onChange={(event) => setSeoMain((current) => ({ ...current, canonicalUrl: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="robotsDirective">Directive robots</Label>
              <Input id="robotsDirective" value={seoMain.robotsDirective} onChange={(event) => setSeoMain((current) => ({ ...current, robotsDirective: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="seoNotes">Notes de pilotage</Label>
              <Textarea id="seoNotes" value={draft.seoNotes} onChange={(event) => setDraft((current) => ({ ...current, seoNotes: event.target.value }))} className="min-h-24" />
            </div>
          </CardContent>
          {/* Footer visible sur ≥ sm */}
          <CardFooter className="hidden flex-col items-stretch gap-3 border-t pt-5 sm:flex sm:flex-row sm:items-center">
            <Button
              onClick={handleSaveSeoMain}
              disabled={saveStatus === 'saving'}
              className="w-full sm:w-auto sm:min-w-44"
            >
              {saveStatus === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saveStatus === 'saved' && <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />}
              {saveStatus === 'saving' ? 'Enregistrement…' : saveStatus === 'saved' ? 'Enregistre !' : 'Enregistrer'}
            </Button>
            {saveStatus === 'error' && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
            {saveStatus === 'saved' && (
              <p className="text-sm text-emerald-700">Parametres SEO sauvegardes en base avec succes.</p>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit technique actuel</CardTitle>
            <CardDescription>Constats immediats issus de l&apos;etat du code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {technicalAudit.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <Badge variant={item.tone}>{item.value}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Suivi des mots-cles</CardTitle>
            <CardDescription>Classement, page cible et objectif de positionnement.</CardDescription>
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                keywords: [
                  ...current.keywords,
                  {
                    id: createId('kw'),
                    keyword: '',
                    targetPage: '/fr',
                    currentPosition: 0,
                    targetPosition: 3,
                    monthlyVolume: 0,
                    status: 'A surveiller',
                  },
                ],
              }))
            }
          >
            Ajouter un mot-cle
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-hidden">
          {draft.keywords.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[1.3fr_0.9fr_repeat(4,minmax(0,0.6fr))]">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 lg:hidden">Mot-cle</Label>
                <Input value={item.keyword} onChange={(event) => setDraft((current) => ({ ...current, keywords: current.keywords.map((row) => row.id === item.id ? { ...row, keyword: event.target.value } : row) }))} placeholder="Mot-cle" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 lg:hidden">Page cible</Label>
                <Input value={item.targetPage} onChange={(event) => setDraft((current) => ({ ...current, keywords: current.keywords.map((row) => row.id === item.id ? { ...row, targetPage: event.target.value } : row) }))} placeholder="Page cible" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 lg:hidden">Position</Label>
                <Input type="number" value={item.currentPosition} onChange={(event) => setDraft((current) => ({ ...current, keywords: current.keywords.map((row) => row.id === item.id ? { ...row, currentPosition: Number(event.target.value) || 0 } : row) }))} placeholder="Position" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 lg:hidden">Objectif</Label>
                <Input type="number" value={item.targetPosition} onChange={(event) => setDraft((current) => ({ ...current, keywords: current.keywords.map((row) => row.id === item.id ? { ...row, targetPosition: Number(event.target.value) || 0 } : row) }))} placeholder="Objectif" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 lg:hidden">Volume</Label>
                <Input type="number" value={item.monthlyVolume} onChange={(event) => setDraft((current) => ({ ...current, keywords: current.keywords.map((row) => row.id === item.id ? { ...row, monthlyVolume: Number(event.target.value) || 0 } : row) }))} placeholder="Volume" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                <Badge className={getStatusBadgeClass(item.status)}>{item.status}</Badge>
                <button
                  type="button"
                  className="text-xs font-medium text-slate-500 transition hover:text-red-600"
                  onClick={() => setDraft((current) => ({ ...current, keywords: current.keywords.filter((row) => row.id !== item.id) }))}
                >
                  Supprimer
                </button>
              </div>
              <div className="flex flex-wrap gap-2 lg:col-span-full">
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setDraft((current) => ({ ...current, keywords: current.keywords.map((row) => row.id === item.id ? { ...row, status: 'Prioritaire' } : row) }))}>Prioritaire</Button>
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setDraft((current) => ({ ...current, keywords: current.keywords.map((row) => row.id === item.id ? { ...row, status: 'A surveiller' } : row) }))}>A surveiller</Button>
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setDraft((current) => ({ ...current, keywords: current.keywords.map((row) => row.id === item.id ? { ...row, status: 'Stable' } : row) }))}>Stable</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Titres et descriptions par page</CardTitle>
            <CardDescription>Zone de cadrage editorial avant implementation dans le code.</CardDescription>
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                pages: [
                  ...current.pages,
                  {
                    id: createId('page'),
                    pageName: 'Nouvelle page',
                    route: '/fr',
                    title: '',
                    description: '',
                    focusKeyword: '',
                    notes: '',
                  },
                ],
              }))
            }
          >
            Ajouter une page
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.pages.map((page) => {
            const titleBadge = getLengthBadge(page.title.length, 'title');
            const descriptionBadge = getLengthBadge(page.description.length, 'description');

            return (
              <div key={page.id} className="rounded-2xl border border-slate-200 p-4 sm:rounded-3xl sm:p-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Nom de page</Label>
                    <Input value={page.pageName} onChange={(event) => setDraft((current) => ({ ...current, pages: current.pages.map((row) => row.id === page.id ? { ...row, pageName: event.target.value } : row) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Route</Label>
                    <Input value={page.route} onChange={(event) => setDraft((current) => ({ ...current, pages: current.pages.map((row) => row.id === page.id ? { ...row, route: event.target.value } : row) }))} />
                  </div>
                  <div className="space-y-2 xl:col-span-2">
                    <Label>Mot-cle principal</Label>
                    <Input value={page.focusKeyword} onChange={(event) => setDraft((current) => ({ ...current, pages: current.pages.map((row) => row.id === page.id ? { ...row, focusKeyword: event.target.value } : row) }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2 xl:col-span-4">
                    <Label>Titre SEO</Label>
                    <Input value={page.title} onChange={(event) => setDraft((current) => ({ ...current, pages: current.pages.map((row) => row.id === page.id ? { ...row, title: event.target.value } : row) }))} />
                    <Badge className={titleBadge.className}>{titleBadge.label}</Badge>
                  </div>
                  <div className="space-y-2 md:col-span-2 xl:col-span-4">
                    <Label>Description SEO</Label>
                    <Textarea value={page.description} onChange={(event) => setDraft((current) => ({ ...current, pages: current.pages.map((row) => row.id === page.id ? { ...row, description: event.target.value } : row) }))} className="min-h-24" />
                    <Badge className={descriptionBadge.className}>{descriptionBadge.label}</Badge>
                  </div>
                  <div className="space-y-2 md:col-span-2 xl:col-span-4">
                    <Label>Notes</Label>
                    <Textarea value={page.notes} onChange={(event) => setDraft((current) => ({ ...current, pages: current.pages.map((row) => row.id === page.id ? { ...row, notes: event.target.value } : row) }))} className="min-h-20" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">Route cible: {page.route || 'a definir'}</p>
                  <button
                    type="button"
                    className="text-sm font-medium text-slate-500 transition hover:text-red-600"
                    onClick={() => setDraft((current) => ({ ...current, pages: current.pages.filter((row) => row.id !== page.id) }))}
                  >
                    Supprimer cette page
                  </button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backlog prioritaire SEO</CardTitle>
          <CardDescription>Ordre de travail recommande pour faire remonter la visibilite organique.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {actionBacklog.map((item, index) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">{index + 1}</div>
              <p className="text-sm leading-6 text-slate-700">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan de suivi CTR et positions</CardTitle>
          <CardDescription>Rituel hebdomadaire pour transformer les donnees SEO en actions concretes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {monitoringPlan.map((row) => (
            <div key={row.period} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{row.period}</p>
                <Badge variant="outline">Owner: {row.owner}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{row.action}</p>
              <p className="mt-2 text-xs font-medium text-emerald-700">KPI: {row.kpi}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sticky save bar — mobile only */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:hidden">
        <Button
          onClick={handleSaveSeoMain}
          disabled={saveStatus === 'saving'}
          className="w-full"
        >
          {saveStatus === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saveStatus === 'saved' && <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />}
          {saveStatus === 'saving' ? 'Enregistrement…' : saveStatus === 'saved' ? 'Enregistre !' : 'Enregistrer les parametres SEO'}
        </Button>
        {saveStatus === 'error' && (
          <p className="mt-2 text-center text-xs text-red-600">{saveError}</p>
        )}
      </div>
      {/* Espace pour compenser la sticky bar sur mobile */}
      <div className="h-20 sm:hidden" aria-hidden="true" />
    </div>
  );
}