import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export async function GET() {
  // Obtenir le locale des cookies ou utiliser le défaut
  try {
    const cookieStore = await cookies();
    const locale = cookieStore.get('NEXT_LOCALE')?.value || 'fr';
    redirect(`/${locale}/auth/login`);
  } catch {
    redirect('/fr/auth/login');
  }
}
