import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

/**
 * POST /api/admin/transporters/validate
 * Admin validates or rejects a transporter application.
 * When approved, the user's role is updated to TRANSPORTER.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { applicationId, action, reason } = body;

    if (!applicationId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: applicationId, action' },
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

    const application = await db.transporterApplication.update({
      where: { id: applicationId },
      data: { status: newStatus },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // If approved, update user role to TRANSPORTER
    if (action === 'approve') {
      await db.user.update({
        where: { id: application.userId },
        data: { role: 'TRANSPORTER' },
      });
    }

    // Notify the user
    await db.notification.create({
      data: {
        userId: application.userId,
        title:
          action === 'approve'
            ? 'Votre demande de transporteur est approuvée'
            : 'Demande de transporteur refusée',
        message:
          action === 'approve'
            ? 'Félicitations ! Votre compte transporteur a été activé. Vous pouvez maintenant publier des trajets et accepter des missions.'
            : `Votre demande de transporteur a été refusée.${reason ? ` Raison: ${reason}` : ''}`,
        type: 'IN_APP',
      },
    });

    return NextResponse.json({
      success: true,
      application,
      message: `Demande transporteur ${action === 'approve' ? 'approuvée' : 'refusée'} avec succès`,
    });
  } catch (error) {
    console.error('Error validating transporter application:', error);
    return NextResponse.json(
      { error: 'Failed to validate transporter application' },
      { status: 500 }
    );
  }
}
