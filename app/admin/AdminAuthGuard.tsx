'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // Don't redirect if we're already on the login page
    if (pathname === '/admin/login') return;
    
    // Redirect to login if not authenticated
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router, pathname]);
  
  // Show loading while checking auth
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
