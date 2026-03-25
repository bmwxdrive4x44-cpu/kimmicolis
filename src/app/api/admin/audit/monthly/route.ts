import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';
import { processRelaisCompliance } from '@/lib/relais-compliance';

/**
 * POST /api/admin/audit/monthly
 * Déclenche un audit mensuel pour un relais ou tous les relais de la plateforme
 * Calcule variance entre montants déclarés et vérifiés
 */
export async function POST(request: NextRequest) {
  // Vérification auth ADMIN
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { relaisId, forceAll = false } = body;

    // Récupérer les relais à auditer
    let relaisToAudit;
    if (relaisId) {
      relaisToAudit = await db.relais.findUnique({ where: { id: relaisId } });
      if (!relaisToAudit) {
        return NextResponse.json(
          { error: 'Relais not found' },
          { status: 404 }
        );
      }
      relaisToAudit = [relaisToAudit];
    } else if (forceAll) {
      // Audit tous les relais actifs
      relaisToAudit = await db.relais.findMany({
        where: {
          status: 'APPROVED',
          operationalStatus: 'ACTIF',
        },
      });
    } else {
      // Default: audit les relais qui n'ont pas été audités ce mois
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      relaisToAudit = await db.relais.findMany({
        where: {
          status: 'APPROVED',
          operationalStatus: 'ACTIF',
        },
        include: {
          audits: {
            where: {
              auditDate: {
                gte: monthStart,
              },
            },
          },
        },
      });

      // Filter those without recent audit
      relaisToAudit = relaisToAudit.filter(r => r.audits.length === 0);
    }

    const auditResults: Array<Record<string, any>> = [];
    const adminId = auth.payload.id;

    for (const relais of relaisToAudit) {
      try {
        // Récupérer tous les cash déclarés ce mois
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const monthEnd = new Date();
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);
        monthEnd.setHours(23, 59, 59, 999);

        const cashTransactions = await db.relaisCash.findMany({
          where: {
            relaisId: relais.id,
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        });

        if (cashTransactions.length === 0) {
          // Pas de transactions ce mois = pas besoin d'audit
          continue;
        }

        // Calculer déclaré vs vérifié
        const declaredTotal = cashTransactions.reduce(
          (sum, tx) => sum + (tx.declaredAmount ?? tx.amount ?? 0),
          0
        );

        // Pour démo: vérifié = ce qui est effectivement enregistré
        const verifiedTotal = cashTransactions.reduce(
          (sum, tx) => sum + (tx.verifiedAmount ?? tx.amount ?? 0),
          0
        );

        const variance = declaredTotal > 0 
          ? ((declaredTotal - verifiedTotal) / declaredTotal) * 100 
          : 0;

        // Compter les discrepancies (variance > 5% pour une transaction)
        const discrepancies = cashTransactions.filter(
          tx => {
            const txVariance = (tx.verifiedAmount ?? tx.amount ?? 0) > 0
              ? ((tx.declaredAmount ?? tx.amount ?? 0) - (tx.verifiedAmount ?? tx.amount ?? 0)) / 
                  (tx.verifiedAmount ?? tx.amount ?? 0) * 100
              : 0;
            return Math.abs(txVariance) > 5;
          }
        ).length;

        // Créer l'audit immuable
        const audit = await db.relaisAudit.create({
          data: {
            relaisId: relais.id,
            declaredTotal,
            verifiedTotal,
            variance,
            discrepancies,
            status: Math.abs(variance) > 10 ? 'FLAGGED' : 'COMPLETED',
            auditedBy: adminId,
            auditDate: new Date(),
          },
        });

        // Mettre à jour compliance score
        let newScore = relais.complianceScore;
        if (Math.abs(variance) > 10) {
          newScore -= 20; // -20 points si variance > 10%
        } else if (Math.abs(variance) > 5) {
          newScore -= 10; // -10 points si variance > 5%
        } else if (discrepancies > 0) {
          newScore -= 5; // -5 points si discrepancies
        }

        newScore = Math.max(0, newScore);

        await db.relais.update({
          where: { id: relais.id },
          data: { complianceScore: newScore },
        });

        // Si variance > 10%, créer une sanction
        if (Math.abs(variance) > 10 && discrepancies > 0) {
          const existingSanction = await db.relaisSanction.findFirst({
            where: {
              relaisId: relais.id,
              reason: 'HIGH_VARIANCE',
              endDate: null,
            },
          });

          if (!existingSanction) {
            await db.relaisSanction.create({
              data: {
                relaisId: relais.id,
                reason: 'HIGH_VARIANCE',
                type: 'REDUCTION_VOLUME',
                reduction: 50, // Réduction de 50% du volume
                appliedBy: adminId,
                notes: `Auto-sanction from audit: ${variance.toFixed(2)}% variance, ${discrepancies} discrepancies`,
              },
            });
          }
        }

        // Log audit
        await db.actionLog.create({
          data: {
            userId: adminId,
            entityType: 'RELAIS',
            entityId: relais.id,
            action: 'MONTHLY_AUDIT_COMPLETED',
            details: JSON.stringify({
              declaredTotal,
              verifiedTotal,
              variance: variance.toFixed(2),
              discrepancies,
              newScore,
            }),
          },
        });

        const complianceResult = await processRelaisCompliance(relais.id, adminId);

        auditResults.push({
          relaisId: relais.id,
          commerceName: relais.commerceName,
          declaredTotal,
          verifiedTotal,
          variance: variance.toFixed(2),
          discrepancies,
          newScore,
          status: audit.status,
          complianceActions:
            complianceResult.status === 'PROCESSED' ? complianceResult.actions : [],
        });
      } catch (error) {
        console.error(`Audit failed for relais ${relais.id}:`, error);
        auditResults.push({
          relaisId: relais.id,
          commerceName: relais.commerceName,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      auditedCount: auditResults.length,
      results: auditResults,
    });
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { error: 'Failed to perform audit' },
      { status: 500 }
    );
  }
}
