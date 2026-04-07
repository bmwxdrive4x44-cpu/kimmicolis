import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { validatePassword } from '@/lib/validators';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

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
    const email = String(body?.email || '').trim().toLowerCase();
    const token = String(body?.token || '').trim();
    const password = String(body?.password || '');

    if (!email || !token || !password) {
      return NextResponse.json(
        { error: 'Email, token and password are required.' },
        { status: 400 }
      );
    }

    if (!validatePassword(password)) {
      return NextResponse.json(
        { error: 'Password is too weak.' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token.' },
        { status: 400 }
      );
    }

    const tokenHash = sha256(token);
    const matches = await db.$queryRaw<Array<{ id: string; expiresAt: Date; usedAt: Date | null; userId: string }>>`
      SELECT "id", "expiresAt", "usedAt", "userId"
      FROM "PasswordResetToken"
      WHERE "tokenHash" = ${tokenHash}
      LIMIT 1
    `;

    const resetRow = matches[0];
    if (!resetRow || resetRow.userId !== user.id || resetRow.usedAt !== null) {
      return NextResponse.json(
        { error: 'Invalid or expired token.' },
        { status: 400 }
      );
    }

    if (new Date(resetRow.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Invalid or expired token.' },
        { status: 400 }
      );
    }

    const hashed = await hashPassword(password);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashed },
      });

      await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = NOW()
        WHERE "id" = ${resetRow.id}
      `;

      await tx.$executeRaw`
        DELETE FROM "PasswordResetToken"
        WHERE "userId" = ${user.id} AND "id" <> ${resetRow.id}
      `;

      await tx.notification.create({
        data: {
          userId: user.id,
          title: 'Mot de passe modifié',
          message: 'Votre mot de passe a été réinitialisé avec succès.',
          type: 'IN_APP',
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Unable to reset password right now.' },
      { status: 500 }
    );
  }
}
