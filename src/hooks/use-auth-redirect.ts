'use client';

import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { normalizeRole } from '@/lib/roles';

export type UserRole = 'ADMIN' | 'TRANSPORTER' | 'RELAIS' | 'ENSEIGNE' | 'CLIENT';

export function useAuthRedirect(requiredRole: UserRole) {
  const { data: session, status, update } = useSession();
  const locale = useLocale();
  const router = useRouter();

  // Force session refresh on mount
  useEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
      return;
    }

    if (status === 'authenticated' && session?.user?.role) {
      const userRole = normalizeRole(session.user.role) as UserRole;
      const expectedRole = normalizeRole(requiredRole) as UserRole;
      
      if (userRole !== expectedRole) {
        // Redirect to correct dashboard
        const correctPath = getDashboardPath(userRole, locale);
        router.replace(correctPath);
      }
    }
  }, [status, session, router, locale, requiredRole]);

  return { session, status, isLoading: status === 'loading' };
}

export function getDashboardPath(role: UserRole, locale: string): string {
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
