import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type DashboardTone = 'admin' | 'client' | 'relais' | 'transporteur' | 'enseigne';

const toneClasses: Record<DashboardTone, {
  shellGlow: string;
  badge: string;
  titleAccent: string;
  heroSurface: string;
  panelSurface: string;
  metricSurface: string;
  metricGlow: string;
  metricIcon: string;
  triggerActive: string;
  focusRing: string;
}> = {
  admin: {
    shellGlow: 'from-emerald-100/70 via-white/78 to-teal-100/75',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300',
    titleAccent: 'from-emerald-600 via-teal-500 to-slate-900',
    heroSurface: 'from-emerald-50 via-white to-teal-50/90',
    panelSurface: 'from-emerald-50/85 via-white to-teal-50/70',
    metricSurface: 'from-emerald-100 via-emerald-50 to-teal-50',
    metricGlow: 'from-emerald-400/45 via-emerald-200/30 to-transparent',
    metricIcon: 'bg-white/80 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-slate-800/80 dark:text-emerald-300 dark:ring-emerald-700/60',
    triggerActive: 'data-[state=active]:from-emerald-100 data-[state=active]:to-white data-[state=active]:text-emerald-950 dark:data-[state=active]:from-emerald-900/50 dark:data-[state=active]:to-slate-900 dark:data-[state=active]:text-emerald-200',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
  },
  client: {
    shellGlow: 'from-sky-200/70 via-white/75 to-cyan-100/80',
    badge: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-900/30 dark:text-sky-300',
    titleAccent: 'from-sky-500 via-cyan-500 to-slate-900',
    heroSurface: 'from-sky-50 via-white to-cyan-50/90',
    panelSurface: 'from-sky-50/85 via-white to-cyan-50/70',
    metricSurface: 'from-sky-100 via-sky-50 to-cyan-50',
    metricGlow: 'from-sky-300/35 to-transparent',
    metricIcon: 'bg-white/80 text-sky-700 ring-1 ring-sky-200/80 dark:bg-slate-800/80 dark:text-sky-300 dark:ring-sky-700/60',
    triggerActive: 'data-[state=active]:from-sky-100 data-[state=active]:to-white data-[state=active]:text-sky-950 dark:data-[state=active]:from-sky-900/50 dark:data-[state=active]:to-slate-900 dark:data-[state=active]:text-sky-200',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1',
  },
  relais: {
    shellGlow: 'from-emerald-200/75 via-white/75 to-lime-100/80',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300',
    titleAccent: 'from-emerald-500 via-lime-500 to-slate-900',
    heroSurface: 'from-emerald-50 via-white to-lime-50/90',
    panelSurface: 'from-emerald-50/85 via-white to-lime-50/70',
    metricSurface: 'from-emerald-100 via-emerald-50 to-lime-50',
    metricGlow: 'from-emerald-300/35 to-transparent',
    metricIcon: 'bg-white/80 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-slate-800/80 dark:text-emerald-300 dark:ring-emerald-700/60',
    triggerActive: 'data-[state=active]:from-emerald-100 data-[state=active]:to-white data-[state=active]:text-emerald-950 dark:data-[state=active]:from-emerald-900/50 dark:data-[state=active]:to-slate-900 dark:data-[state=active]:text-emerald-200',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
  },
  transporteur: {
    shellGlow: 'from-cyan-200/70 via-white/75 to-teal-100/80',
    badge: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800/60 dark:bg-cyan-900/30 dark:text-cyan-300',
    titleAccent: 'from-cyan-500 via-teal-500 to-slate-900',
    heroSurface: 'from-cyan-50 via-white to-teal-50/90',
    panelSurface: 'from-cyan-50/85 via-white to-teal-50/70',
    metricSurface: 'from-cyan-100 via-cyan-50 to-teal-50',
    metricGlow: 'from-cyan-300/35 to-transparent',
    metricIcon: 'bg-white/80 text-cyan-700 ring-1 ring-cyan-200/80 dark:bg-slate-800/80 dark:text-cyan-300 dark:ring-cyan-700/60',
    triggerActive: 'data-[state=active]:from-cyan-100 data-[state=active]:to-white data-[state=active]:text-cyan-950 dark:data-[state=active]:from-cyan-900/50 dark:data-[state=active]:to-slate-900 dark:data-[state=active]:text-cyan-200',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1',
  },
  enseigne: {
    shellGlow: 'from-indigo-200/70 via-white/78 to-blue-100/80',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-900/30 dark:text-indigo-300',
    titleAccent: 'from-indigo-600 via-blue-500 to-slate-900',
    heroSurface: 'from-indigo-50 via-white to-blue-50/90',
    panelSurface: 'from-indigo-50/85 via-white to-blue-50/70',
    metricSurface: 'from-indigo-100 via-indigo-50 to-blue-50',
    metricGlow: 'from-indigo-300/35 to-transparent',
    metricIcon: 'bg-white/80 text-indigo-700 ring-1 ring-indigo-200/80 dark:bg-slate-800/80 dark:text-indigo-300 dark:ring-indigo-700/60',
    triggerActive: 'data-[state=active]:from-indigo-100 data-[state=active]:to-white data-[state=active]:text-indigo-950 dark:data-[state=active]:from-indigo-900/50 dark:data-[state=active]:to-slate-900 dark:data-[state=active]:text-indigo-200',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
  },
};

export const dashboardTabsListClass =
  'mb-8 h-auto w-full rounded-[1.15rem] border border-white/75 bg-white/86 p-1.5 sm:p-2 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5 backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/65 dark:ring-white/10';

