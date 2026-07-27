'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Wrench } from 'lucide-react';
import {
  formatEventDuration,
  formatEventTime,
  groupScheduleSlots,
  isSlotHappeningNow,
  resourceColorFor,
  slotStartTimestamp,
  type GroupedScheduleSlot,
} from '@/lib/tvmonitor-schedule-format';
import { useSeamlessLoopScroll } from '@/components/tvmonitor/useSeamlessLoopScroll';
import type { TvMonitorScheduleBlock, TvMonitorSpace } from '@/types/tvmonitor';

interface FeedItem extends GroupedScheduleSlot {
  spaceName: string;
  spaceColor: string;
}

const FEED_COLUMN_KEY = 'feed';

/**
 * Unified schedule view: every resource's events merged into one full-width,
 * chronologically-sorted, continuously scrolling column, with each event's
 * location called out via a color-coded dot + a text pill (redundant coding
 * so it reads at a glance and isn't color-blind-dependent). Alternative to
 * TvScheduleGrid's per-resource columns — same data, same settings, same
 * seamless-scroll engine, different layout for facilities that want one
 * "everything happening today" board instead of side-by-side rinks/courts.
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

  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    spaces.forEach((space, index) => {
      const spaceColor = resourceColorFor(index);
      groupScheduleSlots(space.slots, settings).forEach((event) => {
        items.push({ ...event, spaceName: space.name, spaceColor });
      });
    });
    return items.sort((a, b) => slotStartTimestamp(a) - slotStartTimestamp(b));
  }, [spaces, settings]);

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

  const timeSize = compact ? 'text-2xl' : 'text-3xl';
  const eventNameSize = compact ? 'text-xl' : 'text-2xl';
  const notesSize =
    settings.notesSize === 'large' ? 'text-2xl' : settings.notesSize === 'medium' ? 'text-lg' : 'text-sm';

  const renderFeed = () =>
    feedItems.length === 0 ? (
      <div className="flex h-full items-center justify-center py-12 text-xl" style={{ color: 'var(--tv-secondary)' }}>
        No events scheduled
      </div>
    ) : (
      feedItems.map((event) => {
        const live = now ? isSlotHappeningNow(event, now) : false;
        const isMaintenanceCard = event.slotType === 'maintenance';
        const title = event.isPrivate
          ? settings.privateEventLabel
          : isMaintenanceCard
            ? settings.maintenanceLabel
            : event.reservationName;
        return (
          <div
            key={event.slotId}
            className="mb-4 flex gap-4 rounded-xl border p-4"
            style={{
              background: 'var(--tv-card-bg)',
              borderColor: live ? 'var(--tv-accent)' : 'var(--tv-card-border)',
            }}
          >
            {/* Color-coded resource strip — first of the two location cues. */}
            <div className="w-1.5 shrink-0 rounded-full" style={{ background: event.spaceColor }} />

            {/* Time block: fixed width so titles align down the whole feed. */}
            <div
              className="flex w-28 shrink-0 flex-col items-start justify-center border-r pr-4 md:w-36"
              style={{ borderColor: 'var(--tv-card-border)' }}
            >
              <div className={`${timeSize} font-bold leading-tight tabular-nums`}>{formatEventTime(event.startTime)}</div>
              <div className="text-sm" style={{ color: 'var(--tv-secondary)' }}>
                {formatEventTime(event.endTime)}
              </div>
              <span
                className="mt-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'var(--tv-card-border)', color: 'var(--tv-secondary)' }}
              >
                {formatEventDuration(event.startTime, event.endTime)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className={`${eventNameSize} truncate font-bold leading-snug`}>
                  {isMaintenanceCard && (
                    <Wrench size={18} className="mr-2 inline-block" style={{ color: 'var(--tv-accent)' }} />
                  )}
                  {title}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {live && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
                      style={{ background: 'var(--tv-accent)', color: 'var(--tv-bg1)' }}
                    >
                      Now
                    </span>
                  )}
                  {/* Location pill — second cue, explicit text so it's never ambiguous. */}
                  <span
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 font-semibold ${compact ? 'text-sm' : 'text-base'}`}
                    style={{ borderColor: 'var(--tv-card-border)' }}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: event.spaceColor }} />
                    {event.spaceName}
                  </span>
                </div>
              </div>
              {settings.showNotes && event.notes && !event.isPrivate && (
                <div
                  className={`mt-1 line-clamp-3 whitespace-pre-line leading-snug ${notesSize}`}
                  style={{
                    color: settings.notesColor || 'var(--tv-accent)',
                    fontStyle: settings.notesItalic ? 'italic' : 'normal',
                    fontWeight: settings.notesBold ? 700 : 400,
                  }}
                >
                  {event.notes.replace(/\n{2,}/g, '\n').trim()}
                </div>
              )}
              {event.children.map((child) => {
                const childIsMaintenance = child.slotType === 'maintenance';
                return (
                  <div
                    key={child.slotId}
                    className="mt-3 flex items-stretch gap-2 rounded-lg"
                    style={childIsMaintenance ? { background: 'var(--tv-card-bg)' } : undefined}
                  >
                    <div className="w-1 rounded" style={{ background: 'var(--tv-accent)' }} />
                    <div className="flex-1 py-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {childIsMaintenance && <Wrench size={14} style={{ color: 'var(--tv-accent)' }} />}
                        <span style={childIsMaintenance ? { color: 'var(--tv-accent)' } : undefined}>
                          {childIsMaintenance
                            ? settings.maintenanceLabel
                            : child.isPrivate
                              ? settings.privateEventLabel
                              : child.reservationName}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--tv-secondary)' }}>
                        {formatEventTime(child.startTime)} – {formatEventTime(child.endTime)}
                        {' · '}
                        {formatEventDuration(child.startTime, child.endTime)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })
    );

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
        <div className="flow-root">{renderFeed()}</div>
        {looping && (
          <div className="flow-root" aria-hidden="true">
            {renderFeed()}
          </div>
        )}
      </div>
    </div>
  );
}
