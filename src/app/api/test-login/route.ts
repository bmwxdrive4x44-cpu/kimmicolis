import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Simple password hashing - same as in auth.ts
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

    // Hash the provided password
    const hashedPassword = await hashPassword(password);

    // Compare
    const match = hashedPassword === user.password;

    return NextResponse.json({
      success: true,
      email,
      userFound: true,
      passwordMatch: match,
      providedHash: hashedPassword.substring(0, 20) + '...',
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
