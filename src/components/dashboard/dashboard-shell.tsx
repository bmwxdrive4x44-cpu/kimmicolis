import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type DashboardTone = 'admin' | 'client' | 'relais' | 'transporteur';

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
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    titleAccent: 'from-emerald-600 via-teal-500 to-slate-900',
    heroSurface: 'from-emerald-50 via-white to-teal-50/90',
    panelSurface: 'from-emerald-50/85 via-white to-teal-50/70',
    metricSurface: 'from-emerald-100 via-emerald-50 to-teal-50',
    metricGlow: 'from-emerald-400/45 via-emerald-200/30 to-transparent',
    metricIcon: 'bg-white/80 text-emerald-700 ring-1 ring-emerald-200/80',
    triggerActive: 'data-[state=active]:from-emerald-100 data-[state=active]:to-white data-[state=active]:text-emerald-950',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
  },
  client: {
    shellGlow: 'from-sky-200/70 via-white/75 to-cyan-100/80',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    titleAccent: 'from-sky-500 via-cyan-500 to-slate-900',
    heroSurface: 'from-sky-50 via-white to-cyan-50/90',
    panelSurface: 'from-sky-50/85 via-white to-cyan-50/70',
    metricSurface: 'from-sky-100 via-sky-50 to-cyan-50',
    metricGlow: 'from-sky-300/35 to-transparent',
    metricIcon: 'bg-white/80 text-sky-700 ring-1 ring-sky-200/80',
    triggerActive: 'data-[state=active]:from-sky-100 data-[state=active]:to-white data-[state=active]:text-sky-950',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1',
  },
  relais: {
    shellGlow: 'from-emerald-200/75 via-white/75 to-lime-100/80',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    titleAccent: 'from-emerald-500 via-lime-500 to-slate-900',
    heroSurface: 'from-emerald-50 via-white to-lime-50/90',
    panelSurface: 'from-emerald-50/85 via-white to-lime-50/70',
    metricSurface: 'from-emerald-100 via-emerald-50 to-lime-50',
    metricGlow: 'from-emerald-300/35 to-transparent',
    metricIcon: 'bg-white/80 text-emerald-700 ring-1 ring-emerald-200/80',
    triggerActive: 'data-[state=active]:from-emerald-100 data-[state=active]:to-white data-[state=active]:text-emerald-950',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
  },
  transporteur: {
    shellGlow: 'from-cyan-200/70 via-white/75 to-teal-100/80',
    badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    titleAccent: 'from-cyan-500 via-teal-500 to-slate-900',
    heroSurface: 'from-cyan-50 via-white to-teal-50/90',
    panelSurface: 'from-cyan-50/85 via-white to-teal-50/70',
    metricSurface: 'from-cyan-100 via-cyan-50 to-teal-50',
    metricGlow: 'from-cyan-300/35 to-transparent',
    metricIcon: 'bg-white/80 text-cyan-700 ring-1 ring-cyan-200/80',
    triggerActive: 'data-[state=active]:from-cyan-100 data-[state=active]:to-white data-[state=active]:text-cyan-950',
    focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1',
  },
};

export const dashboardTabsListClass =
  'mb-8 h-auto w-full rounded-[1.75rem] border border-white/60 bg-white/70 p-1.5 sm:p-2 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] backdrop-blur-xl';

export function getDashboardTabsTriggerClass(tone: DashboardTone) {
  return cn(
    'min-h-10 rounded-[0.95rem] border border-transparent bg-transparent px-2.5 py-2 text-xs sm:min-h-11 sm:px-3 sm:text-sm text-slate-700 shadow-none transition-all duration-200 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white data-[state=active]:border-white/80 data-[state=active]:bg-gradient-to-br data-[state=active]:shadow-[0_14px_30px_-18px_rgba(15,23,42,0.45)]',
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
        'relative isolate overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br p-4 shadow-[0_35px_120px_-50px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6 lg:p-8 dark:border-white/10 dark:bg-slate-950/70',
        toneClasses[tone].shellGlow,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white/60 blur-3xl dark:bg-white/10" />
        <div className="absolute right-0 top-20 h-56 w-56 rounded-full bg-white/40 blur-3xl dark:bg-white/10" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-slate-900/5 blur-3xl dark:bg-slate-100/5" />
      </div>
      <div className="relative z-10 space-y-8">{children}</div>
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
    <div className={cn('grid gap-6 rounded-[1.75rem] border border-white/60 bg-gradient-to-br p-6 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.4)] backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_auto] dark:border-white/10 dark:bg-slate-950/65', toneClasses[tone].heroSurface)}>
      <div className="space-y-4">
        <div className={cn('inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]', toneClasses[tone].badge)}>
          {eyebrow}
        </div>
        <div className="space-y-2">
          <h1 className={cn('bg-gradient-to-r bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl', toneClasses[tone].titleAccent)}>
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-700 sm:text-base dark:text-slate-300">
            {description}
          </p>
        </div>
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-start justify-end gap-3">{actions}</div> : null}
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
  return <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
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
    <div className={cn('relative overflow-hidden rounded-[1.5rem] border border-white/60 bg-gradient-to-br p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70', toneClasses[tone].metricSurface, className)}>
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', toneClasses[tone].metricGlow)} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
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
    <div className={cn('rounded-[1.75rem] border border-white/60 bg-gradient-to-br p-4 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6 dark:border-white/10 dark:bg-slate-950/65', toneClasses[tone as DashboardTone]?.panelSurface, className)}>
      {children}
    </div>
  );
}