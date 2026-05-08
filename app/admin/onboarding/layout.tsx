import type { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isAdminAuthBypassEnabled } from '@/lib/admin-auth-bypass';
import { getSupabaseAdmin } from '@/lib/supabase';
import { OnboardingSubNav } from './components/OnboardingSubNav';

export default async function OnboardingSectionLayout({ children }: { children: ReactNode }) {
  if (isAdminAuthBypassEnabled()) {
    return (
      <div>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Onboarding: session and staff checks are skipped while admin auth bypass is enabled locally.
        </div>
        <OnboardingSubNav />
        {children}
      </div>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect('/admin/login');
  }

  const admin = getSupabaseAdmin();
  const { data: staff } = await admin
    .from('staff')
    .select('id, name, email, role')
    .eq('email', session.user.email)
    .maybeSingle();

  if (!staff) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Onboarding access</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your Google account is not listed in the onboarding staff table. Ask an admin to add{' '}
          <strong>{session.user.email}</strong> under Onboarding → Team.
        </p>
      </div>
    );
  }

  return (
    <div>
      <OnboardingSubNav />
      {children}
    </div>
  );
}
