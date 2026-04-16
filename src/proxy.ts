import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { env, getAllowedCorsOrigins } from '@/lib/env';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Autorise la caméra pour tous les contextes same-origin (camera=* est plus compatible que camera=(self)).
  'Permissions-Policy': 'camera=*, microphone=(), geolocation=()'
};

function applyApiCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return response;
  }

  if (getAllowedCorsOrigins().has(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With, X-Cron-Secret');
    response.headers.set('Vary', 'Origin');
  }

  return response;
}

function finalizeResponse(request: NextRequest, response: NextResponse) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  response.headers.set('X-Request-Id', crypto.randomUUID());

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return applyApiCorsHeaders(request, response);
  }

  return response;
}

function isRateLimitBypassed(pathname: string) {
  return /\/api\/(?:.*\/)?(?:webhook|cron)(?:\/|$)/.test(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/') && request.method === 'OPTIONS') {
    return finalizeResponse(request, new NextResponse(null, { status: 204 }));
  }

  if (pathname.startsWith('/api/') && !isRateLimitBypassed(pathname)) {
    const rateLimit = await checkRateLimit(request, RATE_LIMIT_PRESETS.public);
    if (rateLimit.limited) {
      return finalizeResponse(
        request,
        NextResponse.json(
          { error: 'Too many requests. Please try again later.', retryAfter: rateLimit.retryAfter },
          { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
        )
      );
    }
  }

  if (pathname.startsWith('/api/admin')) {
    const token = await getToken({
      req: request,
      secret: env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return finalizeResponse(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    if (token.role !== 'ADMIN') {
      return finalizeResponse(request, NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      ));
    }

    return finalizeResponse(request, NextResponse.next());
  }

  if (pathname.startsWith('/api/')) {
    return finalizeResponse(request, NextResponse.next());
  }

  const isDashboard = /\/(?:fr|ar|en|es)\/dashboard/.test(pathname);
  if (isDashboard) {
    const token = await getToken({
      req: request,
      secret: env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const localeMatch = pathname.match(/^\/(fr|ar|en|es)\//);
      const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/auth/login`, request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return finalizeResponse(request, NextResponse.redirect(loginUrl));
    }
  }

    // Redirect authenticated users away from login/register pages
    const isAuthPage = /\/(?:fr|ar|en|es)\/auth\/(login|register|forgot-password|reset-password)/.test(pathname);
    if (isAuthPage) {
      const token = await getToken({
        req: request,
        secret: env.NEXTAUTH_SECRET,
      });

      if (token) {
        const localeMatch = pathname.match(/^\/(fr|ar|en|es)\//);
        const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
        const userRole = token.role as string;

        let targetPath = `/${locale}/dashboard/client`;
        if (userRole === 'ADMIN') targetPath = `/${locale}/dashboard/admin`;
        else if (userRole === 'TRANSPORTER') targetPath = `/${locale}/dashboard/transporter`;
        else if (userRole === 'RELAIS') targetPath = `/${locale}/dashboard/relais`;
        else if (userRole === 'ENSEIGNE') targetPath = `/${locale}/dashboard/enseigne`;

        return finalizeResponse(request, NextResponse.redirect(new URL(targetPath, request.url)));
      }
    }

    return finalizeResponse(request, intlMiddleware(request));
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/((?!_next|_vercel|.*\..*).*)',
  ],
};
