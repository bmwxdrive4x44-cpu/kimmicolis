import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const password = request.nextUrl.searchParams.get('password');
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' });
  }

  try {
    const user = await db.user.findFirst({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        password: true,
        relais: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ 
        exists: false, 
        message: 'User not found',
        email: email.toLowerCase()
      });
    }

    const passwordMatch = password ? await verifyPassword(password, user.password || '') : false;

    return NextResponse.json({
      exists: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        hasRelais: !!user.relais,
        relaisStatus: user.relais?.status,
        relaisId: user.relais?.id,
      },
      passwordCheck: {
        provided: password,
        storedFormat: user.password?.startsWith('$2') ? 'bcrypt' : 'legacy-sha256',
        storedHash: user.password,
        matches: passwordMatch,
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Database error', details: String(error) });
  }
}
