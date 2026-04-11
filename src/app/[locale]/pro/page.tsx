import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Link } from '@/i18n/routing';
import { Building2, Store, Truck, ArrowRight } from 'lucide-react';

const PRO_ROLES = [
  {
    title: 'Enseigne',
    description: 'Gestion e-commerce, imports bulk et pilotage des expeditions.',
    href: '/become-enseigne',
    icon: Building2,
    classes: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  },
  {
    title: 'Transporteur',
    description: 'Missions de collecte/livraison et gestion des tournées.',
    href: '/become-transporter',
    icon: Truck,
    classes: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
  },
  {
    title: 'Point relais',
    description: 'Depot/retrait colis, avec periode d essai terrain de 30 jours avant validation complete.',
    href: '/become-relay',
    icon: Store,
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  },
] as const;

export default function ProEntryPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Espace professionnel</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">Choisissez votre parcours</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Ce choix concerne uniquement les comptes professionnels. Le compte client reste disponible separement.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PRO_ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <Link
                  key={role.title}
                  href={role.href}
                  className={`group rounded-2xl border p-5 transition-colors ${role.classes}`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6" />
                    <ArrowRight className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold">{role.title}</h2>
                  <p className="mt-1 text-sm opacity-90">{role.description}</p>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Retour a l'inscription client
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
