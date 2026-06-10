'use client';

import { SearchX, CalendarOff } from 'lucide-react';

interface IHostPortalV2SkeletonProps {
  cardMinWidthPx: number;
  count?: number;
}

/** Loading skeleton matching the v2 card grid geometry (panel + title + meta + CTA). */
export function HostPortalV2Skeleton({
  cardMinWidthPx,
  count = 6,
}: IHostPortalV2SkeletonProps) {
  return (
    <div
      data-testid="portal-v2-skeleton"
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${cardMinWidthPx}px), 1fr))`,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse overflow-hidden rounded-xl bg-white ring-1 ring-gray-200"
        >
          <div className="h-24 bg-gray-100" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 rounded bg-gray-100" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-3 w-2/3 rounded bg-gray-100" />
            <div className="h-4 w-1/4 rounded bg-gray-200" />
            <div className="mt-2 h-11 rounded-lg bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface IHostPortalV2EmptyStateProps {
  accentColor: string;
  onClearFilters: () => void;
}

/** No programs match the active filters: friendly, with a clear-filters action. */
export function HostPortalV2EmptyState({
  accentColor,
  onClearFilters,
}: IHostPortalV2EmptyStateProps) {
  return (
    <div
      data-testid="portal-v2-empty-state"
      className="flex flex-col items-center gap-3 py-16 text-center"
    >
      <SearchX size={32} className="text-gray-300" aria-hidden />
      <p className="text-sm font-medium text-gray-900">No programs match your filters</p>
      <p className="max-w-xs text-xs text-gray-500">
        Try removing a filter or two — there may be more programs than your current
        selection shows.
      </p>
      <button
        type="button"
        className="mt-1 inline-flex min-h-[44px] items-center rounded-lg px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: accentColor }}
        onClick={onClearFilters}
      >
        Clear filters
      </button>
    </div>
  );
}

interface IHostPortalV2ZeroEventsStateProps {
  companyName: string;
}

/** Page has no programs at all (empty-but-valid payload): branded, never a blank iframe. */
export function HostPortalV2ZeroEventsState({
  companyName,
}: IHostPortalV2ZeroEventsStateProps) {
  return (
    <div
      data-testid="portal-v2-zero-state"
      className="flex flex-col items-center gap-3 py-16 text-center"
    >
      <CalendarOff size={32} className="text-gray-300" aria-hidden />
      <p className="text-sm font-medium text-gray-900">
        No programs are open for registration right now
      </p>
      <p className="max-w-xs text-xs text-gray-500">
        {companyName} hasn&apos;t published any upcoming programs yet. Check back soon —
        new sessions are added regularly.
      </p>
    </div>
  );
}
