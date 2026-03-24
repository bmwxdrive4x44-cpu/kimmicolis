import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';

// GET single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const user = await db.user.findUnique({
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
    
    const { name, firstName, lastName, address, phone, email, password, isActive, siret } = body;

    const normalizedFirstName = firstName !== undefined ? String(firstName || '').trim() : undefined;
    const normalizedLastName = lastName !== undefined ? String(lastName || '').trim() : undefined;
    const normalizedAddress = address !== undefined ? String(address || '').trim() : undefined;

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (normalizedFirstName !== undefined) updateData.firstName = normalizedFirstName || null;
    if (normalizedLastName !== undefined) updateData.lastName = normalizedLastName || null;
    if (normalizedAddress !== undefined) updateData.address = normalizedAddress || null;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (siret !== undefined) {
      const normalizedSiret = normalizeCommerceRegisterNumber(String(siret || ''));
      if (normalizedSiret && !isAlgerianCommerceRegisterNumber(normalizedSiret)) {
        return NextResponse.json({
          error: 'Invalid commerce register number format',
          details: 'Format RC algérien invalide (ex: RC-16/1234567B21)',
        }, { status: 400 });
      }
      updateData.siret = normalizedSiret || null;
    }
    if (password) {
      updateData.password = await hashPassword(password);
    }

    if (name === undefined && normalizedFirstName !== undefined && normalizedLastName !== undefined) {
      const recomposed = `${normalizedFirstName} ${normalizedLastName}`.trim();
      if (recomposed) updateData.name = recomposed;
    }

    const user = await db.user.update({
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
    
    await db.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
