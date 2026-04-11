import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { verifyEmailVerificationToken } from '@/lib/email-verification';

function isRecordNotFoundError(error: unknown): boolean {
  const prismaCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error instanceof Error ? error.message : String(error || '');
  return prismaCode === 'P2025' || message.includes('No record was found for an update');
}

function getLoginPath(request: NextRequest, verified: '1' | '0', callbackUrl?: string) {
  const locale = request.nextUrl.searchParams.get('locale');
  const localePrefix = locale ? `/${locale}` : '';
  let path = `${localePrefix}/auth/login?verified=${verified}`;
  if (callbackUrl) {
    path += `&callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
  return path;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const payload = verifyEmailVerificationToken(token);

  if (!payload) {
    return NextResponse.redirect(new URL(getLoginPath(request, '0'), request.url));
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, isActive: true, role: true, relais: { select: { id: true } } },
  });

  if (!user || user.email.toLowerCase() !== payload.email) {
    return NextResponse.redirect(new URL(getLoginPath(request, '0'), request.url));
  }

  if (!user.isActive) {
    try {
      await db.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return NextResponse.redirect(new URL(getLoginPath(request, '0'), request.url));
      }
      throw error;
    }
  }

  // Si c'est un RELAIS ou TRANSPORTER sans enregistrement, renvoyer vers /pro pour finaliser
  const locale = request.nextUrl.searchParams.get('locale') || 'fr';
  const needsCompletion =
    (user.role === 'RELAIS' && !user.relais) ||
    user.role === 'TRANSPORTER';

  const callbackUrl = needsCompletion ? `/${locale}/pro` : undefined;

  return NextResponse.redirect(new URL(getLoginPath(request, '1', callbackUrl), request.url));
}
