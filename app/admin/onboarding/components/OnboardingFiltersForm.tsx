'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';

type StaffOption = { id: string; name: string };

type OnboardingFiltersFormProps = {
  /** Absolute path for this page, e.g. `/admin/onboarding/dashboard` (no query). */
  basePath: string;
  staffList: StaffOption[];
  /** Current values from the server (URL). */
  q?: string;
  repId?: string;
  statusFilter?: string;
  completionRange?: string;
  /** When true, show the name search field (organizations list). */
  showSearch?: boolean;
  /** Stable key so selects reset after navigation when URL changes. */
  filterStateKey: string;
  /** Visible label for the assigned-rep control (onboarding dashboard / orgs). */
  repSelectLabel?: string;
};

/**
 * Client-side Apply uses `router.push` with an explicit query string so filters always
 * navigate reliably; plain GET forms can be flaky with the App Router + soft navigation.
 */
export function OnboardingFiltersForm({
  basePath,
  staffList,
  q = '',
  repId,
  statusFilter,
  completionRange,
  showSearch = false,
  filterStateKey,
  repSelectLabel = 'CS rep',
}: OnboardingFiltersFormProps) {
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    if (showSearch) {
      const qRaw = (fd.get('q') as string | null)?.trim();
      if (qRaw) params.set('q', qRaw);
    }

    const rep = (fd.get('rep') as string | null)?.trim();
    const status = (fd.get('status') as string | null)?.trim();
    const completion = (fd.get('completion') as string | null)?.trim();
    if (rep) params.set('rep', rep);
    if (status) params.set('status', status);
    if (completion) params.set('completion', completion);

    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <form
      key={filterStateKey}
      className="flex flex-wrap items-end gap-3"
      onSubmit={onSubmit}
      action={basePath}
      method="get"
    >
      {showSearch ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Organization name"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-600">{repSelectLabel}</span>
        <select
          name="rep"
          defaultValue={repId ?? ''}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
        >
          <option value="">All</option>
          {staffList.map((s) => (
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
      <Link href={basePath} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">
        Reset
      </Link>
    </form>
  );
}
