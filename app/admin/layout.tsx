import Link from 'next/link';
import { 
  LayoutDashboard,
  Users,
  FileText,
  HelpCircle
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
        {/* Top Navigation */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-xl font-bold text-gray-900">
                Bond Discovery Admin
              </h1>
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
