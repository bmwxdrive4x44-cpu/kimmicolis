'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from './language-switcher';
import { Menu, LogOut, LayoutDashboard, Bell, BellDot, CheckCheck, Package, Truck, AlertCircle, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrandLogo } from '@/components/brand-logo';
import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

// ─── Notification Bell ───────────────────────────────────────────────────────
function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`);
      if (res.ok) setNotifications(await res.json());
    } catch { /* ignore */ }
  }, [userId]);

  // Initial fetch + polling every 15s
  useEffect(() => {
    const timeoutRef = setTimeout(() => {
      void fetchNotifications();
    }, 0);
    intervalRef.current = setInterval(fetchNotifications, 15_000);
    return () => {
      clearTimeout(timeoutRef);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) fetchNotifications();
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const markAllRead = async () => {
    setIsLoading(true);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, markAllRead: true }),
    });
    setIsLoading(false);
  };

  const typeIcon = (type: string, title: string) => {
    if (type === 'EMAIL') return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    if (title?.toLowerCase().includes('colis') || title?.toLowerCase().includes('parcel'))
      return <Package className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
    if (title?.toLowerCase().includes('transport') || title?.toLowerCase().includes('mission'))
      return <Truck className="h-4 w-4 text-orange-500 flex-shrink-0" />;
    if (title?.toLowerCase().includes('erreur') || title?.toLowerCase().includes('refus'))
      return <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    return <Bell className="h-4 w-4 text-slate-400 flex-shrink-0" />;
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1">
          {unreadCount > 0 ? (
            <BellDot className="h-5 w-5 text-emerald-600" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-[60] w-[22rem] overflow-hidden rounded-3xl border border-emerald-100/80 bg-white p-0 shadow-[0_24px_60px_-24px_rgba(5,150,105,0.35)] dark:border-emerald-900/40 dark:bg-slate-950" align="end">
        <div className="flex items-center justify-between border-b border-emerald-100/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-3 dark:border-emerald-900/40 dark:from-emerald-950 dark:via-slate-950 dark:to-teal-950">
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">Notifications {unreadCount > 0 && <span className="ml-1 text-xs text-red-500">({unreadCount} non lu{unreadCount > 1 ? 'es' : ''})</span>}</p>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-white/80 px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-60 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer lu
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.isRead) markAsRead(n.id); }}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 dark:hover:bg-slate-800/60 ${
                    n.isRead ? 'opacity-65' : 'bg-gradient-to-r from-emerald-50/90 to-teal-50/70 dark:from-emerald-900/20 dark:to-teal-900/10'
                  }`}
                >
                  <div className="mt-0.5">{typeIcon(n.type, n.title)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight truncate ${n.isRead ? 'font-normal' : 'font-semibold'}`}>{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const desktopNavRef = useRef<HTMLDivElement | null>(null);
  const desktopItemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [activeIndicator, setActiveIndicator] = useState<{ left: number; width: number; visible: boolean }>({
    left: 0,
    width: 0,
    visible: false,
  });

  const navItems = useMemo(() => [
    { href: '/', label: t('nav.home') },
    { href: '/pro', label: 'Espace pro' },
    { href: '/dashboard/client', label: t('nav.createParcel'), auth: true, roles: ['CLIENT'] },
    { href: '/contact', label: 'Contact' },
  ], [t]);

  const isActive = (path: string) => pathname === path;

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.auth && !session?.user) return false;
      if (item.roles && session?.user && !item.roles.includes(session.user.role)) return false;
      return true;
    });
  }, [navItems, session]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const activeItem = visibleNavItems.find((item) => isActive(item.href));
      const navEl = desktopNavRef.current;
      if (!activeItem || !navEl) {
        setActiveIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const activeEl = desktopItemRefs.current[activeItem.href];
      if (!activeEl) {
        setActiveIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const navRect = navEl.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const nextLeft = activeRect.left - navRect.left;
      const nextWidth = activeRect.width;
      setActiveIndicator((prev) => {
        if (prev.visible && prev.left === nextLeft && prev.width === nextWidth) {
          return prev;
        }
        return {
          left: nextLeft,
          width: nextWidth,
          visible: true,
        };
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [pathname, status, session?.user?.role, visibleNavItems]);

  const handleSignOut = async () => {
    // Clear local storage first
    localStorage.clear();
    sessionStorage.clear();
    
    // Use next-auth signOut - this properly clears the httpOnly cookie
    // and redirects to the callbackUrl
    await signOut({ 
      callbackUrl: `/${locale}`,
      redirect: true 
    });
  };

  const getDashboardLink = () => {
    if (!session?.user) return null;
    switch (session.user.role) {
      case 'CLIENT':
        return '/dashboard/client';
      case 'TRANSPORTER':
        return '/dashboard/transporter';
      case 'RELAIS':
        return '/dashboard/relais';
      case 'ENSEIGNE':
        return '/dashboard/enseigne';
      case 'ADMIN':
        return '/dashboard/admin';
      default:
        return '/dashboard/client';
    }
  };

  // Show loading skeleton only for initial auth check
  if (status === 'loading') {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-emerald-100/70 bg-white/85 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:border-emerald-900/40 dark:bg-slate-950/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <BrandLogo />
        </div>
      </header>
    );
  }

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-emerald-100/70 backdrop-blur-xl transition-all duration-300 supports-[backdrop-filter]:bg-white/75 dark:border-emerald-900/40 dark:bg-slate-950/80 ${
      isScrolled ? 'bg-white/92 shadow-md shadow-emerald-900/5' : 'bg-white/80 shadow-sm'
    }`}>
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <BrandLogo />

        {/* Desktop Navigation */}
        <nav
          ref={desktopNavRef}
          className="relative hidden md:flex items-center gap-1 rounded-2xl border border-emerald-100/80 bg-white/70 p-1 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/60"
        >
          <span
            className={`pointer-events-none absolute top-1 bottom-1 rounded-xl bg-emerald-100/90 shadow-sm transition-all duration-300 dark:bg-emerald-900/35 ${activeIndicator.visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ left: activeIndicator.left, width: activeIndicator.width }}
          />
          {visibleNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  desktopItemRefs.current[item.href] = el;
                }}
                className={`relative px-3 py-2 text-sm font-semibold rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-1 ${
                  active
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-emerald-50/90 hover:shadow-sm dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-600" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {session?.user ? (
            <>
              <Link href={getDashboardLink() || '/dashboard/client'}>
                <Button variant="ghost" size="sm" className="hidden md:flex gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  {t('common.dashboard')}
                </Button>
              </Link>
              <NotificationBell userId={session.user.id} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 rounded-full border border-emerald-100 bg-white/80 px-1.5 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-emerald-900/40 dark:bg-slate-900/70 dark:hover:bg-emerald-950/30">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        {session.user.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-[60] w-72 overflow-hidden rounded-3xl border border-emerald-100/80 bg-white p-0 shadow-[0_24px_60px_-24px_rgba(5,150,105,0.45)] dark:border-emerald-900/40 dark:bg-slate-950" align="end" forceMount>
                  <DropdownMenuLabel className="border-b border-emerald-100/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-4 font-normal dark:border-emerald-900/40 dark:from-emerald-950 dark:via-slate-950 dark:to-teal-950">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-11 w-11 border border-white/80 shadow-sm">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-semibold text-white">
                          {session.user.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1.5">
                        <p className="truncate text-sm font-semibold leading-none text-slate-900 dark:text-white">{session.user.name}</p>
                        <p className="truncate text-xs leading-none text-slate-500 dark:text-slate-400">{session.user.email}</p>
                        <Badge variant="outline" className="w-fit border-emerald-200 bg-white/80 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                        {session.user.role}
                        </Badge>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <div className="p-2">
                    <DropdownMenuItem asChild className="rounded-2xl px-3 py-3 text-slate-700 outline-none transition-colors focus:bg-emerald-50 focus:text-emerald-900 dark:text-slate-200 dark:focus:bg-emerald-950/30 dark:focus:text-emerald-200">
                      <Link href={getDashboardLink() || '/dashboard/client'} className="flex cursor-pointer items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <LayoutDashboard className="h-4 w-4" />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium">{t('common.dashboard')}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Accéder à votre espace</span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator className="bg-emerald-100/80 dark:bg-emerald-900/40" />
                  <div className="p-2 pt-2">
                    <DropdownMenuItem onClick={handleSignOut} className="rounded-2xl px-3 py-3 text-red-600 outline-none transition-colors focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-950/30 dark:focus:text-red-300">
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                        <LogOut className="h-4 w-4" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{t('common.logout')}</span>
                        <span className="text-xs text-red-500/80 dark:text-red-300/80">Fermer la session en toute sécurité</span>
                      </span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  {t('nav.login')}
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  {t('nav.register')}
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="rounded-xl border border-emerald-100/70 bg-white/80 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/70">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
              <SheetContent side="right" className="w-80 border-l border-emerald-100/80 bg-white/95 backdrop-blur-xl dark:border-emerald-900/40 dark:bg-slate-950/95">
              <div className="mt-4 flex flex-col gap-3">
                {/* Logo in sheet */}
                  <div className="border-b border-emerald-100/80 pb-3 dark:border-emerald-900/40">
                  <BrandLogo />
                </div>

                {/* Nav items */}
                <nav className="flex flex-col gap-1">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Navigation</p>
                  {visibleNavItems.map((item) => {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-1 ${
                          isActive(item.href)
                            ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-emerald-50/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-emerald-950/20'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isActive(item.href) && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                      </Link>
                    );
                  })}
                </nav>

                <div className="border-t border-emerald-100/80 pt-3 dark:border-emerald-900/40">
                  {session?.user ? (
                    <>
                      <div className="flex items-center gap-3 rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 p-3 pb-3 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-teal-950/30">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-semibold">
                            {session.user.name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{session.user.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{session.user.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 pt-3">
                        <Link
                          href={getDashboardLink() || '/dashboard/client'}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-emerald-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-1 dark:text-slate-200 dark:hover:bg-emerald-950/25"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          {t('common.dashboard')}
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-1 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <LogOut className="h-4 w-4" />
                          {t('common.logout')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link href="/auth/login" onClick={() => setIsOpen(false)}>
                        <Button variant="outline" className="w-full">
                          {t('nav.login')}
                        </Button>
                      </Link>
                      <Link href="/auth/register" onClick={() => setIsOpen(false)}>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                          {t('nav.register')}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
