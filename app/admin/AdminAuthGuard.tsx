'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { isAdminAuthBypassEnabled } from '@/lib/admin-auth-bypass';

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const bypassAuth = isAdminAuthBypassEnabled();

  useEffect(() => {
    if (bypassAuth) return;
    if (pathname === '/admin/login') return;
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [bypassAuth, status, router, pathname]);

  if (bypassAuth) {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <RefreshCw className="animate-spin text-gray-400 mx-auto mb-4" size={32} />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Show nothing while redirecting to login
  if (status === 'unauthenticated' && pathname !== '/admin/login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <RefreshCw className="animate-spin text-gray-400 mx-auto mb-4" size={32} />
          <p className="text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }
  
  // Render children if authenticated or on login page
  return <>{children}</>;
}
