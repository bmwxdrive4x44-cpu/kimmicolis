import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const password = request.nextUrl.searchParams.get('password');
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' });
  }

  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { relais: true },
    });

    if (!user) {
      return NextResponse.json({ 
        exists: false, 
        message: 'User not found',
        email: email.toLowerCase()
      });
    }

    // Check password
    const hashedInputPassword = await hashPassword(password || '');
    const passwordMatch = user.password === hashedInputPassword;

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
        hashedInput: hashedInputPassword,
        storedHash: user.password,
        matches: passwordMatch,
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Database error', details: String(error) });
  }
}
