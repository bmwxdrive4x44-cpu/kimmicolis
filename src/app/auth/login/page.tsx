import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function AuthLoginRedirectPage() {
  const locale = cookies().get('NEXT_LOCALE')?.value || 'fr';
  redirect(`/${locale}/auth/login`);
}
