'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchParamFromUrl } from '@/lib/onboarding/url-filters';

type StaffOption = { id: string; name: string };

type OnboardingFiltersFormProps = {
  /** Absolute path for this page, e.g. `/admin/onboarding/dashboard` (no query). */
  basePath: string;
  staffList: StaffOption[];
  /** When true, show the name search field (organizations list). */
  showSearch?: boolean;
  /** Visible label for the assigned-rep control. */
  repSelectLabel?: string;
};

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Filters update the URL on every change (no Apply). Table/list read the same query via
 * `useSearchParams`, so results stay in sync immediately.
 */
export function OnboardingFiltersForm({
  basePath,
  staffList,
  showSearch = false,
  repSelectLabel = 'CS rep',
}: OnboardingFiltersFormProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const spRef = useRef(sp);
  spRef.current = sp;

  const repId = searchParamFromUrl(sp, 'rep') ?? '';
  const statusFilter = searchParamFromUrl(sp, 'status') ?? '';
  const completionRange = searchParamFromUrl(sp, 'completion') ?? '';
  const qFromUrl = searchParamFromUrl(sp, 'q') ?? '';

  const [qDraft, setQDraft] = useState(qFromUrl);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

  useEffect(
    () => () => {
      if (searchDebounceRef.current !== undefined) {
        clearTimeout(searchDebounceRef.current);
      }
    },
    [],
  );

  const replaceQuery = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(spRef.current.toString());
      mutate(next);
      next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [router, basePath],
  );

  function onSearchInputChange(raw: string) {
    setQDraft(raw);
    if (searchDebounceRef.current !== undefined) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      const v = raw.trim();
      replaceQuery((p) => {
        if (v) p.set('q', v);
        else p.delete('q');
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filter organizations">
      {showSearch ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Search</span>
          <input
            value={qDraft}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="Organization name"
            autoComplete="off"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-600">{repSelectLabel}</span>
        <select
          value={repId}
          onChange={(e) => {
            const v = e.target.value;
            replaceQuery((p) => {
              if (v) p.set('rep', v);
              else p.delete('rep');
            });
          }}
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
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value;
            replaceQuery((p) => {
              if (v) p.set('status', v);
              else p.delete('status');
            });
          }}
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
          value={completionRange}
          onChange={(e) => {
            const v = e.target.value;
            replaceQuery((p) => {
              if (v) p.set('completion', v);
              else p.delete('completion');
            });
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
        >
          <option value="">All</option>
          <option value="0-25">0–25%</option>
          <option value="25-50">25–50%</option>
          <option value="50-75">50–75%</option>
          <option value="75-100">75–100%</option>
        </select>
      </label>
      <Link
        href={basePath}
        scroll={false}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 self-end"
      >
        Reset
      </Link>
    </div>
  );
}