export const dashboardTabsContentClass =
  'mt-2 space-y-5 rounded-[1.2rem] border border-white/75 bg-white/72 p-3 shadow-[0_20px_56px_-42px_rgba(15,23,42,0.42)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:mt-3 sm:p-4 lg:p-5 dark:border-white/10 dark:bg-slate-950/52 dark:ring-white/10';

export const dashboardMetaBadgeClass =
  'border-slate-200/80 bg-white/92 text-slate-800 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.35)] dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-slate-100';

export const dashboardMetaBadgeInteractiveClass =
  'border-slate-200/80 bg-white/92 text-slate-800 shadow-[0_8px_22px_-16px_rgba(15,23,42,0.35)] hover:border-sky-300/80 hover:text-sky-700 dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-slate-100 dark:hover:text-sky-300';

export function getDashboardTabsTriggerClass(tone: DashboardTone) {
  return cn(
    'min-h-10 rounded-[0.9rem] border border-transparent bg-transparent px-2.5 py-2 text-[11px] font-semibold sm:min-h-11 sm:px-3 sm:text-sm text-slate-700 shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white data-[state=active]:border-white/80 data-[state=active]:bg-gradient-to-br data-[state=active]:shadow-[0_14px_28px_-16px_rgba(15,23,42,0.45)]',
    toneClasses[tone].triggerActive,
    toneClasses[tone].focusRing,
  );
}

export function DashboardShell({
  tone,
  className,
  children,
}: {
  tone: DashboardTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-[2.15rem] border border-white/65 bg-gradient-to-br p-5 shadow-[0_42px_120px_-58px_rgba(15,23,42,0.5)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:p-7 lg:p-9 dark:border-white/10 dark:bg-slate-950/72 dark:ring-white/10',
        toneClasses[tone].shellGlow,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white/60 blur-3xl dark:bg-white/10" />
        <div className="absolute right-0 top-20 h-56 w-56 rounded-full bg-white/40 blur-3xl dark:bg-white/10" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-slate-900/5 blur-3xl dark:bg-slate-100/5" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:34px_34px] opacity-60 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)]" />
      </div>
      <div className="relative z-10 space-y-12">{children}</div>
    </section>
  );
}

export function DashboardHero({
  tone,
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  tone: DashboardTone;
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cn('grid gap-7 rounded-[1.85rem] border border-white/70 bg-gradient-to-br p-7 shadow-[0_30px_90px_-52px_rgba(15,23,42,0.42)] ring-1 ring-slate-900/5 backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_auto] dark:border-white/10 dark:bg-slate-950/68 dark:ring-white/10', toneClasses[tone].heroSurface)}>
      <div className="space-y-5">
        <div className={cn('inline-flex w-fit items-center rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em]', toneClasses[tone].badge)}>
          {eyebrow}
        </div>
        <div className="space-y-3">
          <h1 className={cn('bg-gradient-to-r bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl lg:text-[2.7rem] lg:leading-[1.05]', toneClasses[tone].titleAccent)}>
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7 dark:text-slate-300">
            {description}
          </p>
        </div>
        {meta ? <div className="flex flex-wrap items-center gap-2.5">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-start justify-start gap-3.5 lg:justify-end">{actions}</div> : null}
    </div>
  );
}

export function DashboardStatsGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('grid gap-5 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

export function DashboardMetricCard({
  tone,
  label,
  value,
  icon,
  detail,
  className,
}: {
  tone: DashboardTone;
  label: string;
  value: ReactNode;
  icon: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-[1.35rem] border border-white/70 bg-gradient-to-br p-5 shadow-[0_24px_66px_-44px_rgba(15,23,42,0.52)] ring-1 ring-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72 dark:ring-white/10', toneClasses[tone].metricSurface, className)}>
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', toneClasses[tone].metricGlow)} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-300">{label}</p>
          <div className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</div>
          {detail ? <div className="text-xs text-slate-700/90 dark:text-slate-300">{detail}</div> : null}
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm', toneClasses[tone].metricIcon)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function DashboardPanel({
  tone,
  children,
  className,
}: {
  tone: DashboardTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[1.55rem] border border-white/70 bg-gradient-to-br p-4 shadow-[0_30px_86px_-52px_rgba(15,23,42,0.5)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:p-6 dark:border-white/10 dark:bg-slate-950/68 dark:ring-white/10', toneClasses[tone as DashboardTone]?.panelSurface, className)}>
      {children}
    </div>
  );
}

export function DashboardSection({
  tone,
  eyebrow,
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  tone: DashboardTone;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="space-y-1.5 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">{eyebrow}</p>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {description ? <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      <div className={cn('rounded-[1.45rem] border border-white/70 bg-white/70 p-4 shadow-[0_22px_66px_-42px_rgba(15,23,42,0.4)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:p-5 dark:border-white/10 dark:bg-slate-950/55 dark:ring-white/10', contentClassName, toneClasses[tone].focusRing)}>
        {children}
      </div>
    </section>
  );
}

export function DashboardLoadingState({
  tone,
  title = 'Chargement du dashboard',
  description = 'Préparation des données et des indicateurs...',
}: {
  tone: DashboardTone;
  title?: string;
  description?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <DashboardShell tone={tone} className="mx-auto">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/75 px-6 py-14 text-center shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
            <div className="mx-auto mb-5 h-10 w-10 rounded-full border-2 border-slate-300 border-t-transparent animate-spin dark:border-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
          </div>
        </DashboardShell>
      </div>
    </div>
  );
}

export function DashboardSectionLoading({
  label = 'Chargement...',
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin dark:border-slate-700" />
      <p className="text-sm text-slate-500 dark:text-slate-300">{label}</p>
    </div>
  );
}

export function DashboardEmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      {icon ? <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{description}</p> : null}
    </div>
  );
}