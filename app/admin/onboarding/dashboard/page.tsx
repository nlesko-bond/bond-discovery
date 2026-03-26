import Link from 'next/link';
import { OnboardingListRealtimeRefresh } from '@/app/admin/onboarding/components/OnboardingListRealtimeRefresh';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { OrgDashboardRow } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function rangeFilter(row: OrgDashboardRow, range: string | undefined): boolean {
  if (!range) return true;
  const pct = row.completion_pct ?? 0;
  switch (range) {
    case '0-25':
      return pct >= 0 && pct <= 25;
    case '25-50':
      return pct > 25 && pct <= 50;
    case '50-75':
      return pct > 50 && pct <= 75;
    case '75-100':
      return pct > 75 && pct <= 100;
    default:
      return true;
  }
}

export default async function OnboardingDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = getSupabaseAdmin();
  const sp = await searchParams;
  const repId = typeof sp.rep === 'string' ? sp.rep : undefined;
  const statusFilter = typeof sp.status === 'string' ? sp.status : undefined;
  const completionRange = typeof sp.completion === 'string' ? sp.completion : undefined;

  const { data: staffList } = await admin.from('staff').select('id, name').order('name');

  const { data: viewRows } = await admin
    .from('org_dashboard')
    .select('*')
    .order('last_activity', { ascending: false, nullsFirst: false });

  const rows = (viewRows ?? []) as OrgDashboardRow[];

  const filtered = rows.filter((r) => {
    if (repId && r.rep_id !== repId) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (!rangeFilter(r, completionRange)) return false;
    return true;
  });

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

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Rep</span>
          <select
            name="rep"
            defaultValue={repId ?? ''}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          >
            <option value="">All</option>
            {(staffList ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Status</span>
          <select
            name="status"
            defaultValue={statusFilter ?? ''}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Completion</span>
          <select
            name="completion"
            defaultValue={completionRange ?? ''}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          >
            <option value="">All</option>
            <option value="0-25">0–25%</option>
            <option value="25-50">25–50%</option>
            <option value="50-75">50–75%</option>
            <option value="75-100">75–100%</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
          Apply
        </button>
        <Link href={base} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">
          Reset
        </Link>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Rep</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`${ONBOARDING_BASE}/orgs/${row.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{row.rep_name ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${row.completion_pct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-gray-600">
                      {row.steps_done}/{row.steps_total}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {row.last_activity ? relativeTime(new Date(row.last_activity)) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{new Date(row.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-600">No organizations match these filters.</p>
        ) : null}
      </div>
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    paused: 'bg-gray-100 text-gray-700',
    archived: 'bg-gray-50 text-gray-600',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[status] ?? 'bg-gray-100'}`}
    >
      {status}
    </span>
  );
}

function relativeTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
