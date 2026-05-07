import '@/app/globals.css';
import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'SwiftColis',
  title: {
    default: 'SwiftColis',
    template: '%s | SwiftColis',
  },
  description:
    'SwiftColis simplifie la livraison de colis en Algerie avec suivi, reseau de points relais et transporteurs verifies.',
  openGraph: {
    type: 'website',
    siteName: 'SwiftColis',
    title: 'SwiftColis',
    description:
      'Plateforme de livraison de colis en Algerie pour clients, commerçants, transporteurs et relais.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SwiftColis',
    description:
      'Livraison de colis en Algerie avec suivi temps reel et logistique relais.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
