import Link from 'next/link';
import { Suspense } from 'react';
import { OnboardingOrgsShell } from '@/app/admin/onboarding/components/OnboardingOrgsShell';
import { OnboardingListRealtimeRefresh } from '@/app/admin/onboarding/components/OnboardingListRealtimeRefresh';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { OrgDashboardRow } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function OnboardingOrgsPage() {
  const admin = getSupabaseAdmin();

  const { data: staffList } = await admin.from('staff').select('id, name').order('name');

  const { data: viewRows } = await admin
    .from('org_dashboard')
    .select('*')
    .order('last_activity', { ascending: false, nullsFirst: false });

  const rows = (viewRows ?? []) as OrgDashboardRow[];

  const base = `${ONBOARDING_BASE}/orgs`;

  return (
    <div className="space-y-8">
      <OnboardingListRealtimeRefresh />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Organizations</h1>
          <p className="mt-1 text-sm text-gray-600">Search and manage onboarding organizations.</p>
        </div>
        <Link
          href={`${ONBOARDING_BASE}/orgs/new`}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          New org
        </Link>
      </div>

      <Suspense
        fallback={
          <p className="text-sm text-gray-500" aria-busy="true">
            Loading list…
          </p>
        }
      >
        <OnboardingOrgsShell rows={rows} staffList={staffList ?? []} basePath={base} />
      </Suspense>
    </div>
  );
}
