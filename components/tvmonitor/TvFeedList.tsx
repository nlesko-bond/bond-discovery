'use client';

import { Wrench } from 'lucide-react';
import {
  formatEventDuration,
  formatEventTime,
  formatOccupancyLabel,
  isSlotHappeningNow,
  type FeedScheduleItem,
  type MergeableScheduleSlot,
} from '@/lib/tvmonitor-schedule-format';
import type { TvMonitorScheduleBlock } from '@/types/tvmonitor';

/**
 * The list of cards inside a feed — extracted so the full-width 'feed' view
 * and every column of the 'grouped' view render byte-identical rows. Callers
 * own the scrolling container and the seamless-loop duplication (they must
 * render this twice when their column is looping), because the scroll engine
 * measures one copy's height against the container it lives in; see
 * useSeamlessLoopScroll.
 */
/**
 * 'normal'  — full-width feed, no side rail (the original default).
 * 'compact' — full-width feed with a left/right rail ad eating width (what
 *             TvScheduleFeed's `compact` prop has always meant).
 * 'narrow'  — a grouped column sharing the screen with 2+ siblings. Only this
 *             tier tightens the time block; 'normal'/'compact' must stay
 *             pixel-identical to what live feed boards already render.
 */
export type TvFeedListSize = 'normal' | 'compact' | 'narrow';

export default function TvFeedList({
  items,
  settings,
  size = 'normal',
  occupancyLimit = 2,
  now,
}: {
  items: MergeableScheduleSlot<FeedScheduleItem>[];
  settings: TvMonitorScheduleBlock;
  size?: TvFeedListSize;
  /**
   * How many booked resources to name before collapsing the rest into "+N".
   * The full-width feed can raise this (see schedule.listAllSpacesInFeed);
   * grouped columns keep the default, since each is a fraction of the screen.
   */
  occupancyLimit?: number;
  /** null until the client clock mounts — keeps SSR and first paint identical. */
  now: Date | null;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12 text-xl" style={{ color: 'var(--tv-secondary)' }}>
        No events scheduled
      </div>
    );
  }

  const compact = size !== 'normal';
  // The time block is a fixed width so titles line up down the column, which
  // means its font size and its width have to be chosen together: too narrow
  // for the size and "12:00 PM" wraps to two lines no matter how wide the
  // column is, too wide and it starves the event title in a grouped column.
  // Only 'narrow' retunes them — narrowing the block for a plain feed would
  // silently reflow every live feed board that has a rail ad.
  const narrow = size === 'narrow';
  const timeSize = narrow ? 'text-xl' : compact ? 'text-2xl' : 'text-3xl';
  // Trailing modifier only, so the non-narrow class string stays byte-identical
  // to what shipped — keeps regression diffs against live output meaningful.
  const timeWidthModifier = narrow ? 'whitespace-nowrap' : 'md:w-36';
  const eventNameSize = compact ? 'text-xl' : 'text-2xl';
  const notesSize =
    settings.notesSize === 'large' ? 'text-2xl' : settings.notesSize === 'medium' ? 'text-lg' : 'text-sm';
  const plain = settings.cardStyle === 'plain';

  return (
    <>
      {items.map((event) => {
        const live = now ? isSlotHappeningNow(event, now) : false;
        const isMaintenanceCard = event.slotType === 'maintenance';
        const title = event.isPrivate
          ? settings.privateEventLabel
          : isMaintenanceCard
            ? settings.maintenanceLabel
            : event.reservationName;
        // A merged card stands for several resources, so the single-resource
        // color cue would be actively wrong — fall back to a neutral strip/dot
        // and let the multi-name pill carry the location on its own.
        const spansMultiple = event.occupancy.length > 1;
        const cueColor = spansMultiple ? 'var(--tv-card-border)' : event.spaceColor;
        const locationLabel = formatOccupancyLabel(event.occupancy, occupancyLimit) ?? event.spaceName;
        return (
          <div
            key={event.key}
            className={plain ? 'mb-5 flex gap-4 border-b pb-4 last:border-b-0' : 'mb-4 flex gap-4 rounded-xl border p-4'}
            style={
              plain
                ? { borderColor: 'var(--tv-card-border)' }
                : { background: 'var(--tv-card-bg)', borderColor: live ? 'var(--tv-accent)' : 'var(--tv-card-border)' }
            }
          >
            {/* Color-coded resource strip — first of the two location cues. */}
            <div className="w-1.5 shrink-0 rounded-full" style={{ background: cueColor }} />

            <div
              className={`flex w-28 shrink-0 flex-col items-start justify-center border-r pr-4 ${timeWidthModifier}`}
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
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cueColor }} />
                    {locationLabel}
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
                    style={childIsMaintenance && !plain ? { background: 'var(--tv-card-bg)' } : undefined}
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
      })}
    </>
  );
}
