import { Suspense } from 'react';
import { OnboardingListRealtimeRefresh } from '@/app/admin/onboarding/components/OnboardingListRealtimeRefresh';
import { OnboardingDashboardShell } from '@/app/admin/onboarding/components/OnboardingDashboardShell';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { OrgDashboardRow } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function OnboardingDashboardPage() {
  const admin = getSupabaseAdmin();

  const { data: staffList } = await admin.from('staff').select('id, name').order('name');

  const { data: viewRows } = await admin
    .from('org_dashboard')
    .select('*')
    .order('last_activity', { ascending: false, nullsFirst: false });

  const rows = (viewRows ?? []) as OrgDashboardRow[];

  const weekAgo = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;

  const activeOrgs = rows.filter((r) => r.status === 'active');
  const totalActive = activeOrgs.length;
  const avgCompletion =
    activeOrgs.length > 0
      ? Math.round(
          activeOrgs.reduce((a, r) => a + (r.completion_pct ?? 0), 0) / activeOrgs.length,
        )
      : 0;
  const completedThisWeek = rows.filter(
    (r) => r.completed_at && new Date(r.completed_at).getTime() >= weekAgo,
  ).length;
  const stalled = rows.filter((r) => {
    if (r.status !== 'active') return false;
    if (!r.last_activity) return true;
    return new Date(r.last_activity).getTime() < weekAgo;
  }).length;

  const base = `${ONBOARDING_BASE}/dashboard`;

  return (
    <div className="space-y-8">
      <OnboardingListRealtimeRefresh />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Onboarding dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Overview of onboarding progress across organizations.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Active Orgs" value={totalActive} />
        <StatCard label="Avg Completion %" value={avgCompletion} />
        <StatCard label="Completed This Week" value={completedThisWeek} />
        <StatCard label="Stalled (7+ days)" value={stalled} />
      </div>

      <Suspense
        fallback={
          <p className="text-sm text-gray-500" aria-busy="true">
            Loading filters…
          </p>
        }
      >
        <OnboardingDashboardShell rows={rows} staffList={staffList ?? []} basePath={base} />
      </Suspense>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{label}</p>
    </div>
  );
}
