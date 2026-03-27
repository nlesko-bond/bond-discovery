'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { OrgDashboardRow } from '@/lib/onboarding/types';
import {
  filterOrgDashboardRows,
  searchParamFromUrl,
} from '@/lib/onboarding/url-filters';
import { OnboardingFiltersForm } from './OnboardingFiltersForm';

type StaffOption = { id: string; name: string };

/**
 * Table + filters must read the real browser query string. The server page's `searchParams`
 * prop can desync from the URL after client navigation / refresh; `useSearchParams` cannot.
 */
export function OnboardingDashboardShell({
  rows,
  staffList,
  basePath,
}: {
  rows: OrgDashboardRow[];
  staffList: StaffOption[];
  basePath: string;
}) {
  const sp = useSearchParams();

  const repId = searchParamFromUrl(sp, 'rep');
  const statusFilter = searchParamFromUrl(sp, 'status');
  const completionRange = searchParamFromUrl(sp, 'completion');

  const filtered = useMemo(
    () =>
      filterOrgDashboardRows(rows, {
        repId,
        statusFilter,
        completionRange,
      }),
    [rows, repId, statusFilter, completionRange],
  );

  const filterStateKey = sp.toString() || 'default';

  return (
    <>
      <OnboardingFiltersForm
        basePath={basePath}
        staffList={staffList}
        repId={repId}
        statusFilter={statusFilter}
        completionRange={completionRange}
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
    </>
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
