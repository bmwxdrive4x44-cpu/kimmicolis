import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';

// next-intl middleware handles locale detection and redirects
const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Protect /api/admin/* at the edge (ADMIN role required) ──────────────
  if (pathname.startsWith('/api/admin')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

  // ── 2. Skip all other /api/* routes (per-handler requireRole handles them) ─
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── 3. Protect dashboard pages: redirect to login if no session ────────────
  const isDashboard = /\/(?:fr|ar|en|es)\/dashboard/.test(pathname);
  if (isDashboard) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      // Redirect to localized login page preserving the locale
      const localeMatch = pathname.match(/^\/(fr|ar|en|es)\//);
      const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/auth/login`, request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── 4. Apply next-intl middleware for all page routes ─────────────────────
  return intlMiddleware(request);
}

export const config = {
  // Match all paths except Next.js internals, static files, and _next
  matcher: [
    // API admin routes (need edge protection)
    '/api/admin/:path*',
    // All page routes (need intl + auth redirect)
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
