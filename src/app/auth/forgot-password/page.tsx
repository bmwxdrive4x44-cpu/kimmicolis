import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AuthForgotPasswordRedirectPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'fr';
  redirect(`/${locale}/auth/forgot-password`);
}
