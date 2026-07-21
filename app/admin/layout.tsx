'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  FileText,
  BookOpen,
  HelpCircle,
  LogOut,
  User,
  BarChart3,
  CreditCard,
  CalendarDays,
  ClipboardList,
  ListChecks,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOND_LOGO_URL } from '@/lib/onboarding/bond-brand';
import { isAdminAuthBypassEnabled } from '@/lib/admin-auth-bypass';
import { AdminProviders } from './AdminProviders';
import { AdminAuthGuard } from './AdminAuthGuard';

function isNavLinkActive(pathname: string, href: string, activePrefix?: string): boolean {
  if (activePrefix) {
    return pathname === activePrefix || pathname.startsWith(`${activePrefix}/`);
  }
  if (href === '/admin') {
    return pathname === '/admin' || pathname === '/admin/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NAV_COLLAPSED_KEY = 'bond_admin_nav_collapsed';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const bypassAuth = isAdminAuthBypassEnabled();
  const [navCollapsed, setNavCollapsed] = useState(false);

  // Restore the preference after mount (SSR renders expanded; avoids hydration mismatch).
  useEffect(() => {
    setNavCollapsed(window.localStorage.getItem(NAV_COLLAPSED_KEY) === '1');
  }, []);

  function toggleNav() {
    setNavCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {bypassAuth ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900">
          Local dev: admin auth bypass is on (<code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_ADMIN_AUTH_BYPASS</code>
          ). Do not use in production.
        </div>
      ) : null}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">
              Bond Discovery Admin
            </h1>

            {session?.user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <User size={20} className="text-gray-400" />
                  )}
                  <span className="hidden sm:inline">{session.user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/admin/login' })}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : bypassAuth ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User size={20} className="text-gray-400" />
                <span className="hidden sm:inline">Not signed in (bypass)</span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            'bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] sticky top-16 hidden md:block shrink-0 transition-[width] duration-200',
            navCollapsed ? 'w-16' : 'w-64',
          )}
        >
          <nav className={cn('space-y-1', navCollapsed ? 'p-2' : 'p-4')}>
            {navCollapsed ? (
              <>
                <Link
                  href="/admin"
                  title="Bond Sports — Dashboard"
                  className="flex justify-center rounded-lg py-2 hover:bg-gray-100"
                >
                  {/* Left-edge crop of the wordmark = the "B" mark. */}
                  <span className="block h-7 w-7 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- brand asset, remote CDN */}
                    <img src={BOND_LOGO_URL} alt="Bond Sports" className="h-7 w-auto max-w-none" />
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={toggleNav}
                  aria-label="Expand navigation"
                  className="flex w-full justify-center rounded-lg py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <PanelLeftOpen size={20} />
                </button>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 px-1 py-1">
                <Link href="/admin" title="Dashboard" className="rounded-lg p-1 hover:bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element -- brand asset, remote CDN */}
                  <img src={BOND_LOGO_URL} alt="Bond Sports" className="h-8 w-auto" />
                </Link>
                <button
                  type="button"
                  onClick={toggleNav}
                  aria-label="Collapse navigation"
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <PanelLeftClose size={20} />
                </button>
              </div>
            )}
            <div className="!my-2 border-t border-gray-200" />
            <NavLink pathname={pathname} href="/admin" icon={LayoutDashboard} collapsed={navCollapsed}>
              Dashboard
            </NavLink>
            <NavLink pathname={pathname} href="/admin/partners" icon={Users} collapsed={navCollapsed}>
              Partner Groups
            </NavLink>
            <NavLink pathname={pathname} href="/admin/pages" icon={FileText} collapsed={navCollapsed}>
              Discovery Pages
            </NavLink>
            <NavLink pathname={pathname} href="/admin/documentation" icon={BookOpen} collapsed={navCollapsed}>
              Documentation
            </NavLink>
            <NavLink pathname={pathname} href="/admin/memberships" icon={CreditCard} collapsed={navCollapsed}>
              Memberships
            </NavLink>
            <NavLink pathname={pathname} href="/admin/reservation-pages" icon={CalendarDays} collapsed={navCollapsed}>
              Reservation pages
            </NavLink>
            <NavLink pathname={pathname} href="/admin/tvmonitor" icon={MonitorPlay} collapsed={navCollapsed}>
              TV Monitors
            </NavLink>
            <NavLink pathname={pathname} href="/admin/form-pages" icon={ClipboardList} collapsed={navCollapsed}>
              Form responses
            </NavLink>
            <NavLink
              pathname={pathname}
              href="/admin/onboarding/dashboard"
              activePrefix="/admin/onboarding"
              icon={ListChecks}
              collapsed={navCollapsed}
            >
              Onboarding
            </NavLink>
            <NavLink pathname={pathname} href="/admin/analytics" icon={BarChart3} collapsed={navCollapsed}>
              Analytics
            </NavLink>

            <div className="pt-4 mt-4 border-t border-gray-200">
              <NavLink pathname={pathname} href="/admin/help" icon={HelpCircle} collapsed={navCollapsed}>
                Help & Docs
              </NavLink>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProviders>
      <AdminAuthGuard>
        <AdminLayoutContent>
          {children}
        </AdminLayoutContent>
      </AdminAuthGuard>
    </AdminProviders>
  );
}

function NavLink({
  pathname,
  href,
  activePrefix,
  icon: Icon,
  children,
  collapsed = false,
}: {
  pathname: string;
  href: string;
  activePrefix?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  const active = isNavLinkActive(pathname, href, activePrefix);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={collapsed && typeof children === 'string' ? children : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-gray-100 text-gray-900 ring-1 ring-inset ring-gray-900/10 shadow-sm'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      <Icon size={20} className={cn('shrink-0', active ? 'text-gray-900' : 'text-gray-500')} />
      {!collapsed && <span className={cn('font-medium', active && 'font-semibold')}>{children}</span>}
    </Link>
  );
}
