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
import { Menu, LogOut, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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
