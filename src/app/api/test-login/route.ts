import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password required'
      }, { status: 400 });
    }

    // Find user
    const users = await db.$queryRaw<Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      password: string | null;
    }>>`
      SELECT id, email, name, role, password FROM "User" WHERE email = ${email}
    `;

    if (users.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        email
      }, { status: 404 });
    }

    const user = users[0];

    if (!user.password) {
      return NextResponse.json({
        success: false,
        error: 'User has no password set'
      }, { status: 400 });
    }

    const match = await verifyPassword(password, user.password);

    return NextResponse.json({
      success: true,
      email,
      userFound: true,
      passwordMatch: match,
      storedFormat: user.password.startsWith('$2') ? 'bcrypt' : 'legacy-sha256',
      storedHash: user.password.substring(0, 20) + '...',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
