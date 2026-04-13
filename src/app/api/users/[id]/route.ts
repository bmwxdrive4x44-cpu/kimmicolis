import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';
import { describeBlockedIdentity, findBlockedRelayIdentity } from '@/lib/banned-identities';
import { getClientIpFromHeaders } from '@/lib/request-ip';

type UserColumnRow = {
  column_name: string;
};

let userColumnsCache: Set<string> | null = null;

async function getUserColumns(): Promise<Set<string>> {
  if (userColumnsCache) return userColumnsCache;

  const rows = await db.$queryRaw<UserColumnRow[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User'
  `;

  userColumnsCache = new Set(rows.map((row) => row.column_name));
  return userColumnsCache;
}

function isMissingClientTypeColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return ['clienttype', 'firstname', 'lastname', 'address'].some((field) => message.toLowerCase().includes(field));
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
    const userColumns = await getUserColumns();
    const userSelect: Record<string, boolean | object> = {
      id: true,
      email: true,
      name: true,
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
    };

    if (userColumns.has('firstName')) userSelect.firstName = true;
    if (userColumns.has('lastName')) userSelect.lastName = true;
    if (userColumns.has('address')) userSelect.address = true;
    if (userColumns.has('clientType')) userSelect.clientType = true;

    let user: any = null;
    try {
      user = await db.user.findUnique({ where: { id }, select: userSelect as any });
    } catch (dbError) {
      if (!isMissingClientTypeColumnError(dbError)) {
        console.warn('Query with relations failed, retrying without relations:', dbError);
      }

      const fallbackSelect: Record<string, boolean> = {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        siret: true,
      };

      if (userColumns.has('firstName')) fallbackSelect.firstName = true;
      if (userColumns.has('lastName')) fallbackSelect.lastName = true;
      if (userColumns.has('address')) fallbackSelect.address = true;
      if (userColumns.has('clientType')) fallbackSelect.clientType = true;

      user = await db.user.findUnique({ where: { id }, select: fallbackSelect as any });
      if (user) {
        user = { ...user, relais: null };
      }
    }

    if (user) {
      user = {
        ...user,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        address: user.address ?? null,
        clientType: user.clientType ?? 'STANDARD',
      };
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

    const userColumns = await getUserColumns();

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (normalizedFirstName !== undefined && userColumns.has('firstName')) updateData.firstName = normalizedFirstName || null;
    if (normalizedLastName !== undefined && userColumns.has('lastName')) updateData.lastName = normalizedLastName || null;
    if (normalizedAddress !== undefined && userColumns.has('address')) updateData.address = normalizedAddress || null;
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
    if (clientType !== undefined && userColumns.has('clientType')) {
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
    const buildUserSelect = (cols: Set<string>): Record<string, boolean> => {
      const s: Record<string, boolean> = {
        id: true, email: true, name: true, role: true, phone: true, isActive: true,
      };
      if (cols.has('firstName')) s.firstName = true;
      if (cols.has('lastName')) s.lastName = true;
      if (cols.has('address')) s.address = true;
      return s;
    };

    try {
      user = await db.user.update({
        where: { id },
        data: updateData,
        select: buildUserSelect(userColumns) as any,
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (!isMissingClientTypeColumnError(error)) {
        throw error;
      }

      if ('clientType' in updateData) delete updateData.clientType;
      if ('firstName' in updateData) delete updateData.firstName;
      if ('lastName' in updateData) delete updateData.lastName;
      if ('address' in updateData) delete updateData.address;

      // Force-reset column cache so next request re-probes schema
      userColumnsCache = null;

      user = await db.user.update({
        where: { id },
        data: updateData,
        select: { id: true, email: true, name: true, role: true, phone: true, isActive: true } as any,
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
