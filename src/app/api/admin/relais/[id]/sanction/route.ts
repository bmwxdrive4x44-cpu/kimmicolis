import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

/**
 * POST /api/admin/relais/:id/sanction
 * Applique une sanction à un relais (warning, réduction volume, suspension, confiscation caution)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Vérification auth ADMIN
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id: relaisId } = await params;
    const body = await request.json();

    const {
      reason,
      type,
      reduction = null,
      notes = '',
      endDate = null,
    } = body;

    // Validation inputs
    const validReasons = [
      'NON_REVERSAL',
      'HIGH_VARIANCE',
      'MISSING_AUDIT',
      'OPERATOR_ERROR',
      'OTHER',
    ];
    const validTypes = [
      'WARNING',
      'REDUCTION_VOLUME',
      'SUSPENSION',
      'CAUTION_FORFEIT',
    ];

    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Vérifier que le relais existe
    const relais = await db.relais.findUnique({
      where: { id: relaisId },
    });

    if (!relais) {
      return NextResponse.json(
        { error: 'Relais not found' },
        { status: 404 }
      );
    }

    // Créer la sanction
    const sanction = await db.relaisSanction.create({
      data: {
        relaisId,
        reason,
        type,
        reduction,
        appliedBy: auth.payload.id,
        notes,
        startDate: new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    // Appliquer les conséquences selon le type
    let updatedRelais = relais;

    if (type === 'SUSPENSION') {
      // Suspendre le relais immédiatement
      updatedRelais = await db.relais.update({
        where: { id: relaisId },
        data: {
          operationalStatus: 'SUSPENDU',
          suspensionReason: `Sanction: ${reason}`,
          suspendedAt: new Date(),
          complianceScore: Math.max(0, relais.complianceScore - 30),
        },
      });
    } else if (type === 'CAUTION_FORFEIT') {
      // Confisquer la caution
      updatedRelais = await db.relais.update({
        where: { id: relaisId },
        data: {
          cautionStatus: 'FORFEITED',
          complianceScore: Math.max(0, relais.complianceScore - 40),
          operationalStatus: 'SUSPENDU',
          suspensionReason: `Caution forfeited: ${reason}`,
          suspendedAt: new Date(),
        },
      });
    } else if (type === 'REDUCTION_VOLUME') {
      // Réduire le compliance score
      updatedRelais = await db.relais.update({
        where: { id: relaisId },
        data: {
          complianceScore: Math.max(0, relais.complianceScore - 15),
        },
      });
    } else if (type === 'WARNING') {
      // Warning = -5 points
      updatedRelais = await db.relais.update({
        where: { id: relaisId },
        data: {
          complianceScore: Math.max(0, relais.complianceScore - 5),
        },
      });
    }

    // Log de l'action
    await db.actionLog.create({
      data: {
        userId: auth.payload.id,
        entityType: 'RELAIS',
        entityId: relaisId,
        action: 'SANCTION_APPLIED',
        details: JSON.stringify({
          reason,
          type,
          reduction,
          notes,
          newScore: updatedRelais.complianceScore,
          newStatus: updatedRelais.operationalStatus,
        }),
      },
    });

    // Créer notification au relais
    const relaisUser = await db.user.findUnique({
      where: { id: relais.userId },
    });

    if (relaisUser) {
      const sanctionMessages: Record<string, string> = {
        WARNING: `Avertissement reçu pour: ${reason}. Veuillez corriger rapidement.`,
        REDUCTION_VOLUME: `Votre volume de colis a été réduit de ${reduction}% suite à: ${reason}`,
        SUSPENSION: `Votre compte relais a été temporairement suspendu pour: ${reason}`,
        CAUTION_FORFEIT: `Votre caution a été confisquée pour non-respect des obligations: ${reason}`,
      };

      await db.notification.create({
        data: {
          userId: relaisUser.id,
          title: 'Action disciplinaire',
          message: sanctionMessages[type] || `Sanction appliquée: ${reason}`,
          type: 'IN_APP',
        },
      });
    }

    return NextResponse.json({
      success: true,
      sanction,
      relais: updatedRelais,
    });
  } catch (error) {
    console.error('Sanction error:', error);
    return NextResponse.json(
      { error: 'Failed to apply sanction' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/relais/:id/sanction
 * Récupère toutes les sanctions d'un relais
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Vérification auth ADMIN
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id: relaisId } = await params;

    // Vérifier existence du relais
    const relais = await db.relais.findUnique({
      where: { id: relaisId },
    });

    if (!relais) {
      return NextResponse.json(
        { error: 'Relais not found' },
        { status: 404 }
      );
    }

    // Récupérer sanctions
    const sanctions = await db.relaisSanction.findMany({
      where: { relaisId },
      orderBy: { startDate: 'desc' },
    });

    // Récupérer sanctions actives
    const now = new Date();
    const activeSanctions = sanctions.filter(
      s => !s.endDate || s.endDate > now
    );

    return NextResponse.json({
      success: true,
      relaisId,
      complianceScore: relais.complianceScore,
      operationalStatus: relais.operationalStatus,
      sanctionsCount: sanctions.length,
      activeSanctionsCount: activeSanctions.length,
      activeSanctions,
      allSanctions: sanctions,
    });
  } catch (error) {
    console.error('Sanctions fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sanctions' },
      { status: 500 }
    );
  }
}
