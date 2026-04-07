import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect(`/${locale}/auth/login`);
  }
  
  // Redirect to the appropriate dashboard based on user role
  const role = session.user.role;
  
  switch (role) {
    case 'ADMIN':
      redirect(`/${locale}/dashboard/admin`);
    case 'TRANSPORTER':
      redirect(`/${locale}/dashboard/transporter`);
    case 'RELAIS':
      redirect(`/${locale}/dashboard/relais`);
    case 'ENSEIGNE':
      redirect(`/${locale}/dashboard/enseigne`);
    case 'CLIENT':
    default:
      redirect(`/${locale}/dashboard/client`);
  }
}
