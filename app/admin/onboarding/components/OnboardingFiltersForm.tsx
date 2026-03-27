'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchParamFromUrl } from '@/lib/onboarding/url-filters';

type StaffOption = { id: string; name: string };

/** Stable, fun “success” flair per rep (same id → same emoji). */
const REP_SUCCESS_EMOJIS = ['💪', '🏆', '⭐', '🎯', '🚀', '✨', '🔥', '🥇', '🥳', '🎉', '🌟', '👑'];

function repSuccessEmoji(staffId: string): string {
  let h = 0;
  for (let i = 0; i < staffId.length; i++) {
    h = (h * 31 + staffId.charCodeAt(i)) >>> 0;
  }
  return REP_SUCCESS_EMOJIS[h % REP_SUCCESS_EMOJIS.length];
}

const fieldClass =
  'h-10 w-full min-w-[11rem] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ' +
  'hover:border-zinc-300';

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-zinc-500';

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
    <div
      className="rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/90 p-4 shadow-sm"
      role="search"
      aria-label="Filter organizations"
    >
      <div className="mb-3 flex items-center gap-2 border-b border-zinc-100 pb-3">
        <span className="text-lg" aria-hidden>
          🎛️
        </span>
        <span className="text-sm font-semibold text-zinc-800">Filters</span>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {showSearch ? (
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 sm:max-w-xs">
            <span className={labelClass}>Search</span>
            <input
              value={qDraft}
              onChange={(e) => onSearchInputChange(e.target.value)}
              placeholder="Organization name"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
        ) : null}
        <label className="flex min-w-[12rem] flex-col gap-1.5">
          <span className={labelClass}>{repSelectLabel}</span>
          <div className="relative">
            <select
              value={repId}
              onChange={(e) => {
                const v = e.target.value;
                replaceQuery((p) => {
                  if (v) p.set('rep', v);
                  else p.delete('rep');
                });
              }}
              className={`${fieldClass} appearance-none pr-9`}
            >
              <option value="">All reps</option>
              {staffList.map((s) => {
                const emoji = repSuccessEmoji(s.id);
                return (
                  <option key={s.id} value={s.id}>
                    {emoji} {s.name}
                  </option>
                );
              })}
            </select>
            <span
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              aria-hidden
            >
              ▼
            </span>
          </div>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5">
          <span className={labelClass}>Status</span>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value;
                replaceQuery((p) => {
                  if (v) p.set('status', v);
                  else p.delete('status');
                });
              }}
              className={`${fieldClass} appearance-none pr-9`}
            >
              <option value="">All statuses</option>
              <option value="active">🟢 Active</option>
              <option value="completed">✅ Completed</option>
              <option value="paused">⏸️ Paused</option>
              <option value="archived">📦 Archived</option>
            </select>
            <span
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              aria-hidden
            >
              ▼
            </span>
          </div>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5">
          <span className={labelClass}>Completion</span>
          <div className="relative">
            <select
              value={completionRange}
              onChange={(e) => {
                const v = e.target.value;
                replaceQuery((p) => {
                  if (v) p.set('completion', v);
                  else p.delete('completion');
                });
              }}
              className={`${fieldClass} appearance-none pr-9`}
            >
              <option value="">All ranges</option>
              <option value="0-25">📊 0–25%</option>
              <option value="25-50">📈 25–50%</option>
              <option value="50-75">📈 50–75%</option>
              <option value="75-100">🎊 75–100%</option>
            </select>
            <span
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              aria-hidden
            >
              ▼
            </span>
          </div>
        </label>
        <Link
          href={basePath}
          scroll={false}
          className="inline-flex h-10 items-center justify-center self-end rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          Clear filters
        </Link>
      </div>
    </div>
  );
}
