'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { 
  LayoutDashboard,
  Users,
  FileText,
  HelpCircle,
  LogOut,
  User
} from 'lucide-react';
import { AdminProviders } from './AdminProviders';
import { AdminAuthGuard } from './AdminAuthGuard';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  
  // Don't show the full layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">
              Bond Discovery Admin
            </h1>
            
            {/* User Menu */}
            {session?.user && (
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
                  onClick={() => signOut({ callbackUrl: '/admin/login' })}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] sticky top-16 hidden md:block">
          <nav className="p-4 space-y-1">
            <NavLink href="/admin" icon={LayoutDashboard}>
              Dashboard
            </NavLink>
            <NavLink href="/admin/partners" icon={Users}>
              Partner Groups
            </NavLink>
            <NavLink href="/admin/pages" icon={FileText}>
              Discovery Pages
            </NavLink>
            
            <div className="pt-4 mt-4 border-t border-gray-200">
              <NavLink href="/admin/help" icon={HelpCircle}>
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
  href, 
  icon: Icon, 
  children 
}: { 
  href: string; 
  icon: React.ComponentType<any>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      <Icon size={20} className="text-gray-500" />
      <span className="font-medium">{children}</span>
    </Link>
  );
}
