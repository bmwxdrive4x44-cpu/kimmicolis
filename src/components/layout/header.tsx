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
import {
  Package,
  Menu,
  User,
  Truck,
  Store,
  Settings,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Set loaded after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasLoaded(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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

  // Show loading state only for initial auth check
  if (status === 'loading' && !hasLoaded) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Package className="h-8 w-8 text-emerald-600" />
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              SwiftColis
            </span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Package className="h-8 w-8 text-emerald-600" />
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            SwiftColis
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            if (item.auth && !session?.user) return null;
            if (item.roles && session?.user && !item.roles.includes(session.user.role)) return null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-emerald-600 ${
                  isActive(item.href) ? 'text-emerald-600' : 'text-muted-foreground'
                }`}
              >
                {item.label}
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
              <div className="flex flex-col gap-4 mt-8">
                {session?.user ? (
                  <>
                    <div className="flex items-center gap-3 pb-4 border-b">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-emerald-600 text-white">
                          {session.user.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{session.user.name}</p>
                        <p className="text-sm text-muted-foreground">{session.user.email}</p>
                      </div>
                    </div>
                    <Link
                      href={getDashboardLink() || '/dashboard/client'}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 p-2 hover:bg-accent rounded-md"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      {t('common.dashboard')}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 p-2 hover:bg-accent rounded-md text-red-600"
                    >
                      <LogOut className="h-5 w-5" />
                      {t('common.logout')}
                    </button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
