import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const email = 'creperie@gmail.com';
    const password = 'limonade44';
    const hashedPassword = await hashPassword(password);

    // Create or update user
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    let user;
    
    if (existingUser) {
      // Update existing user
      user = await db.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          role: 'RELAIS',
          isActive: true,
        },
      });
      console.log('User updated:', user.email);
    } else {
      // Create new user
      user = await db.user.create({
        data: {
          email,
          password: hashedPassword,
          name: 'Crêperie du Port',
          role: 'RELAIS',
          phone: '+213555444444',
          isActive: true,
        },
      });
      console.log('User created:', user.email);
    }

    // Check if relais exists
    const existingRelais = await db.relais.findUnique({
      where: { userId: user.id },
    });

    let relais;
    
    if (existingRelais) {
      // Update relais status to APPROVED
      relais = await db.relais.update({
        where: { userId: user.id },
        data: {
          status: 'APPROVED',
          commerceName: 'Crêperie du Port',
          address: '123 Rue du Port',
          ville: 'alger',
        },
      });
      console.log('Relais updated:', relais.id);
    } else {
      // Create relais with APPROVED status
      relais = await db.relais.create({
        data: {
          userId: user.id,
          commerceName: 'Crêperie du Port',
          address: '123 Rue du Port',
          ville: 'alger',
          status: 'APPROVED',
          commissionPetit: 100,
          commissionMoyen: 200,
          commissionGros: 300,
        },
      });
      console.log('Relais created:', relais.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Test relais user created/updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      relais: {
        id: relais.id,
        commerceName: relais.commerceName,
        status: relais.status,
      },
      credentials: {
        email,
        password,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create test relais',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
