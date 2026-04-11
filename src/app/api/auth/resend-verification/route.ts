import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { sendRegistrationConfirmationEmail } from '@/lib/email';
import { createEmailVerificationToken } from '@/lib/email-verification';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.strict);
  if (rateCheck.limited) {
    return NextResponse.json(
      {
        success: true,
        message: 'Si ce compte existe, un email de confirmation a ete envoye.',
        retryAfter: rateCheck.retryAfter,
      },
      {
        status: 200,
        headers: {
          'Retry-After': String(rateCheck.retryAfter || 0),
        },
      }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const normalizedEmail = String(body?.email || '').trim().toLowerCase();
    const locale = String(body?.locale || 'fr').trim() || 'fr';

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({
        success: true,
        message: 'Si ce compte existe, un email de confirmation a ete envoye.',
      });
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (user && !user.isActive && user.role !== 'ADMIN') {
      const token = createEmailVerificationToken({
        userId: user.id,
        email: user.email,
      });
      const verificationUrl = `${request.nextUrl.origin}/api/auth/verify-email?token=${encodeURIComponent(token)}&locale=${encodeURIComponent(locale)}`;

      try {
        await sendRegistrationConfirmationEmail({
          to: user.email,
          name: user.name,
          role: user.role,
          verificationUrl,
        });
      } catch (emailError) {
        console.error('[auth/resend-verification] Echec envoi email:', emailError);
        const isDev = process.env.NODE_ENV === 'development';
        return NextResponse.json(
          {
            success: false,
            message: "L'email n'a pas pu etre envoye. Verifiez la configuration email du serveur.",
            ...(isDev && { debug: String(emailError instanceof Error ? emailError.message : emailError) }),
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Si ce compte existe, un email de confirmation a ete envoye.',
    });
  } catch (error) {
    console.error('[auth/resend-verification] error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Une erreur est survenue. Reessayez dans un instant.',
      },
      { status: 500 }
    );
  }
}
