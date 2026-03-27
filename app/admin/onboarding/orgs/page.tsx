import Link from 'next/link';
import { OnboardingFiltersForm } from '@/app/admin/onboarding/components/OnboardingFiltersForm';
import { OnboardingListRealtimeRefresh } from '@/app/admin/onboarding/components/OnboardingListRealtimeRefresh';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { OrgDashboardRow } from '@/lib/onboarding/types';
import {
  onboardingListUrl,
  passesRepFilter,
  rowAssignedRepId,
  searchParamString,
} from '@/lib/onboarding/url-filters';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function rangeFilter(row: OrgDashboardRow, range: string | undefined): boolean {
  if (!range) return true;
  const pct = Number(row.completion_pct ?? 0);
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

export default async function OnboardingOrgsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = getSupabaseAdmin();
  const sp = await searchParams;
  const qRaw = searchParamString(sp.q);
  const q = qRaw ? qRaw.toLowerCase() : '';
  const repId = searchParamString(sp.rep);
  const statusFilter = searchParamString(sp.status);
  const completionRange = searchParamString(sp.completion);
  const page = Math.max(1, parseInt(searchParamString(sp.page) ?? '1', 10) || 1);
  const pageSize = 20;

  const { data: staffList } = await admin.from('staff').select('id, name').order('name');

  const { data: viewRows } = await admin
    .from('org_dashboard')
    .select('*')
    .order('last_activity', { ascending: false, nullsFirst: false });

  let rows = (viewRows ?? []) as OrgDashboardRow[];

  if (q) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }
  rows = rows.filter((r) => {
    if (!passesRepFilter(rowAssignedRepId(r), repId)) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (!rangeFilter(r, completionRange)) return false;
    return true;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);

  const qs = new URLSearchParams();
  if (qRaw) qs.set('q', qRaw);
  if (repId) qs.set('rep', repId);
  if (statusFilter) qs.set('status', statusFilter);
  if (completionRange) qs.set('completion', completionRange);

  const base = `${ONBOARDING_BASE}/orgs`;
  const filterStateKey = JSON.stringify({
    q: qRaw ?? '',
    rep: repId ?? '',
    status: statusFilter ?? '',
    completion: completionRange ?? '',
  });

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

      <OnboardingFiltersForm
        basePath={base}
        staffList={staffList ?? []}
        q={qRaw ?? ''}
        repId={repId}
        statusFilter={statusFilter}
        completionRange={completionRange}
        showSearch
        filterStateKey={filterStateKey}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Rep</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
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
                  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {row.last_activity ? new Date(row.last_activity).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {slice.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-600">No organizations found.</p>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 ? (
            <Link href={onboardingListUrl(base, qs, page - 1)} className="text-primary">
              Previous
            </Link>
          ) : null}
          <span className="text-gray-600">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={onboardingListUrl(base, qs, page + 1)} className="text-primary">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
