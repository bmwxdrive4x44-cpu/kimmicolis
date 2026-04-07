import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AuthResetPasswordRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ? encodeURIComponent(params.token) : '';
  const email = params.email ? encodeURIComponent(params.email) : '';
  const query = `?token=${token}&email=${email}`;

  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'fr';
  redirect(`/${locale}/auth/reset-password${query}`);
}
