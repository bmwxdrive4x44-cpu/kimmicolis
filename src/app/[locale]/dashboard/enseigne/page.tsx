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
  DashboardShell,
  DashboardStatsGrid,
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

  const [enseigneRows, totalParcels, deliveredParcels, revenueAgg] = await Promise.all([
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
    db.colis.count({ where: { clientId: session.user.id } }),
    db.colis.count({ where: { clientId: session.user.id, status: 'LIVRE' } }),
    db.colis.aggregate({
      where: {
        clientId: session.user.id,
        status: { in: ['READY_FOR_DEPOSIT', 'PAID', 'DEPOSITED_RELAY', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION', 'LIVRE'] },
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
    db.colis.count({ where: { clientId: session.user.id, status: 'READY_FOR_DEPOSIT' } }),
    db.colis.count({ where: { clientId: session.user.id, status: 'DEPOSITED_RELAY' } }),
    db.colis.count({
      where: { clientId: session.user.id, status: { in: ['WAITING_PICKUP', 'EN_TRANSPORT'] } },
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
        status: { in: ['DEPOSITED_RELAY', 'RECU_RELAIS', 'PAID_RELAY'] },
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

  const deliveryRate = totalParcels > 0 ? Math.round((deliveredParcels / totalParcels) * 100) : 0;
  const totalRevenue = revenueAgg._sum.prixClient ?? 0;

  // PRO score: 0-100 based on delivery success rate with penalty for returns
  const proScore = totalParcels > 0
    ? Math.max(0, Math.min(100, Math.round(
        (deliveredParcels / totalParcels) * 100 - (returnedParcels / Math.max(totalParcels, 1)) * 20
      )))
    : 100;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <DashboardShell tone="client" className="mx-auto max-w-7xl">
          <DashboardHero
            tone="client"
            eyebrow="Operations enseigne"
            title="Tour de controle e-commerce"
            description="Flux enseigne 100% digital: paiement en ligne, depot physique au relais partenaire, puis collecte et transport orchestras par la plateforme."
            meta={
              <>
                <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700">
                  {enseigne?.businessName || session.user.name || 'Votre enseigne'}
                </Badge>
                {enseigne?.operationalCity ? (
                  <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700">
                    Base: {enseigne.operationalCity}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700">
                  Taux de livraison: {deliveryRate}%
                </Badge>
                <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-700">
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

          {(createdOnlyParcels + pendingPaymentParcels) > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 p-4 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-sm">
                  ⚠️ {createdOnlyParcels + pendingPaymentParcels} colis non payé{(createdOnlyParcels + pendingPaymentParcels) > 1 ? 's' : ''} — hors circuit logistique
                </p>
                <p className="text-sm mt-0.5">
                  Tant que le paiement n'est pas confirmé, vos colis ne sont pas pris en charge.
                  {' '}<strong>Rendez-vous dans l'onglet Paiements pour régulariser.</strong>
                </p>
              </div>
            </div>
          )}

          <DashboardStatsGrid>
            <DashboardMetricCard
              tone="client"
              label="Colis total"
              value={totalParcels}
              icon={<Package className="h-5 w-5" />}
              detail="Volume global traite"
            />
            <DashboardMetricCard
              tone="client"
              label="Non payes"
              value={createdOnlyParcels + pendingPaymentParcels}
              icon={<CreditCard className="h-5 w-5" />}
              detail={`${createdOnlyParcels} crees · ${pendingPaymentParcels} session en cours`}
            />
            <DashboardMetricCard
              tone="client"
              label="A deposer au relais"
              value={readyForDepositParcels}
              icon={<Package className="h-5 w-5" />}
              detail="Payes, attente depot physique"
            />
            <DashboardMetricCard
              tone="client"
              label="En transit"
              value={inTransportParcels}
              icon={<Truck className="h-5 w-5" />}
              detail={`${activeMissions} missions actives`}
            />
            <DashboardMetricCard
              tone="client"
              label="Livres"
              value={deliveredParcels}
              icon={<CheckCircle className="h-5 w-5" />}
              detail={`${Math.round(totalRevenue).toLocaleString('fr-DZ')} DA CA · score ${proScore}/100`}
            />
          </DashboardStatsGrid>

          <DashboardPanel tone="client">
            <Tabs key={initialTab} defaultValue={initialTab}>
              <TabsList className={`${dashboardTabsListClass} grid grid-cols-2 lg:grid-cols-5`}>
                <TabsTrigger value="overview" className={getDashboardTabsTriggerClass('client')}>
                  Vue d ensemble
                </TabsTrigger>
                <TabsTrigger value="tracking" className={getDashboardTabsTriggerClass('client')}>
                  Suivi colis
                </TabsTrigger>
                <TabsTrigger value="payments" className={getDashboardTabsTriggerClass('client')}>
                  Paiements
                </TabsTrigger>
                <TabsTrigger value="imports" className={getDashboardTabsTriggerClass('client')}>
                  Imports CSV
                </TabsTrigger>
                <TabsTrigger value="settings" className={getDashboardTabsTriggerClass('client')}>
                  Configuration
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4" id="enseigne-overview">
                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-white/85 p-5">
                    <h2 className="text-lg font-semibold text-slate-900">Plan operationnel quotidien</h2>
                    <p className="mt-1 text-sm text-slate-600">Chaque etape doit etre completee avant la suivante &mdash; cliquez pour agir.</p>
                    <ol className="mt-4 space-y-3 text-sm">
                      <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[11px] font-bold text-white mt-0.5">1</span>
                          <span className="text-slate-700">Creer les colis (manuel ou CSV) et verifier les informations destinataire.</span>
                        </div>
                        <Link href="/dashboard/enseigne?tab=imports#enseigne-import-bulk" className="shrink-0 inline-flex items-center rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 whitespace-nowrap">
                          Creer un colis
                        </Link>
                      </li>
                      <li className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[11px] font-bold text-white mt-0.5">2</span>
                          <span className="text-amber-800">Regler en ligne. Sans paiement confirme, le colis reste hors circuit logistique.</span>
                        </div>
                        <Link href="/dashboard/enseigne?tab=payments#enseigne-payments" className="shrink-0 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap">
                          Payer maintenant
                        </Link>
                      </li>
                      <li className="flex items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-bold text-white mt-0.5">3</span>
                          <span className="text-cyan-800">
                            Deposer le colis au relais de depart indique sur l'etiquette.
                            Le relais scanne le QR pour confirmer le depot — aucun encaissement, le paiement digital est deja effectue.
                            {readyForDepositParcels > 0 && (
                              <span className="ml-1 inline-flex items-center rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                {readyForDepositParcels} a deposer
                              </span>
                            )}
                          </span>
                        </div>
                        <Link
                          href="/dashboard/enseigne?tab=tracking#enseigne-tracking"
                          className="shrink-0 inline-flex items-center rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 whitespace-nowrap"
                        >
                          Mes colis
                        </Link>
                      </li>
                      <li className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white mt-0.5">4</span>
                          <span className="text-emerald-800">Le transporteur collecte et livre le colis. Suivez l avancement en temps reel.</span>
                        </div>
                        <Link href="/dashboard/enseigne?tab=tracking#enseigne-tracking" className="shrink-0 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap">
                          Suivre transport
                        </Link>
                      </li>
                    </ol>
                  </section>

                  <section id="enseigne-latest-parcels" className="rounded-2xl border border-slate-200 bg-white/85 p-5">
                    <h2 className="text-lg font-semibold text-slate-900">Pipeline metier</h2>
                    <p className="mt-1 text-sm text-slate-600">Vue etape par etape du flux de traitement.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

                <section>
                  <h2 className="text-lg font-semibold text-slate-900">Centre d actions</h2>
                  <p className="mt-1 text-sm text-slate-600">Acces direct aux operations critiques de la journee.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
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

              <TabsContent value="tracking" className="space-y-4" id="enseigne-tracking">
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

              <TabsContent value="payments" className="space-y-4" id="enseigne-payments">
                <EnseignePaymentsTab clientId={session.user.id} isPro={isProClient} />
              </TabsContent>

              <TabsContent value="imports" className="space-y-4" id="enseigne-import-bulk">
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900">Operations d import CSV</h2>
                  <p className="text-sm text-slate-600">Traitement bulk, gestion des presets, historique et exports de controle.</p>
                  <EnseigneCsvImportCard clientId={session.user.id} />
                </section>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4" id="enseigne-profile">
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
        </DashboardShell>
      </main>
      <Footer />
    </div>
  );
}