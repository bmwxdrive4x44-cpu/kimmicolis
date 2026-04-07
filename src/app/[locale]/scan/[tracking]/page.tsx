import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { extractTrackingFromQrPayload } from '@/lib/qr-payload';

interface ScanLandingPageProps {
  params: Promise<{ locale: string; tracking: string }>;
}

export default async function ScanLandingPage({ params }: ScanLandingPageProps) {
  const { locale, tracking: rawTracking } = await params;

  // Decode URL-encoded tracking and extract normalized tracking number
  const decoded = decodeURIComponent(rawTracking);
  const trackingNumber = extractTrackingFromQrPayload(decoded) ?? decoded.toUpperCase();

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    const callbackUrl = `/${locale}/scan/${encodeURIComponent(trackingNumber)}`;
    redirect(`/${locale}/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const role = (session.user as any).role as string;

  switch (role) {
    case 'RELAIS':
      redirect(`/${locale}/dashboard/relais?scan=${encodeURIComponent(trackingNumber)}&tab=scan`);
    case 'TRANSPORTER':
      redirect(`/${locale}/dashboard/transporter?scan=${encodeURIComponent(trackingNumber)}&tab=scan`);
    case 'ADMIN':
      redirect(`/${locale}/dashboard/admin?scan=${encodeURIComponent(trackingNumber)}`);
    case 'CLIENT':
    default:
      redirect(`/${locale}/dashboard/client?track=${encodeURIComponent(trackingNumber)}&tab=track`);
  }
}
