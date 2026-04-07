import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { sendPasswordResetEmail } from '@/lib/email';

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(request, RATE_LIMIT_PRESETS.strict);
  if (rl.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const emailRaw = typeof body?.email === 'string' ? body.email : '';
    const email = emailRaw.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Email is invalid.' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isActive: true },
    });

    // Always return success to avoid account enumeration.
    if (!user || !user.isActive) {
      return NextResponse.json({
        success: true,
        message: 'If this email exists, a reset link has been generated.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db.$executeRaw`
      DELETE FROM "PasswordResetToken"
      WHERE "userId" = ${user.id} AND "usedAt" IS NULL
    `;

    await db.$executeRaw`
      INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "expiresAt", "createdAt")
      VALUES (${crypto.randomUUID()}, ${user.id}, ${tokenHash}, ${expiresAt}, NOW())
    `;

    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    // Envoi de l'email de réinitialisation
    await sendPasswordResetEmail({ to: user.email!, name: user.name ?? null, resetUrl }).catch((err) => {
      console.error('[forgot-password] Email non envoyé:', err);
    });

    // Optional in-app notification. Do not expose the link in production responses.
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Réinitialisation du mot de passe',
        message: 'Une demande de réinitialisation a été initiée pour votre compte.',
        type: 'IN_APP',
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: 'If this email exists, a reset link has been generated.',
      ...(process.env.NODE_ENV !== 'production' ? { resetUrl } : {}),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Unable to process request right now.' },
      { status: 500 }
    );
  }
}
