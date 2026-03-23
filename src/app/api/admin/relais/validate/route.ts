import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * POST /api/admin/relais/validate
 * Admin validates or rejects a relay point application.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { relaisId, action, reason } = body;

    if (!relaisId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: relaisId, action' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const relais = await db.relais.update({
      where: { id: relaisId },
      data: { status: newStatus },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify the relay user
    await db.notification.create({
      data: {
        userId: relais.userId,
        title: action === 'approve' ? 'Votre point relais est approuvé' : 'Demande de relais refusée',
        message:
          action === 'approve'
            ? `Félicitations ! Votre point relais "${relais.commerceName}" a été approuvé. Vous pouvez maintenant accéder à votre tableau de bord.`
            : `Votre demande de point relais "${relais.commerceName}" a été refusée.${reason ? ` Raison: ${reason}` : ''}`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({
      success: true,
      relais,
      message: `Relais ${action === 'approve' ? 'approuvé' : 'refusé'} avec succès`,
    });
  } catch (error) {
    console.error('Error validating relais:', error);
    return NextResponse.json({ error: 'Failed to validate relais' }, { status: 500 });
  }
}
