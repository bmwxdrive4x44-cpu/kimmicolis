import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Permissions-Policy', value: 'camera=*, microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Exclude only Windows-local Prisma artifacts that bloat deployments.
  // Keep Linux query engines so Prisma can run in Vercel runtime.
  outputFileTracingExcludes: {
    '*': [
      './node_modules/.prisma/client/libquery_engine-*',
      './node_modules/@prisma/engines/**',
      './node_modules/prisma/libquery_engine-*',
      './node_modules/prisma/migration-engine-*',
      './node_modules/prisma/introspection-engine-*',
      './node_modules/prisma/fmt-*',
      './src/generated/prisma/query-engine-windows.exe',
      './src/generated/prisma/query-engine-windows.exe.tmp*',
      './src/generated/prisma/*.tmp*',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
