import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Get all users
    const users = await db.$queryRaw<Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      password: string | null;
    }>>`
      SELECT id, email, name, role, password FROM "User"
    `;

    // Return users (hide full password for security)
    const safeUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      hasPassword: !!u.password,
      passwordLength: u.password?.length || 0,
      passwordStart: u.password ? u.password.substring(0, 10) + '...' : null
    }));

    return NextResponse.json({
      success: true,
      count: safeUsers.length,
      users: safeUsers
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
