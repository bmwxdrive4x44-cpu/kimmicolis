import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

import { normalizeRole } from '@/lib/roles';

type TransporterApplicationStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'MISSING';

type TransporterDashboardStats = {
  trajets: number;
  totalMissions: number;
  activeMissions: number;
  assignedMissions: number;
  inProgressMissions: number;
  completedMissions: number;
  earnings: number;
};

const initialStats: TransporterDashboardStats = {
  trajets: 0,
  totalMissions: 0,
  activeMissions: 0,
  assignedMissions: 0,
  inProgressMissions: 0,
  completedMissions: 0,
  earnings: 0,
};

function getRoleBasedDashboardPath(role: string, locale: string): string {
  switch (role) {
    case 'ADMIN': return `/${locale}/dashboard/admin`;
    case 'TRANSPORTER': return `/${locale}/dashboard/transporter`;
    case 'RELAIS': return `/${locale}/dashboard/relais`;
    case 'ENSEIGNE': return `/${locale}/dashboard/enseigne`;
    default: return `/${locale}/dashboard/client`;
  }
}

export function useTransporterDashboardController() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const router = useRouter();

  const [stats, setStats] = useState<TransporterDashboardStats>(initialStats);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<TransporterApplicationStatus>('MISSING');

  const userId = session?.user?.id || null;
  const userName = session?.user?.name || '';

  const refreshStats = useCallback(async (background = false) => {
    if (!userId) return;

    if (!background) {
      setIsInitialLoading(true);
    }

    try {
      const res = await fetch(`/api/dashboard/transporter/${userId}`);
      const data = (await res.json().catch(() => null)) as {
        profileStatus?: string;
        kpi?: Record<string, unknown>;
        trajetCount?: number;
      } | null;

      const kpi = data?.kpi ?? {};
      setStats({
        trajets: Number(data?.trajetCount ?? 0),
        totalMissions: Number(kpi.missionsTotal ?? 0),
        activeMissions: Number(kpi.missionsActive ?? 0),
        assignedMissions: Number(kpi.missionsAssigned ?? 0),
        inProgressMissions: Number(kpi.missionsInProgress ?? 0),
        completedMissions: Number(kpi.missionsCompleted ?? 0),
        earnings: Number(kpi.earningsTotal ?? 0),
      });

      // Sync du statut profil depuis le view-model
      if (data?.profileStatus) {
        const status = data.profileStatus as typeof applicationStatus;
        setApplicationStatus(status);
        setHasProfile(status !== 'MISSING');
        if (status === 'MISSING') {
          router.push(`/${locale}/complete-profile/transporter`);
        }
      }

      setKpiLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setKpiLoading(false);
    } finally {
      if (!background) {
        setIsInitialLoading(false);
      }
    }
  }, [userId, locale, router]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${locale}/auth/login`);
      return;
    }

    if (status === 'authenticated' && session?.user?.role) {
      const userRole = normalizeRole(session.user.role);
      if (userRole !== 'TRANSPORTER') {
        router.replace(getRoleBasedDashboardPath(userRole, locale));
      }
    }
  }, [status, session, router, locale]);

  // Chargement initial : le view-model retourne profil + KPI en un seul appel
  useEffect(() => {
    if (status === 'authenticated' && userId) {
      void refreshStats(false);
    }
  }, [status, userId, refreshStats]);

  useEffect(() => {
    if (!userId) return;

    const intervalId = window.setInterval(() => {
      void refreshStats(true);
    }, 15000);

    const handleFocus = () => {
      void refreshStats(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId, refreshStats]);

  const isDashboardLoading =
    status === 'loading' || isInitialLoading;

  const isTransporterSession = Boolean(session?.user && normalizeRole(session.user.role) === 'TRANSPORTER');
  const shouldRenderNull = !isTransporterSession || !hasProfile;

  const completionRate = useMemo(() => {
    if (stats.totalMissions <= 0) return 0;
    return Math.round((stats.completedMissions / stats.totalMissions) * 100);
  }, [stats.totalMissions, stats.completedMissions]);

  const goToProfileCompletion = useCallback(() => {
    router.push(`/${locale}/complete-profile/transporter`);
  }, [router, locale]);

  return {
    status,
    userId,
    userName,
    stats,
    kpiLoading,
    applicationStatus,
    isDashboardLoading,
    shouldRenderNull,
    completionRate,
    refreshStats,
    goToProfileCompletion,
  };
}
