import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { Header } from '@/components/layout/header';
import { EnseignePaymentsTab } from '@/components/dashboard/enseigne/enseigne-payments-tab';
import { Footer } from '@/components/layout/footer';
import { Link } from '@/i18n/routing';
import { generateQRCodeImage, buildQRCodePayload } from '@/lib/qrcode';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DashboardHero,
  DashboardMetricCard,
  DashboardPanel,
  DashboardSection,
  DashboardShell,
  DashboardStatsGrid,
  dashboardMetaBadgeClass,
  dashboardTabsContentClass,
  dashboardTabsListClass,
  getDashboardTabsTriggerClass,
} from '@/components/dashboard/dashboard-shell';
import { Package, Truck, CreditCard, CheckCircle, AlertTriangle, Star } from 'lucide-react';
import { EnseigneProfileCard } from '@/components/dashboard/enseigne/enseigne-profile-card';
import { EnseigneCsvImportCard } from '@/components/dashboard/enseigne/enseigne-csv-import-card';
import { EnseigneQuickCreateModal } from '@/components/dashboard/enseigne/enseigne-quick-create-modal';
import { EnseigneTrackingTable } from '@/components/dashboard/enseigne/enseigne-tracking-table';

export default async function EnseigneDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const tabValue = (await searchParams)?.tab;
  const allowedTabs = new Set(['overview', 'tracking', 'payments', 'imports', 'settings']);
  const initialTab = tabValue && allowedTabs.has(tabValue) ? tabValue : 'overview';
  const session = await getServerSession(authOptions);
  const isProClient = (session?.user as { clientType?: string } | undefined)?.clientType === 'PRO';

  if (!session?.user) {
    redirect(`/${locale}/auth/login`);
  }

  if (session.user.role !== 'ENSEIGNE') {
    switch (session.user.role) {
      case 'ADMIN':
        redirect(`/${locale}/dashboard/admin`);
      case 'TRANSPORTER':
        redirect(`/${locale}/dashboard/transporter`);
      case 'RELAIS':
        redirect(`/${locale}/dashboard/relais`);
      case 'CLIENT':
      default:
        redirect(`/${locale}/dashboard/client`);
    }
  }

  const deliveredStatuses = ['LIVRE', 'DELIVERED'];
  const readyForDepositStatuses = ['READY_FOR_DEPOSIT', 'PAID_RELAY', 'PAID'];
  const atRelayDepartureStatuses = ['DEPOSITED_RELAY', 'RECU_RELAIS', 'WAITING_PICKUP', 'ASSIGNED'];
  const inTransportStatuses = ['PICKED_UP', 'EN_TRANSPORT'];

  const [enseigneRows, kpiRows, totalParcels, deliveredParcels, deliveredRevenueAgg, committedRevenueAgg] = await Promise.all([
    db.$queryRaw<Array<{
      id: string;
      userId: string;
      businessName: string;
      legalName: string | null;
      website: string | null;
      logoUrl: string | null;
      monthlyVolume: number;
      billingEmail: string | null;
      operationalCity: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>>`
      SELECT
        "id", "userId", "businessName", "legalName", "website", "logoUrl",
        "monthlyVolume", "billingEmail", "operationalCity", "createdAt", "updatedAt"
      FROM "Enseigne"
      WHERE "userId" = ${session.user.id}
      LIMIT 1
    `,
    db.$queryRaw<Array<{
      enseigneId: string;
      parcelsTotal: number;
      parcelsDelivered: number;
      pendingPayment: number;
      readyForDeposit: number;
      inTransit: number;
      arrivedRelay: number;
      revenueDelivered: number;
      revenueCommitted: number;
    }>>`
      SELECT
        "enseigneId", "parcelsTotal", "parcelsDelivered", "pendingPayment", "readyForDeposit",
        "inTransit", "arrivedRelay", "revenueDelivered", "revenueCommitted"
      FROM "KpiEnseigne"
      WHERE "enseigneId" = ${session.user.id}
      LIMIT 1
    `,
    db.colis.count({ where: { clientId: session.user.id } }),
    db.colis.count({ where: { clientId: session.user.id, status: { in: deliveredStatuses } } }),
    db.colis.aggregate({
      where: {
        clientId: session.user.id,
        status: { in: deliveredStatuses },
      },
      _sum: { prixClient: true },
    }),
    db.colis.aggregate({
      where: {
        clientId: session.user.id,
        status: {
          in: [
            ...readyForDepositStatuses,
            ...atRelayDepartureStatuses,
            ...inTransportStatuses,
            'ARRIVE_RELAIS_DESTINATION',
            ...deliveredStatuses,
          ],
        },
      },
      _sum: { prixClient: true },
    }),
  ]);

  const [
    createdOnlyParcels,
    pendingPaymentParcels,
    readyForDepositParcels,
    depositedRelayParcels,
    inTransportParcels,
    arrivedRelayParcels,
    activeMissions,
    pendingAssignmentParcels,
    recentParcels,
    returnedParcels,
    stuckParcels,
  ] = await Promise.all([
    db.colis.count({ where: { clientId: session.user.id, status: 'CREATED' } }),
    db.colis.count({ where: { clientId: session.user.id, status: 'PENDING_PAYMENT' } }),
    db.colis.count({ where: { clientId: session.user.id, status: { in: readyForDepositStatuses } } }),
    db.colis.count({ where: { clientId: session.user.id, status: { in: atRelayDepartureStatuses } } }),
    db.colis.count({
      where: { clientId: session.user.id, status: { in: inTransportStatuses } },
    }),
    db.colis.count({ where: { clientId: session.user.id, status: 'ARRIVE_RELAIS_DESTINATION' } }),
    db.mission.count({
      where: {
        colis: { clientId: session.user.id },
        status: { in: ['ASSIGNE', 'EN_COURS'] },
      },
    }),
    db.colis.count({
      where: {
        clientId: session.user.id,
        status: { in: atRelayDepartureStatuses },
        missions: {
          none: {
            status: { in: ['ASSIGNE', 'EN_COURS'] },
          },
        },
      },
    }),
    db.colis.findMany({
      where: { clientId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        trackingNumber: true,
        senderFirstName: true,
        senderLastName: true,
        senderPhone: true,
        recipientFirstName: true,
        recipientLastName: true,
        recipientPhone: true,
        villeDepart: true,
        villeArrivee: true,
        weight: true,
        description: true,
        prixClient: true,
        qrCode: true,
        qrCodeImage: true,
        status: true,
        createdAt: true,
        relaisDepart: {
          select: { commerceName: true, address: true, ville: true },
        },
        relaisArrivee: {
          select: { commerceName: true, address: true, ville: true },
        },
      },
    }),
    db.colis.count({ where: { clientId: session.user.id, status: 'RETOUR' } }),
    db.colis.count({
      where: {
        clientId: session.user.id,
        status: { in: ['CREATED', 'PENDING_PAYMENT'] },
        createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const enseigne = enseigneRows[0] ?? null;
  const kpi = kpiRows[0] ?? null;

  const parcelsWithQr = await Promise.all(
    recentParcels.map(async (parcel) => {
      if (parcel.qrCodeImage) {
        return parcel;
      }

      try {
        const fallbackPayload = parcel.qrCode || buildQRCodePayload(parcel.trackingNumber);
        const fallbackImage = await generateQRCodeImage(fallbackPayload);

        // Best effort persistence so subsequent views reuse stored QR images.
        await db.colis.update({
          where: { id: parcel.id },
          data: { qrCodeImage: fallbackImage },
          select: { id: true },
        }).catch(() => undefined);

        return { ...parcel, qrCodeImage: fallbackImage };
      } catch {
        return parcel;
      }
    })
  );

  const totalParcelsKpi = kpi?.parcelsTotal ?? totalParcels;
  const deliveredParcelsKpi = kpi?.parcelsDelivered ?? deliveredParcels;
  const pendingPaymentKpi = kpi?.pendingPayment ?? (createdOnlyParcels + pendingPaymentParcels);
  const readyForDepositKpi = kpi?.readyForDeposit ?? readyForDepositParcels;
  const inTransitKpi = kpi?.inTransit ?? (depositedRelayParcels + inTransportParcels);
  const arrivedRelayKpi = kpi?.arrivedRelay ?? arrivedRelayParcels;
  const deliveredRevenue = kpi?.revenueDelivered ?? (deliveredRevenueAgg._sum.prixClient ?? 0);
  const committedRevenue = kpi?.revenueCommitted ?? (committedRevenueAgg._sum.prixClient ?? 0);

  const deliveryRate = totalParcelsKpi > 0 ? Math.round((deliveredParcelsKpi / totalParcelsKpi) * 100) : 0;

  // PRO score: 0-100 based on delivery success rate with penalty for returns
  const proScore = totalParcelsKpi > 0
    ? Math.max(0, Math.min(100, Math.round(
        (deliveredParcelsKpi / Math.max(totalParcelsKpi, 1)) * 100 - (returnedParcels / Math.max(totalParcelsKpi, 1)) * 20
      )))
    : 100;

  const operationalBacklog = pendingPaymentKpi + readyForDepositKpi;
  const backlogShare = totalParcelsKpi > 0 ? Math.round((operationalBacklog / totalParcelsKpi) * 100) : 0;
  const backlogToneClass =
    operationalBacklog >= 20
      ? 'border-red-300 bg-red-50 text-red-700'
      : operationalBacklog >= 8
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-emerald-300 bg-emerald-50 text-emerald-700';
  const enseigneFocusMessage =
    operationalBacklog >= 20
      ? 'Backlog en hausse - risque de retard sur certaines livraisons.'
      : operationalBacklog >= 8
        ? 'Charge moderee - priorisez paiements puis depots relais.'
        : 'Flux stable aujourd hui - activite normale et maitrisee.';
  const enseigneAutoRead =
    backlogShare >= 35
      ? `${backlogShare}% de votre volume est encore en attente d action immediate.`
      : backlogShare >= 15
        ? `${backlogShare}% du volume est en file active, sous surveillance normale.`
        : `${backlogShare}% du volume seulement en attente - cadence saine.`;

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#f8fafc,_#eef2ff_42%,_#dbeafe_100%)] dark:bg-slate-950">
      <Header />
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <DashboardShell tone="enseigne" className="mx-auto max-w-[92rem]">
          <DashboardHero
            tone="enseigne"
            eyebrow="Operations enseigne"
            title="Tour de controle e-commerce"
            description="Flux enseigne 100% digital: paiement en ligne, depot physique au relais partenaire, puis collecte et transport orchestras par la plateforme."
            meta={
              <>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>
                  {enseigne?.businessName || session.user.name || 'Votre enseigne'}
                </Badge>
                {enseigne?.operationalCity ? (
                  <Badge variant="outline" className={dashboardMetaBadgeClass}>
                    Base: {enseigne.operationalCity}
                  </Badge>
                ) : null}
                <Badge variant="outline" className={dashboardMetaBadgeClass}>
                  Aujourd hui
                </Badge>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>
                  Taux de livraison: {deliveryRate}%
                </Badge>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>
                  CA livre: {Math.round(deliveredRevenue).toLocaleString('fr-DZ')} DA
                </Badge>
                <Badge variant="outline" className={dashboardMetaBadgeClass}>
                  <Star className="h-3 w-3 mr-1 text-amber-500" />
                  Score PRO: {proScore}/100
                </Badge>
              </>
            }
            actions={
              <div className="flex flex-wrap gap-2">
                <EnseigneQuickCreateModal defaultVilleDepart={enseigne?.operationalCity || ''} />
                <Link
                  href="/dashboard/enseigne?tab=imports#enseigne-import-bulk"
                  className="inline-flex items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Importer des colis
                </Link>
                <Link
                  href="/dashboard/enseigne?tab=settings#enseigne-profile"
                  className="inline-flex items-center rounded-xl border border-white/80 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  Configurer le profil
                </Link>
              </div>
            }
          />

          <DashboardSection
            tone="enseigne"
            eyebrow="Priorite"
            title="Focus du jour"
            description="Un indicateur dominant pour piloter vos actions, puis trois lectures secondaires pour arbitrer vite."
          >
            <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
              <article className="rounded-2xl border border-white/85 bg-white p-6 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.48)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Backlog operationnel</p>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-5xl font-black tracking-tight text-slate-950">{operationalBacklog}</p>
                    <p className="mt-1 text-sm text-slate-600">Colis qui demandent une action immediate (paiement ou depot)</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${backlogToneClass}`}>
                    {operationalBacklog >= 20 ? 'A traiter maintenant' : operationalBacklog >= 8 ? 'A surveiller' : 'Sous controle'}
                  </span>
                </div>
                <div className={`mt-4 rounded-xl border px-3 py-2 text-xs font-semibold ${backlogToneClass}`}>
                  <p>{enseigneFocusMessage}</p>
                  <p className="mt-1 font-medium opacity-90">Lecture automatique: {enseigneAutoRead}</p>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/dashboard/enseigne?tab=payments#enseigne-payments"
                    className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Regler les colis
                  </Link>
                  <Link
                    href="/dashboard/enseigne?tab=tracking#enseigne-tracking"
                    className="inline-flex items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    Declencher les depots
                  </Link>
                </div>
              </article>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-indigo-700">Taux livraison</p>
                  <p className="mt-2 text-2xl font-bold text-indigo-900">{deliveryRate}%</p>
                  <p className="text-xs text-indigo-700">{deliveredParcelsKpi} colis livres</p>
                </article>
                <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-sky-700">CA livre</p>
                  <p className="mt-2 text-2xl font-bold text-sky-900">{Math.round(deliveredRevenue).toLocaleString('fr-DZ')} DA</p>
                  <p className="text-xs text-sky-700">Encaisse</p>
                </article>
                <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Score PRO</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900">{proScore}/100</p>
                  <p className="text-xs text-emerald-700">Fiabilite globale</p>
                </article>
              </div>
            </div>
          </DashboardSection>

          {/* ─── Actions urgentes ────────────────────────────────────────────── */}
          {(createdOnlyParcels + pendingPaymentParcels > 0 || readyForDepositParcels > 0 || stuckParcels > 0) && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4">
              <p className="mb-3 text-sm font-bold text-red-700 dark:text-red-400">🔥 Actions urgentes</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {createdOnlyParcels + pendingPaymentParcels > 0 && (
                  <Link
                    href="/dashboard/enseigne?tab=payments#enseigne-payments"
                    className="inline-flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-amber-600">{createdOnlyParcels + pendingPaymentParcels}</span>{' '}
                      colis en attente de paiement
                    </span>
                    <span className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">Payer →</span>
                  </Link>
                )}
                {readyForDepositParcels > 0 && (
                  <Link
                    href="/dashboard/enseigne?tab=tracking#enseigne-tracking"
                    className="inline-flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-950/30"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-violet-600">{readyForDepositParcels}</span>{' '}
                      colis à déposer au relais
                    </span>
                    <span className="rounded-md bg-violet-500 px-2.5 py-1 text-xs font-bold text-white">Voir relais →</span>
                  </Link>
                )}
                {stuckParcels > 0 && (
                  <Link
                    href="/dashboard/enseigne?tab=payments#enseigne-payments"
                    className="inline-flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-red-600">{stuckParcels}</span>{' '}
                      colis bloqués +48h
                    </span>
                    <span className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white">Corriger →</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          <DashboardSection
            tone="enseigne"
            eyebrow="Business"
            title="KPI enseigne"
            description="Indicateurs secondaires pour garder une vue claire sans surcharger l ecran."
          >
            <DashboardStatsGrid className="xl:grid-cols-3">
              <DashboardMetricCard
                tone="enseigne"
                label="Colis total"
                value={totalParcelsKpi}
                icon={<Package className="h-5 w-5" />}
                detail="volume global"
              />
              <DashboardMetricCard
                tone="enseigne"
                label="CA livre"
                value={`${Math.round(deliveredRevenue).toLocaleString('fr-DZ')} DA`}
                icon={<CreditCard className="h-5 w-5" />}
                detail="encaisse sur colis livres"
              />
              <DashboardMetricCard
                tone="enseigne"
                label="CA engage"
                value={`${Math.round(committedRevenue).toLocaleString('fr-DZ')} DA`}
                icon={<Star className="h-5 w-5" />}
                detail={`score PRO ${proScore}/100`}
              />
            </DashboardStatsGrid>
          </DashboardSection>

          <DashboardSection
            tone="enseigne"
            eyebrow="Opérations"
            title="Etats logistiques"
            description="Lecture claire des colis bloqués, à déposer et en transit pour fluidifier le flux quotidien."
          >
            <DashboardStatsGrid>
              <DashboardMetricCard
                tone="enseigne"
                label="Non payes"
                value={pendingPaymentKpi}
                icon={<CreditCard className="h-5 w-5" />}
                detail={`${createdOnlyParcels} crees · ${pendingPaymentParcels} en attente`}
              />
              <DashboardMetricCard
                tone="enseigne"
                label="A deposer au relais"
                value={readyForDepositKpi}
                icon={<Package className="h-5 w-5" />}
                detail="payes, attente depot physique"
              />
              <DashboardMetricCard
                tone="enseigne"
                label="Collecte / transport"
                value={inTransitKpi}
                icon={<Truck className="h-5 w-5" />}
                detail={`${activeMissions} missions actives`}
              />
              <DashboardMetricCard
                tone="enseigne"
                label="Arrives relais dest"
                value={arrivedRelayKpi}
                icon={<CheckCircle className="h-5 w-5" />}
                detail={`${pendingAssignmentParcels} en attente assignation`}
              />
            </DashboardStatsGrid>
          </DashboardSection>

          <DashboardSection
            tone="enseigne"
            eyebrow="Modules"
            title="Cockpit opérationnel"
            description="Accès structuré aux vues suivi, paiements, imports et configuration."
            contentClassName="bg-transparent p-0 border-0 shadow-none ring-0"
          >
            <DashboardPanel tone="enseigne">
              <Tabs key={initialTab} defaultValue={initialTab}>
                <TabsList className={`${dashboardTabsListClass} grid grid-cols-2 lg:grid-cols-5 bg-slate-100/80 p-1 ring-0 shadow-none dark:bg-slate-900/70`}>
                <TabsTrigger value="overview" className={getDashboardTabsTriggerClass('enseigne')}>
                  Vue d ensemble
                </TabsTrigger>
                <TabsTrigger value="tracking" className={getDashboardTabsTriggerClass('enseigne')}>
                  Suivi colis
                </TabsTrigger>
                <TabsTrigger value="payments" className={getDashboardTabsTriggerClass('enseigne')}>
                  Paiements
                </TabsTrigger>
                <TabsTrigger value="imports" className={getDashboardTabsTriggerClass('enseigne')}>
                  Imports CSV
                </TabsTrigger>
                <TabsTrigger value="settings" className={getDashboardTabsTriggerClass('enseigne')}>
                  Configuration
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className={`${dashboardTabsContentClass} space-y-7`} id="enseigne-overview">
                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Plan du jour</p>
                      <p className="text-xs text-slate-400">4 étapes · dans l'ordre</p>
                    </div>
                    <ol className="divide-y divide-slate-100">
                      <li className="flex items-center gap-3 py-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[10px] font-bold text-white">1</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900">Créer les colis</p>
                          <p className="text-xs text-slate-500">Manuel ou CSV bulk</p>
                        </div>
                        <Link href="/dashboard/enseigne?tab=imports#enseigne-import-bulk" className="shrink-0 inline-flex items-center rounded-lg bg-slate-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 whitespace-nowrap">Importer</Link>
                      </li>
                      <li className="flex items-center gap-3 py-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">2</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-amber-900">Régler en ligne</p>
                          <p className="text-xs text-amber-700">Sans paiement → hors circuit</p>
                        </div>
                        {(createdOnlyParcels + pendingPaymentParcels) > 0 && (
                          <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">{createdOnlyParcels + pendingPaymentParcels}</span>
                        )}
                        <Link href="/dashboard/enseigne?tab=payments#enseigne-payments" className="shrink-0 inline-flex items-center rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 whitespace-nowrap">Payer</Link>
                      </li>
                      <li className="flex items-center gap-3 py-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white">3</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-cyan-900">Déposer au relais</p>
                          <p className="text-xs text-cyan-700">QR scanné · digital only</p>
                        </div>
                        {readyForDepositParcels > 0 && (
                          <span className="shrink-0 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">{readyForDepositParcels}</span>
                        )}
                        <Link href="/dashboard/enseigne?tab=tracking#enseigne-tracking" className="shrink-0 inline-flex items-center rounded-lg bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-cyan-700 whitespace-nowrap">Mes colis</Link>
                      </li>
                      <li className="flex items-center gap-3 py-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">4</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-emerald-900">Suivre la livraison</p>
                          <p className="text-xs text-emerald-700">Transport en temps réel</p>
                        </div>
                        <Link href="/dashboard/enseigne?tab=tracking#enseigne-tracking" className="shrink-0 inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 whitespace-nowrap">Suivre</Link>
                      </li>
                    </ol>
                  </section>

                  <section id="enseigne-latest-parcels" className="rounded-2xl border border-slate-200 bg-white/90 p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Pipeline metier</h2>
                    <p className="mt-1 text-sm text-slate-600">Vue etape par etape du flux de traitement.</p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Crees (non payes)</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{createdOnlyParcels}</p>
                        <p className="text-xs text-slate-500">Paiement pas encore initie</p>
                      </article>
                      <article className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-violet-700">A deposer au relais</p>
                        <p className="mt-2 text-2xl font-bold text-violet-800">{readyForDepositParcels}</p>
                        <p className="text-xs text-violet-700">Paye, en attente de depot physique enseigne</p>
                      </article>
                      <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-blue-700">En transport</p>
                        <p className="mt-2 text-2xl font-bold text-blue-800">{inTransportParcels}</p>
                        <p className="text-xs text-blue-700">Missions en execution</p>
                      </article>
                      <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Arrives relais</p>
                        <p className="mt-2 text-2xl font-bold text-emerald-800">{arrivedRelayParcels}</p>
                        <p className="text-xs text-emerald-700">Prets a retrait/livraison finale</p>
                      </article>
                    </div>

                    {(createdOnlyParcels + pendingPaymentParcels) > 0 && (
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4">
                        <div className="flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
                            🔥 Blocage actuel
                          </p>
                          <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
                            {createdOnlyParcels + pendingPaymentParcels} colis bloqué{(createdOnlyParcels + pendingPaymentParcels) > 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-400">
                            paiement manquant — hors circuit logistique
                          </p>
                        </div>
                        <Link
                          href="/dashboard/enseigne?tab=payments#enseigne-payments"
                          className="shrink-0 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Régulariser
                        </Link>
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p>
                        Missions actives: <span className="font-semibold">{activeMissions}</span> · En attente d assignation: <span className="font-semibold">{pendingAssignmentParcels}</span>
                      </p>
                    </div>
                  </section>
                </div>

                <section className="pt-1">
                  <h2 className="text-lg font-semibold text-slate-900">Centre d actions</h2>
                  <p className="mt-1 text-sm text-slate-600">Acces direct aux operations critiques de la journee.</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/dashboard/enseigne?tab=imports#enseigne-import-bulk"
                      className="inline-flex items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                      Ouvrir import bulk
                    </Link>
                    <Link
                      href="/dashboard/enseigne?tab=tracking#enseigne-tracking"
                      className="inline-flex items-center rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Suivre les colis
                    </Link>
                    <Link
                      href="/dashboard/enseigne?tab=settings#enseigne-profile"
                      className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Mettre a jour le profil
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Contacter le support
                    </Link>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="tracking" className={`${dashboardTabsContentClass} space-y-4`} id="enseigne-tracking">
                <section>
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <article className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Etape 1</p>
                      <p className="mt-1 text-sm font-semibold text-violet-800">Depot au relais</p>
                      <p className="mt-2 text-2xl font-bold text-violet-800">{readyForDepositParcels}</p>
                      <p className="text-xs text-violet-700">Colis payes, en attente de depot physique.</p>
                    </article>
                    <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Etape 2</p>
                      <p className="mt-1 text-sm font-semibold text-blue-800">En cours de livraison</p>
                      <p className="mt-2 text-2xl font-bold text-blue-800">{inTransportParcels}</p>
                      <p className="text-xs text-blue-700">Collecte et transport en execution.</p>
                    </article>
                    <article className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Etape 3</p>
                      <p className="mt-1 text-sm font-semibold text-cyan-800">Depose au relais destination</p>
                      <p className="mt-2 text-2xl font-bold text-cyan-800">{arrivedRelayParcels}</p>
                      <p className="text-xs text-cyan-700">Colis arrives et disponibles au relais final.</p>
                    </article>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">Derniers colis</h2>
                    <Link
                      href="/dashboard/enseigne?tab=imports#enseigne-import-bulk"
                      className="text-sm font-medium text-sky-700 hover:text-sky-800"
                    >
                      Nouvel import
                    </Link>
                  </div>

                  <EnseigneTrackingTable parcels={parcelsWithQr} />
                </section>
              </TabsContent>

              <TabsContent value="payments" className={`${dashboardTabsContentClass} space-y-4`} id="enseigne-payments">
                <EnseignePaymentsTab clientId={session.user.id} isPro={isProClient} />
              </TabsContent>

              <TabsContent value="imports" className={`${dashboardTabsContentClass} space-y-4`} id="enseigne-import-bulk">
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900">Operations d import CSV</h2>
                  <p className="text-sm text-slate-600">Traitement bulk, gestion des presets, historique et exports de controle.</p>
                  <EnseigneCsvImportCard clientId={session.user.id} />
                </section>
              </TabsContent>

                <TabsContent value="settings" className={`${dashboardTabsContentClass} space-y-4`} id="enseigne-profile">
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900">Configuration enseigne</h2>
                  <p className="text-sm text-slate-600">Parametres legaux et operationnels utilises par les equipes SwiftColis.</p>
                  <EnseigneProfileCard
                    initialProfile={{
                      businessName: enseigne?.businessName || session.user.name || '',
                      legalName: enseigne?.legalName || null,
                      website: enseigne?.website || null,
                      logoUrl: enseigne?.logoUrl || null,
                      monthlyVolume: enseigne?.monthlyVolume || 0,
                      billingEmail: enseigne?.billingEmail || session.user.email || null,
                      operationalCity: enseigne?.operationalCity || null,
                    }}
                  />
                  </section>
                </TabsContent>
              </Tabs>
            </DashboardPanel>
          </DashboardSection>
        </DashboardShell>
      </main>
      <Footer />
    </div>
  );
}