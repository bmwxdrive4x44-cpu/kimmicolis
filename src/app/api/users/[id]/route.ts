import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';
import { describeBlockedIdentity, findBlockedRelayIdentity } from '@/lib/banned-identities';
import { getClientIpFromHeaders } from '@/lib/request-ip';

function isMissingClientTypeColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.toLowerCase().includes('clienttype');
}

function isRecordNotFoundError(error: unknown): boolean {
  const prismaCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error instanceof Error ? error.message : String(error || '');
  return prismaCode === 'P2025' || message.includes('No record was found for an update');
}

// GET single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    let user: any = null;
    try {
      user = await db.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          address: true,
          role: true,
          phone: true,
          isActive: true,
          clientType: true,
          createdAt: true,
          siret: true,
          relais: {
            select: {
              id: true,
              commerceName: true,
              status: true,
              address: true,
              ville: true,
            },
          },
        },
      });
    } catch (dbError) {
      // If clientType doesn't exist, retry without it
      if (isMissingClientTypeColumnError(dbError)) {
        try {
          user = await db.user.findUnique({
            where: { id },
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
              address: true,
              role: true,
              phone: true,
              isActive: true,
              createdAt: true,
              siret: true,
              relais: {
                select: {
                  id: true,
                  commerceName: true,
                  status: true,
                  address: true,
                  ville: true,
                },
              },
            },
          });

          if (user) {
            user = { ...user, clientType: 'STANDARD' };
          }
        } catch (fallbackError) {
          console.error('Fallback query failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        // For any other error, try a simple query without relais
        console.warn('Query with relais failed, retrying without relations:', dbError);
        user = await db.user.findUnique({
          where: { id },
        });
        
        if (user) {
          user = {
            ...user,
            relais: null,
          };
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingUser = await db.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const { name, firstName, lastName, address, phone, email, password, isActive, siret, clientType } = body;

    const normalizedFirstName = firstName !== undefined ? String(firstName || '').trim() : undefined;
    const normalizedLastName = lastName !== undefined ? String(lastName || '').trim() : undefined;
    const normalizedAddress = address !== undefined ? String(address || '').trim() : undefined;
    const normalizedEmail = email !== undefined ? String(email || '').trim().toLowerCase() : undefined;
    const normalizedSiret = siret !== undefined ? normalizeCommerceRegisterNumber(String(siret || '')) : undefined;

    const blockedIdentity = await findBlockedRelayIdentity({
      email: normalizedEmail,
      siret: normalizedSiret,
      ip: getClientIpFromHeaders(request.headers),
    });

    if (blockedIdentity) {
      return NextResponse.json({
        error: 'Blocked identity',
        code: 'BANNED_IDENTITY',
        blockedType: blockedIdentity.type,
        details: describeBlockedIdentity(blockedIdentity),
      }, { status: 403 });
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (normalizedFirstName !== undefined) updateData.firstName = normalizedFirstName || null;
    if (normalizedLastName !== undefined) updateData.lastName = normalizedLastName || null;
    if (normalizedAddress !== undefined) updateData.address = normalizedAddress || null;
    if (phone !== undefined) updateData.phone = phone;
    if (normalizedEmail !== undefined) updateData.email = normalizedEmail;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (siret !== undefined) {
      if (normalizedSiret && !isAlgerianCommerceRegisterNumber(normalizedSiret)) {
        return NextResponse.json({
          error: 'Invalid commerce register number format',
          details: 'Format RC algérien invalide (ex: RC-16/1234567B21)',
        }, { status: 400 });
      }

      if (normalizedSiret) {
        const [conflictingRelais, conflictingTransporter] = await Promise.all([
          db.relais.findFirst({
            where: {
              userId: { not: id },
              status: { in: ['PENDING', 'APPROVED'] },
              user: { siret: normalizedSiret },
            },
            select: { id: true, status: true },
          }),
          db.transporterApplication.findFirst({
            where: {
              userId: { not: id },
              status: { in: ['PENDING', 'APPROVED'] },
              user: { siret: normalizedSiret },
            },
            select: { id: true, status: true },
          }),
        ]);

        if (conflictingRelais || conflictingTransporter) {
          return NextResponse.json({
            error: 'Ce numéro RC/SIRET est déjà utilisé par un autre profil professionnel actif.',
            code: conflictingTransporter ? 'DUPLICATE_TRANSPORTER_RC' : 'DUPLICATE_RELAIS_RC',
            details: {
              conflictingRelaisId: conflictingRelais?.id ?? null,
              conflictingRelaisStatus: conflictingRelais?.status ?? null,
              conflictingTransporterApplicationId: conflictingTransporter?.id ?? null,
              conflictingTransporterStatus: conflictingTransporter?.status ?? null,
            },
          }, { status: 409 });
        }
      }

      updateData.siret = normalizedSiret || null;
    }
    if (password) {
      updateData.password = await hashPassword(password);
    }
    if (clientType !== undefined) {
      const normalized = String(clientType || '').toUpperCase();
      if (!['STANDARD', 'PRO'].includes(normalized)) {
        return NextResponse.json({ error: 'clientType invalide (STANDARD ou PRO)' }, { status: 400 });
      }
      updateData.clientType = normalized;
    }

    if (name === undefined && normalizedFirstName !== undefined && normalizedLastName !== undefined) {
      const recomposed = `${normalizedFirstName} ${normalizedLastName}`.trim();
      if (recomposed) updateData.name = recomposed;
    }

    let user: any;
    try {
      user = await db.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          address: true,
          role: true,
          phone: true,
          isActive: true,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (!isMissingClientTypeColumnError(error)) {
        throw error;
      }

      if ('clientType' in updateData) {
        delete updateData.clientType;
      }

      user = await db.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          address: true,
          role: true,
          phone: true,
          isActive: true,
        },
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ 
      error: 'Failed to update user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete in cascade order to respect foreign key constraints
    
    // 1. Delete transporter/relais-related records
    await db.transporterPreferences.deleteMany({ where: { userId: id } });
    await db.transporterApplication.deleteMany({ where: { userId: id } });
    await db.passwordResetToken.deleteMany({ where: { userId: id } });
    
    // 2. Delete disputes where user is resolver
    await db.dispute.deleteMany({ where: { resolvedById: id } });
    
    // 3. Delete notifications
    await db.notification.deleteMany({ where: { userId: id } });
    
    // 4. Delete payments (linked via clientId)
    await db.payment.deleteMany({ where: { clientId: id } });
    
    // 5. Delete missions (linked via transporteurId)
    await db.mission.deleteMany({ where: { transporteurId: id } });
    
    // 6. Delete trajets (linked via transporteurId)
    await db.trajet.deleteMany({ where: { transporteurId: id } });
    
    // 7. Delete relais if exists
    await db.relais.deleteMany({ where: { userId: id } });
    
    // 8. Delete enseigne if exists
    await db.enseigne.deleteMany({ where: { userId: id } });
    
    // 9. Delete disputes opened by user
    await db.dispute.deleteMany({ where: { openedById: id } });
    
    // 10. Finally delete the user
    await db.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ 
      error: 'Failed to delete user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
