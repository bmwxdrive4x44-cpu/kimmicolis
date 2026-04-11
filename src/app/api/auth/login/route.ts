import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, passwordNeedsRehash, verifyPassword } from '@/lib/auth';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

function isRecordNotFoundError(error: unknown): boolean {
  const prismaCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error instanceof Error ? error.message : String(error || '');
  return prismaCode === 'P2025' || message.includes('No record was found for an update');
}

/**
 * POST /api/auth/login
 * Manual login endpoint with rate limiting
 * Note: NextAuth handles the main flow, this is a backup/alternative
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 attempts per minute per IP
  const rateLimitResult = await checkRateLimit(
    request,
    RATE_LIMIT_PRESETS.strict
  );

  if (rateLimitResult.limited) {
    return NextResponse.json(
      {
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (passwordNeedsRehash(user.password)) {
      try {
        await db.user.update({
          where: { id: user.id },
          data: { password: await hashPassword(password) },
        });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          );
        }
        throw error;
      }
    }

    // Return success (frontend will handle token generation via NextAuth)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
