'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { OrgDashboardRow } from '@/lib/onboarding/types';
import {
  filterOnboardingOrgListRows,
  onboardingListUrl,
  searchParamFromUrl,
} from '@/lib/onboarding/url-filters';
import { OnboardingFiltersForm } from './OnboardingFiltersForm';

type StaffOption = { id: string; name: string };

const PAGE_SIZE = 20;

/** Same URL / RSC desync fix as dashboard — filters + table read `useSearchParams`. */
export function OnboardingOrgsShell({
  rows,
  staffList,
  basePath,
}: {
  rows: OrgDashboardRow[];
  staffList: StaffOption[];
  basePath: string;
}) {
  const sp = useSearchParams();

  const qRaw = searchParamFromUrl(sp, 'q') ?? '';
  const repId = searchParamFromUrl(sp, 'rep');
  const statusFilter = searchParamFromUrl(sp, 'status');
  const completionRange = searchParamFromUrl(sp, 'completion');
  const page = Math.max(1, parseInt(searchParamFromUrl(sp, 'page') ?? '1', 10) || 1);

  const filtered = useMemo(
    () =>
      filterOnboardingOrgListRows(rows, {
        q: qRaw || undefined,
        repId,
        statusFilter,
        completionRange,
      }),
    [rows, qRaw, repId, statusFilter, completionRange],
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const qs = useMemo(() => new URLSearchParams(sp.toString()), [sp]);

  return (
    <>
      <OnboardingFiltersForm basePath={basePath} staffList={staffList} showSearch />

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
            <Link href={onboardingListUrl(basePath, qs, page - 1)} className="text-primary">
              Previous
            </Link>
          ) : null}
          <span className="text-gray-600">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={onboardingListUrl(basePath, qs, page + 1)} className="text-primary">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
