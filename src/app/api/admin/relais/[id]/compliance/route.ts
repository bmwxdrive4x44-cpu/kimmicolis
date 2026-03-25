import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

/**
 * GET /api/admin/relais/:id/compliance
 * Récupère score de confiance, historique audits, sanctions, et timeline de conformité
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Vérification auth ADMIN
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id: relaisId } = params;

    // Récupérer le relais avec ses relations
    const relais = await db.relais.findUnique({
      where: { id: relaisId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!relais) {
      return NextResponse.json(
        { error: 'Relais not found' },
        { status: 404 }
      );
    }

    // Récupérer tous les audits (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const audits = await db.relaisAudit.findMany({
      where: {
        relaisId,
        auditDate: {
          gte: sixMonthsAgo,
        },
      },
      orderBy: { auditDate: 'desc' },
    });

    // Récupérer sanctions actives et terminées
    const now = new Date();
    const allSanctions = await db.relaisSanction.findMany({
      where: { relaisId },
      orderBy: { startDate: 'desc' },
    });

    const activeSanctions = allSanctions.filter(
      s => !s.endDate || s.endDate > now
    );

    // Récupérer cash transactions (ce mois)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date();
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    const monthCash = await db.relaisCash.findMany({
      where: {
        relaisId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const monthDeclaredTotal = monthCash.reduce(
      (sum, tx) => sum + (tx.declaredAmount ?? tx.amount ?? 0),
      0
    );

    const monthVerifiedTotal = monthCash.reduce(
      (sum, tx) => sum + (tx.verifiedAmount ?? tx.amount ?? 0),
      0
    );

    const monthVariance =
      monthDeclaredTotal > 0
        ? ((monthDeclaredTotal - monthVerifiedTotal) / monthDeclaredTotal) * 100
        : 0;

    // Calculer trend score (évolution conformité)
    const lastAudit = audits[0];
    const previousAudit = audits[1];
    let scoreTrend = 'stable';
    if (lastAudit && previousAudit) {
      if (lastAudit.variance < previousAudit.variance) {
        scoreTrend = 'improving';
      } else if (lastAudit.variance > previousAudit.variance) {
        scoreTrend = 'declining';
      }
    }

    // Déterminer la couleur/catégorie de confiance
    let trustLevel: 'excellent' | 'good' | 'warning' | 'critical';
    if (relais.complianceScore >= 90) {
      trustLevel = 'excellent';
    } else if (relais.complianceScore >= 75) {
      trustLevel = 'good';
    } else if (relais.complianceScore >= 50) {
      trustLevel = 'warning';
    } else {
      trustLevel = 'critical';
    }

    // Récupérer action logs (dernières 20 actions)
    const actionLogs = await db.actionLog.findMany({
      where: {
        entityId: relaisId,
        entityType: 'RELAIS',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Déblocages de caution prévus
    let nextCautionRelease: { date: string; amount: number } | null = null;
    if (relais.cautionStatus === 'BLOCKED' && relais.activationDate) {
      const date30 = new Date(relais.activationDate);
      date30.setDate(date30.getDate() + 30);

      const date90 = new Date(relais.activationDate);
      date90.setDate(date90.getDate() + 90);

      const date180 = new Date(relais.activationDate);
      date180.setDate(date180.getDate() + 180);

      const now = new Date();

      // Check which release window we're in
      if (now < date30) {
        nextCautionRelease = {
          date: date30.toISOString(),
          amount: (relais.cautionAmount ?? 0) * 0.33, // 33% at 30 days
        };
      } else if (now < date90) {
        nextCautionRelease = {
          date: date90.toISOString(),
          amount: (relais.cautionAmount ?? 0) * 0.66, // 66% at 90 days
        };
      } else if (now < date180) {
        nextCautionRelease = {
          date: date180.toISOString(),
          amount: relais.cautionAmount ?? 0, // 100% at 180 days
        };
      }
    }

    return NextResponse.json({
      success: true,
      relais: {
        id: relais.id,
        commerceName: relais.commerceName,
        ville: relais.ville,
        status: relais.status,
        operationalStatus: relais.operationalStatus,
        user: relais.user,
      },
      compliance: {
        score: relais.complianceScore,
        trustLevel,
        trend: scoreTrend,
        lastUpdated: relais.updatedAt,
      },
      caution: {
        amount: relais.cautionAmount,
        status: relais.cautionStatus,
        paidAt: relais.cautionPaidAt,
        nextRelease: nextCautionRelease,
      },
      activity: {
        activationDate: relais.activationDate,
        firstActivityDate: relais.firstActivityDate,
      },
      currentMonth: {
        declaredTotal: monthDeclaredTotal,
        verifiedTotal: monthVerifiedTotal,
        variance: monthVariance.toFixed(2),
        transactionsCount: monthCash.length,
      },
      audits: {
        total: audits.length,
        lastSixMonths: audits.map(a => ({
          id: a.id,
          auditDate: a.auditDate,
          declaredTotal: a.declaredTotal,
          verifiedTotal: a.verifiedTotal,
          variance: a.variance.toFixed(2),
          discrepancies: a.discrepancies,
          status: a.status,
        })),
      },
      sanctions: {
        active: activeSanctions.length,
        total: allSanctions.length,
        activeSanctions: activeSanctions.map(s => ({
          id: s.id,
          reason: s.reason,
          type: s.type,
          reduction: s.reduction,
          startDate: s.startDate,
          endDate: s.endDate,
          notes: s.notes,
        })),
      },
      recentActions: actionLogs.map(log => ({
        id: log.id,
        action: log.action,
        details: log.details ? JSON.parse(log.details) : null,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('Compliance fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance data' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/relais/:id/compliance
 * Modifier manuellement le score de conformité (admin override)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Vérification auth ADMIN
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id: relaisId } = params;
    const body = await request.json();

    const { score, notes } = body;

    // Validation
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return NextResponse.json(
        { error: 'Score must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    // Vérifier existence
    const relais = await db.relais.findUnique({
      where: { id: relaisId },
    });

    if (!relais) {
      return NextResponse.json(
        { error: 'Relais not found' },
        { status: 404 }
      );
    }

    // Mettre à jour le score
    const updated = await db.relais.update({
      where: { id: relaisId },
      data: {
        complianceScore: score,
      },
    });

    // Log l'action
    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'RELAIS',
        entityId: relaisId,
        action: 'COMPLIANCE_SCORE_OVERRIDE',
        details: JSON.stringify({
          oldScore: relais.complianceScore,
          newScore: score,
          notes,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      relais: {
        id: updated.id,
        commerceName: updated.commerceName,
        complianceScore: updated.complianceScore,
      },
    });
  } catch (error) {
    console.error('Compliance update error:', error);
    return NextResponse.json(
      { error: 'Failed to update compliance score' },
      { status: 500 }
    );
  }
}
