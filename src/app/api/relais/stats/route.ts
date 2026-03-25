import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

/**
 * GET /api/relais/stats
 * Récupère les statistiques de tous les relais (ADMIN ONLY)
 * Retourne pour chaque relais:
 * - nombre de colis déposés
 * - nombre de colis livrés
 * - cash encaissé
 * - commission relais totale
 * - montant dû à la plateforme
 * - montant déjà versé
 * - score de fiabilité
 * - nombre de retards (colis non livrés après dateLimit)
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    // Récupérer tous les relais avec l'utilisateur
    const relais = await db.relais.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        parcelsDepart: true,
        parcelsArrivee: true,
        cashTransactions: true,
      },
    });

    // Calculer les statistiques pour chaque relais
    const stats = await Promise.all(
      relais.map(async (r) => {
        // Colis déposés (ne pas compter les ANNULE)
        const colisDeparted = r.parcelsDepart.filter((c: any) => c.status !== 'ANNULE');
        const nbDeposites = colisDeparted.length;

        // Colis livrés à ce relais
        const colisArrived = r.parcelsArrivee.filter((c: any) => c.status === 'LIVRE');
        const nbLivres = colisArrived.length;

        // Cash collecté - calculer depuis RelaisCash
        const cashCollected = r.cashTransactions
          .filter((t: any) => t.type === 'COLLECTED')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const cashReversed = r.cashTransactions
          .filter((t: any) => t.type === 'REVERSED')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const netCashCollected = cashCollected - cashReversed;

        // Commission relais totale
        const totalCommissionRelais = colisDeparted.reduce(
          (sum: number, c: any) => sum + (c.commissionRelais || 0),
          0
        );

        // Montant dû à la plateforme (commission plateforme des colis déposés)
        const totalCommissionPlateforme = colisDeparted.reduce(
          (sum: number, c: any) => sum + (c.commissionPlateforme || 0),
          0
        );

        // Montant déjà versé au relais
        const alreadyPaid = r.cashReversed;

        // À payer = sum(commissionRelais) - montant déjà versé
        const amountToPay = totalCommissionRelais - alreadyPaid;

        // Colis en retard (status !== LIVRE et dateLimit dépassée)
        const delayedParcels = r.parcelsDepart.filter((c: any) => {
          if (c.status === 'LIVRE' || c.status === 'ANNULE' || c.status === 'RETOUR') return false;
          if (!c.dateLimit) return false;
          return new Date(c.dateLimit) < new Date();
        });
        const nbDelayed = delayedParcels.length;

        // Score de fiabilité (0-100)
        // Basé sur: % de colis livrés à temps, sans retards, sans pertes
        let reliabilityScore = 100;
        const totalHandled = nbDeposites + nbLivres; // Colis que le relais a touchés
        if (totalHandled > 0) {
          // Pénalité pour retards: -2 points par colis en retard
          reliabilityScore -= Math.min(nbDelayed * 2, 30);

          // Pénalité pour taux de non-livraison
          const deliveryRate = nbLivres / Math.max(nbLivres + nbDelayed, 1);
          if (deliveryRate < 0.95) {
            reliabilityScore -= Math.max(0, (0.95 - deliveryRate) * 50);
          }
        }
        reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

        // Dernière activité
        const lastActivity = [
          ...r.parcelsDepart.map((c: any) => c.updatedAt),
          ...r.parcelsArrivee.map((c: any) => c.updatedAt),
        ].sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime())[0];

        return {
          id: r.id,
          commerceName: r.commerceName,
          ville: r.ville,
          address: r.address,
          operationalStatus: r.operationalStatus,
          suspensionReason: r.suspensionReason,
          suspendedAt: r.suspendedAt,
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
            amountPaid: alreadyPaid,
            nbDelayed,
            reliabilityScore: Math.round(reliabilityScore),
            lastActivity,
          },
        };
      })
    );

    // Trier par fiabilité décroissante
    stats.sort(
      (a, b) => b.metrics.reliabilityScore - a.metrics.reliabilityScore
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching relais stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relais stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/relais/stats/:id
 * Récupère les statistiques d'un relais spécifique
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { relaisId } = await request.json();

    if (!relaisId) {
      return NextResponse.json({ error: 'relaisId is required' }, { status: 400 });
    }

    const relais = await db.relais.findUnique({
      where: { id: relaisId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        parcelsDepart: true,
        parcelsArrivee: true,
        cashTransactions: true,
      },
    });

    if (!relais) {
      return NextResponse.json({ error: 'Relais not found' }, { status: 404 });
    }

    // Utiliser la même logique que GET
    const colisDeparted = relais.parcelsDepart.filter((c: any) => c.status !== 'ANNULE');
    const nbDeposites = colisDeparted.length;

    const colisArrived = relais.parcelsArrivee.filter((c: any) => c.status === 'LIVRE');
    const nbLivres = colisArrived.length;

    const cashCollected = relais.cashTransactions
      .filter((t: any) => t.type === 'COLLECTED')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const cashReversed = relais.cashTransactions
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

    const amountToPay = totalCommissionRelais - relais.cashReversed;

    const delayedParcels = relais.parcelsDepart.filter((c: any) => {
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

    const lastActivity = [
      ...relais.parcelsDepart.map((c: any) => c.updatedAt),
      ...relais.parcelsArrivee.map((c: any) => c.updatedAt),
    ].sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime())[0];

    return NextResponse.json({
      id: relais.id,
      commerceName: relais.commerceName,
      ville: relais.ville,
      address: relais.address,
      operationalStatus: relais.operationalStatus,
      suspensionReason: relais.suspensionReason,
      suspendedAt: relais.suspendedAt,
      contactName: relais.user.name,
      phone: relais.user.phone,
      email: relais.user.email,
      metrics: {
        nbDeposites,
        nbLivres,
        cashCollected,
        cashReversed,
        netCashCollected,
        commissionRelaisTotal: totalCommissionRelais,
        commissionPlateformeTotal: totalCommissionPlateforme,
        amountToPay,
        amountPaid: relais.cashReversed,
        nbDelayed,
        reliabilityScore: Math.round(reliabilityScore),
        lastActivity,
      },
    });
  } catch (error) {
    console.error('Error fetching relais stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relais stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
