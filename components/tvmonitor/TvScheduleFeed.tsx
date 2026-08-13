'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildFeedItems, buildResourceColors } from '@/lib/tvmonitor-schedule-format';
import TvFeedList from '@/components/tvmonitor/TvFeedList';
import { useSeamlessLoopScroll } from '@/components/tvmonitor/useSeamlessLoopScroll';
import type { TvMonitorScheduleBlock, TvMonitorSpace } from '@/types/tvmonitor';

const FEED_COLUMN_KEY = 'feed';

/**
 * Unified schedule view: every resource's events merged into one full-width,
 * chronologically-sorted, continuously scrolling column, with each event's
 * location called out via a color-coded dot + a text pill (redundant coding
 * so it reads at a glance and isn't color-blind-dependent). Alternative to
 * TvScheduleGrid's per-resource columns — same data, same settings, same
 * seamless-scroll engine, different layout for facilities that want one
 * "everything happening today" board instead of side-by-side rinks/courts.
 *
 * See TvScheduleGroupedFeed for the middle ground: several of these side by
 * side, one per named group of resources.
 */
export default function TvScheduleFeed({
  spaces,
  settings,
  compact,
}: {
  spaces: TvMonitorSpace[];
  settings: TvMonitorScheduleBlock;
  compact?: boolean;
}) {
  const columnRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const feedItems = useMemo(
    () => buildFeedItems(spaces, settings, buildResourceColors(spaces)),
    [spaces, settings],
  );

  const scrollSignature = `${compact}|${settings.notesSize}|${feedItems.length}`;
  const loopingColumns = useSeamlessLoopScroll(columnRef, settings, scrollSignature);
  const looping = loopingColumns.has(FEED_COLUMN_KEY);

  if (spaces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-2xl" style={{ color: 'var(--tv-secondary)' }}>
        Add resources to this schedule to see events.
      </div>
    );
  }

  // 'compact'/'normal' only — the tighter 'narrow' tier is exclusive to grouped
  // columns, so this view keeps rendering exactly what live boards render today.
  const list = <TvFeedList items={feedItems} settings={settings} size={compact ? 'compact' : 'normal'} now={now} />;

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={(el) => {
          if (el) columnRef.current.set(FEED_COLUMN_KEY, el);
          else columnRef.current.delete(FEED_COLUMN_KEY);
        }}
        className="scrollbar-hide absolute inset-0 overflow-y-auto"
      >
        {/* flow-root so the copy's measured height includes card margins —
            the seamless-loop wrap distance must be pixel-exact. */}
        <div className="flow-root">{list}</div>
        {looping && (
          <div className="flow-root" aria-hidden="true">
            {list}
          </div>
        )}
      </div>
    </div>
  );
}
