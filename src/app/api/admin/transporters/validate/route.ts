import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { isAlgerianCommerceRegisterNumber } from '@/lib/validators';

function isRecordNotFoundError(error: unknown): boolean {
  const prismaCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error instanceof Error ? error.message : String(error || '');
  return prismaCode === 'P2025' || message.includes('No record was found for an update');
}

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

    const existingApplication = await db.transporterApplication.findUnique({
      where: { id: applicationId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, siret: true } },
      },
    });

    if (!existingApplication) {
      return NextResponse.json(
        { error: 'Transporter application not found' },
        { status: 404 }
      );
    }

    if (existingApplication.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cette demande a deja ete traitee.' },
        { status: 409 }
      );
    }

    if (action === 'approve') {
      const normalizedSiret = String(existingApplication.user?.siret || '').trim();
      if (!normalizedSiret || !isAlgerianCommerceRegisterNumber(normalizedSiret)) {
        return NextResponse.json(
          {
            error: 'Impossible d\'approuver un dossier transporteur sans numero RC valide.',
            code: 'INVALID_TRANSPORTER_RC',
          },
          { status: 400 }
        );
      }

      if (!existingApplication.vehicle?.trim() || !existingApplication.license?.trim()) {
        return NextResponse.json(
          {
            error: 'Impossible d\'approuver un dossier transporteur incomplet (vehicule ou permis manquant).',
            code: 'INCOMPLETE_TRANSPORTER_APPLICATION',
          },
          { status: 400 }
        );
      }
    }

    const application = await db.$transaction(async (tx) => {
      const updatedApplication = await tx.transporterApplication.update({
        where: { id: applicationId },
        data: { status: newStatus },
        include: {
          user: { select: { id: true, name: true, email: true, role: true, siret: true } },
        },
      });

      if (action === 'approve') {
        await tx.user.update({
          where: { id: updatedApplication.userId },
          data: { role: 'TRANSPORTER' },
        });
      }

      await tx.notification.create({
        data: {
          userId: updatedApplication.userId,
          title:
            action === 'approve'
              ? 'Votre demande de transporteur est approuvée'
              : 'Demande de transporteur refusée',
          message:
            action === 'approve'
              ? 'Felicitations ! Votre compte transporteur a ete active. Vous pouvez maintenant publier des trajets et accepter des missions.'
              : `Votre demande de transporteur a ete refusee.${reason ? ` Raison: ${reason}` : ''}`,
          type: 'IN_APP',
        },
      });

      return updatedApplication;
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
