import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { SeoControlCenter } from '@/components/admin/seo-control-center';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

function getRoleDashboardPath(role: string, locale: string) {
  switch (role) {
    case 'ADMIN':
      return `/${locale}/dashboard/admin`;
    case 'TRANSPORTER':
      return `/${locale}/dashboard/transporter`;
    case 'RELAIS':
      return `/${locale}/dashboard/relais`;
    case 'ENSEIGNE':
      return `/${locale}/dashboard/enseigne`;
    case 'CLIENT':
    default:
      return `/${locale}/dashboard/client`;
  }
}

export default async function AdminSeoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${locale}/auth/login`);
  }

  if (session.user.role !== 'ADMIN') {
    redirect(getRoleDashboardPath(session.user.role, locale));
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#ecfdf5_42%,_#ecfeff_100%)]">
      <Header />
      <main>
        <SeoControlCenter locale={locale} />
      </main>
      <Footer />
    </div>
  );
}