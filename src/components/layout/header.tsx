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
import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Initial fetch + polling every 60s
  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
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
      <DropdownMenuContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifications {unreadCount > 0 && <span className="ml-1 text-xs text-red-500">({unreadCount} non lu{unreadCount > 1 ? 'es' : ''})</span>}</p>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={isLoading}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
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
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                    n.isRead ? 'opacity-60' : 'bg-emerald-50/50 dark:bg-emerald-900/10'
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

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" strokeWidth={2}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 22V12h8v10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13 7h2M13 10h2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/>
        </svg>
      </div>
      <span className="text-[1.1rem] font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
        Swift<span className="text-gray-800 dark:text-white">Colis</span>
      </span>
    </Link>
  );
}

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: '/', label: t('nav.home') },
    { href: '/become-relay', label: t('nav.becomeRelay') },
    { href: '/become-transporter', label: t('nav.becomeTransporter') },
    { href: '/dashboard/client', label: t('nav.createParcel'), auth: true, roles: ['CLIENT'] },
  ];

  const isActive = (path: string) => pathname === path;

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
      case 'ADMIN':
        return '/dashboard/admin';
      default:
        return '/dashboard/client';
    }
  };

  // Show loading skeleton only for initial auth check
  if (status === 'loading') {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Logo />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            if (item.auth && !session?.user) return null;
            if (item.roles && session?.user && !item.roles.includes(session.user.role)) return null;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-500" />
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
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-emerald-600 text-white">
                        {session.user.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                      <Badge variant="outline" className="w-fit mt-1 text-xs">
                        {session.user.role}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={getDashboardLink() || '/dashboard/client'} className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {t('common.dashboard')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('common.logout')}
                  </DropdownMenuItem>
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
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="flex flex-col gap-4 mt-6">
                {/* Logo in sheet */}
                <div className="pb-4 border-b">
                  <Logo />
                </div>

                {/* Nav items */}
                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => {
                    if (item.auth && !session?.user) return null;
                    if (item.roles && session?.user && !item.roles.includes(session.user.role)) return null;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive(item.href)
                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="border-t pt-4">
                  {session?.user ? (
                    <>
                      <div className="flex items-center gap-3 pb-4 border-b">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-emerald-600 text-white text-sm font-semibold">
                            {session.user.name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{session.user.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{session.user.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 pt-4">
                        <Link
                          href={getDashboardLink() || '/dashboard/client'}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md text-sm font-medium"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          {t('common.dashboard')}
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md text-red-600 text-sm font-medium w-full text-left"
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
