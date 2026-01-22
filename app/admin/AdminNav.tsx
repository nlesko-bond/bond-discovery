'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function AdminNav() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/admin/login' })}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <LogOut size={16} />
      Sign out
    </button>
  );
}
