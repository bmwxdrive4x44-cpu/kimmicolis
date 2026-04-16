import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';

// Endpoint de vérification des identifiants pour les smoke tests CI.
// Ne doit JAMAIS retourner d'informations sensibles (hash, format, etc.).
export async function POST(request: Request) {
  // Hard-disabled in production: never expose credential diagnostics.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
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
      storedFormat: user.password.startsWith('$2') ? 'bcrypt' : 'hashed',
    });

  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
