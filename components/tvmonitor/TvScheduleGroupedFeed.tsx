'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildFeedItems,
  buildResourceColors,
  buildScheduleGroupColumns,
  buildSpaceNameIndex,
  UNGROUPED_COLUMN_KEY,
} from '@/lib/tvmonitor-schedule-format';
import TvFeedList from '@/components/tvmonitor/TvFeedList';
import { useSeamlessLoopScroll } from '@/components/tvmonitor/useSeamlessLoopScroll';
import type { TvMonitorScheduleBlock, TvMonitorSpace } from '@/types/tvmonitor';

/**
 * Grouped schedule view: several feeds side by side, one per named group of
 * resources — "Courts" on the left, "Pool Lanes" on the right. Each column is
 * exactly a TvScheduleFeed over its own subset (same cards, resource pill and
 * all); only the set of resources merged into each one differs.
 *
 * Columns are equal width. Resource colors come from a page-wide map keyed by
 * space id rather than per-column position, so two columns never paint
 * unrelated resources the same color.
 */
export default function TvScheduleGroupedFeed({
  spaces,
  settings,
  compact,
}: {
  spaces: TvMonitorSpace[];
  settings: TvMonitorScheduleBlock;
  compact?: boolean;
}) {
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const columns = useMemo(() => {
    const colors = buildResourceColors(spaces);
    // Name index is page-wide (so a booked sub-space still resolves), but each
    // column merges over only its own spaces — that's what makes a grouped
    // column name the resources it occupies *within that group*.
    const spaceNames = buildSpaceNameIndex(spaces);
    return buildScheduleGroupColumns(spaces, settings).map((column) => ({
      ...column,
      items: buildFeedItems(column.spaces, settings, colors, spaceNames),
    }));
  }, [spaces, settings]);

  const scrollSignature = `${compact}|${settings.notesSize}|${columns.map((c) => `${c.key}:${c.items.length}`).join(',')}`;
  const loopingColumns = useSeamlessLoopScroll(columnRefs, settings, scrollSignature);

  if (spaces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-2xl" style={{ color: 'var(--tv-secondary)' }}>
        Add resources to this schedule to see events.
      </div>
    );
  }

  if (columns.length === 0) {
    // resourceIds exist but no group claims them and the "Other" bucket is
    // empty — only reachable if Bond returned no spaces at all for them.
    return (
      <div className="flex h-full items-center justify-center text-2xl" style={{ color: 'var(--tv-secondary)' }}>
        Add a group to this schedule to see events.
      </div>
    );
  }

  // A feed card is wide (time block + title + resource pill). Past two columns
  // it has to tighten up regardless of whether a side rail already forced it.
  const dense = compact || columns.length > 2;
  const listSize = dense ? 'narrow' : 'compact';
  const labelSize = dense ? 'text-2xl' : 'text-3xl';

  return (
    <div className="flex h-full min-h-0 gap-6">
      {columns.map((column) => {
        const list = <TvFeedList items={column.items} settings={settings} size={listSize} now={now} />;
        return (
          <div key={column.key} className="flex min-h-0 flex-1 basis-0 flex-col">
            <div className="mb-3 shrink-0 border-b-2 pb-2" style={{ borderColor: 'var(--tv-accent)' }}>
              <h2
                className={`${labelSize} truncate font-bold`}
                // The "Other" bucket isn't a group the user named — mute it so
                // it reads as a state to fix, not as a real column.
                style={column.key === UNGROUPED_COLUMN_KEY ? { color: 'var(--tv-secondary)' } : undefined}
              >
                {column.label}
              </h2>
            </div>
            <div className="relative min-h-0 flex-1">
              <div
                ref={(el) => {
                  if (el) columnRefs.current.set(column.key, el);
                  else columnRefs.current.delete(column.key);
                }}
                className="scrollbar-hide absolute inset-0 overflow-y-auto"
              >
                {/* flow-root so the copy's measured height includes card margins —
                    the seamless-loop wrap distance must be pixel-exact. */}
                <div className="flow-root">{list}</div>
                {loopingColumns.has(column.key) && (
                  <div className="flow-root" aria-hidden="true">
                    {list}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
