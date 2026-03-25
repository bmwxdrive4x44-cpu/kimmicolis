import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

/**
 * GET /api/admin/relais-tracking
 * Récupère le suivi de tous les relais pour l'admin
 * Retourne les relais groupés par statut opérationnel avec alertes
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'reliabilityScore'; // reliabilityScore, moneyPending, delayCount
    const filterStatus = searchParams.get('filterStatus') || 'ALL'; // ALL, ACTIF, SUSPENDU

    // Récupérer tous les relais avec stats
    const relais = await db.relais.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        parcelsDepart: true,
        parcelsArrivee: true,
        cashTransactions: true,
      },
    });

    // Calculer les statistiques pour chaque relais
    const relaisWithStats = await Promise.all(
      relais.map(async (r) => {
        const colisDeparted = r.parcelsDepart.filter((c: any) => c.status !== 'ANNULE');
        const nbDeposites = colisDeparted.length;

        const colisArrived = r.parcelsArrivee.filter((c: any) => c.status === 'LIVRE');
        const nbLivres = colisArrived.length;

        const cashCollected = r.cashTransactions
          .filter((t: any) => t.type === 'COLLECTED')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const cashReversed = r.cashTransactions
          .filter((t: any) => t.type === 'REVERSED')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const netCashCollected = cashCollected - cashReversed;

        const totalCommissionRelais = colisDeparted.reduce(
          (sum: number, c: any) => sum + (c.commissionRelais || 0),
          0
        );

        const totalCommissionPlateforme = colisDeparted.reduce(
          (sum: number, c: any) => sum + (c.commissionPlateforme || 0),
          0
        );

        const amountToPay = totalCommissionRelais - r.cashReversed;

        const delayedParcels = r.parcelsDepart.filter((c: any) => {
          if (c.status === 'LIVRE' || c.status === 'ANNULE' || c.status === 'RETOUR') return false;
          if (!c.dateLimit) return false;
          return new Date(c.dateLimit) < new Date();
        });
        const nbDelayed = delayedParcels.length;

        let reliabilityScore = 100;
        const totalHandled = nbDeposites + nbLivres;
        if (totalHandled > 0) {
          reliabilityScore -= Math.min(nbDelayed * 2, 30);
          const deliveryRate = nbLivres / Math.max(nbLivres + nbDelayed, 1);
          if (deliveryRate < 0.95) {
            reliabilityScore -= Math.max(0, (0.95 - deliveryRate) * 50);
          }
        }
        reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

        // Alertes
        const alerts: Array<{ level: 'warning' | 'critical', message: string }> = [];
        if (r.operationalStatus === 'SUSPENDU') {
          alerts.push({ level: 'critical', message: `Relais suspendu: ${r.suspensionReason || 'Raison non spécifiée'}` });
        }
        if (nbDelayed > 3) {
          alerts.push({ level: 'warning', message: `${nbDelayed} colis en retard` });
        }
        if (reliabilityScore < 80) {
          alerts.push({ level: 'warning', message: `Score de fiabilité bas: ${reliabilityScore}%` });
        }
        if (amountToPay > 50000) {
          alerts.push({ level: 'warning', message: `Montant dû important: ${amountToPay.toFixed(0)} DA` });
        }

        return {
          id: r.id,
          commerceName: r.commerceName,
          ville: r.ville,
          address: r.address,
          operationalStatus: r.operationalStatus,
          suspensionReason: r.suspensionReason,
          suspendedAt: r.suspendedAt,
          approvalStatus: r.status,
          contactName: r.user.name,
          phone: r.user.phone,
          email: r.user.email,
          metrics: {
            nbDeposites,
            nbLivres,
            cashCollected,
            cashReversed,
            netCashCollected,
            commissionRelaisTotal: totalCommissionRelais,
            commissionPlateformeTotal: totalCommissionPlateforme,
            amountToPay,
            amountPaid: r.cashReversed,
            nbDelayed,
            reliabilityScore: Math.round(reliabilityScore),
          },
          alerts,
        };
      })
    );

    // Filtrer par statut opérationnel
    let filtered = relaisWithStats;
    if (filterStatus === 'ACTIF') {
      filtered = relaisWithStats.filter((r) => r.operationalStatus === 'ACTIF');
    } else if (filterStatus === 'SUSPENDU') {
      filtered = relaisWithStats.filter((r) => r.operationalStatus === 'SUSPENDU');
    }

    // Trier
    filtered.sort((a, b) => {
      if (sortBy === 'reliabilityScore') {
        return b.metrics.reliabilityScore - a.metrics.reliabilityScore;
      } else if (sortBy === 'moneyPending') {
        return b.metrics.amountToPay - a.metrics.amountToPay;
      } else if (sortBy === 'delayCount') {
        return b.metrics.nbDelayed - a.metrics.nbDelayed;
      }
      return 0;
    });

    // Calculer les totaux
    const totals = {
      totalRelais: relaisWithStats.length,
      actifRelais: relaisWithStats.filter((r) => r.operationalStatus === 'ACTIF').length,
      suspendedRelais: relaisWithStats.filter((r) => r.operationalStatus === 'SUSPENDU').length,
      totalCashCollected: relaisWithStats.reduce((sum, r) => sum + r.metrics.cashCollected, 0),
      totalMoneyPending: relaisWithStats.reduce((sum, r) => sum + r.metrics.amountToPay, 0),
      avgReliabilityScore: Math.round(
        relaisWithStats.reduce((sum, r) => sum + r.metrics.reliabilityScore, 0) / Math.max(relaisWithStats.length, 1)
      ),
    };

    return NextResponse.json({
      relais: filtered,
      totals,
    });
  } catch (error) {
    console.error('Error fetching relais tracking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relais tracking', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/relais-tracking
 * Mettre à jour le statut opérationnel d'un relais
 */
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { relaisId, operationalStatus, suspensionReason } = body;

    if (!relaisId || !operationalStatus) {
      return NextResponse.json(
        { error: 'relaisId et operationalStatus sont requis' },
        { status: 400 }
      );
    }

    if (!['ACTIF', 'SUSPENDU'].includes(operationalStatus)) {
      return NextResponse.json(
        { error: 'operationalStatus doit être ACTIF ou SUSPENDU' },
        { status: 400 }
      );
    }

    const existingRelais = await db.relais.findUnique({ where: { id: relaisId } });
    if (!existingRelais) {
      return NextResponse.json({ error: 'Relais not found' }, { status: 404 });
    }

    const previousOperationalStatus = existingRelais.operationalStatus;

    const relais = await db.relais.update({
      where: { id: relaisId },
      data: {
        operationalStatus,
        suspensionReason: operationalStatus === 'SUSPENDU' ? suspensionReason || 'Suspendu par un admin' : null,
        suspendedAt: operationalStatus === 'SUSPENDU' ? new Date() : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Create action log
    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'RELAIS',
        entityId: relaisId,
        action: 'STATUS_CHANGE',
        details: JSON.stringify({
          from: previousOperationalStatus,
          to: operationalStatus,
          reason: suspensionReason,
        }),
      },
    });

    return NextResponse.json({
      message: `Relais ${operationalStatus === 'SUSPENDU' ? 'suspendu' : 'réactivé'}`,
      relais,
    });
  } catch (error) {
    console.error('Error updating relais operational status:', error);
    return NextResponse.json(
      { error: 'Failed to update relais status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
