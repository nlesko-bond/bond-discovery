'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Wrench } from 'lucide-react';
import {
  formatEventDuration,
  formatEventTime,
  groupScheduleSlots,
  isSlotHappeningNow,
} from '@/lib/tvmonitor-schedule-format';
import { useSeamlessLoopScroll } from '@/components/tvmonitor/useSeamlessLoopScroll';
import type { TvMonitorScheduleBlock, TvMonitorSpace } from '@/types/tvmonitor';

/**
 * The resource-schedule building block: one column per resource. See
 * useSeamlessLoopScroll for the auto-scroll engine (seamless loop, no jump).
 */
export default function TvScheduleGrid({
  spaces,
  settings,
  compact,
  hideSpaceNames = false,
}: {
  spaces: TvMonitorSpace[];
  settings: TvMonitorScheduleBlock;
  compact?: boolean;
  /** Hide per-column space-name headers (e.g. when a title banner already names the rink). */
  hideSpaceNames?: boolean;
}) {
  const columnRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const grouped = useMemo(
    () => spaces.map((space) => ({ space, events: groupScheduleSlots(space.slots, settings) })),
    [spaces, settings],
  );

  const scrollSignature = `${compact}|${settings.notesSize}|${grouped.map((g) => `${g.space.id}:${g.events.length}`).join(',')}`;
  const loopingColumns = useSeamlessLoopScroll(columnRefs, settings, scrollSignature);

  if (grouped.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-2xl" style={{ color: 'var(--tv-secondary)' }}>
        Add resources to this schedule to see events.
      </div>
    );
  }

  const nameSize = compact || grouped.length > 3 ? 'text-2xl' : 'text-4xl';
  const eventNameSize = compact || grouped.length > 3 ? 'text-xl' : 'text-2xl';
  const timeSize = compact || grouped.length > 3 ? 'text-base' : 'text-xl';
  const notesSize =
    settings.notesSize === 'large' ? 'text-2xl' : settings.notesSize === 'medium' ? 'text-lg' : 'text-sm';
  const plain = settings.cardStyle === 'plain';

  // "You are here": only meaningful with more than one column, and only if
  // the pointer still resolves to a resource actually on screen (normalizeTvMonitorConfig
  // already guarantees this, but stay defensive against stale preview state).
  const hasWayfinding =
    grouped.length > 1 && settings.primaryResourceId != null && grouped.some((g) => g.space.id === settings.primaryResourceId);

  const columnTemplate = { gridTemplateColumns: `repeat(${grouped.length}, minmax(0, 1fr))` };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {hasWayfinding && (
        <div className="mb-2 grid shrink-0 gap-6" style={columnTemplate}>
          {grouped.map(({ space }) =>
            space.id === settings.primaryResourceId ? (
              <div key={space.id} className="flex flex-col items-center">
                <div
                  className="rounded-t-md px-4 py-1.5 text-sm font-extrabold uppercase tracking-widest"
                  style={{ background: 'var(--tv-accent)', color: 'var(--tv-bg1)' }}
                >
                  {settings.wayfindingLabel}
                </div>
                <div className="h-0 w-0 border-x-8 border-t-8 border-x-transparent" style={{ borderTopColor: 'var(--tv-accent)' }} />
              </div>
            ) : (
              <div key={space.id} />
            ),
          )}
        </div>
      )}

      <div className="grid h-full min-h-0 flex-1 gap-6" style={columnTemplate}>
        {grouped.map(({ space, events }) => {
          const isPrimary = space.id === settings.primaryResourceId;
          const muted = hasWayfinding && !isPrimary;

          const renderEventList = () =>
            events.length === 0 ? (
              <div className={`${timeSize} py-6 ${plain ? 'text-center' : ''}`} style={{ color: 'var(--tv-secondary)' }}>
                No upcoming events
              </div>
            ) : (
              events.map((event) => {
                const live = now ? isSlotHappeningNow(event, now) : false;
                const isMaintenanceCard = event.slotType === 'maintenance';
                const title = event.isPrivate
                  ? settings.privateEventLabel
                  : isMaintenanceCard
                    ? settings.maintenanceLabel
                    : event.reservationName;

                const notes = settings.showNotes && event.notes && !event.isPrivate && (
                  <div
                    className={`mt-1 line-clamp-4 whitespace-pre-line leading-snug ${notesSize}`}
                    style={{
                      color: settings.notesColor || 'var(--tv-accent)',
                      fontStyle: settings.notesItalic ? 'italic' : 'normal',
                      fontWeight: settings.notesBold ? 700 : 400,
                    }}
                  >
                    {/* Bond returns real newlines (e.g. one locker room per line);
                        render them, but collapse blank lines to save TV space. */}
                    {event.notes!.replace(/\n{2,}/g, '\n').trim()}
                  </div>
                );

                const children = event.children.map((child) => {
                  const childIsMaintenance = child.slotType === 'maintenance';
                  return (
                    <div
                      key={child.slotId}
                      className={`mt-3 flex items-stretch gap-2 rounded-lg ${plain ? 'justify-center text-center' : ''}`}
                      style={childIsMaintenance && !plain ? { background: 'var(--tv-card-bg)' } : undefined}
                    >
                      {!plain && <div className="w-1 rounded" style={{ background: 'var(--tv-accent)' }} />}
                      <div className="flex-1 py-1">
                        <div className={`flex items-center gap-2 text-sm font-semibold ${plain ? 'justify-center' : ''}`}>
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
                });

                if (plain) {
                  return (
                    <div
                      key={event.slotId}
                      className="mb-5 border-b pb-4 text-center last:border-b-0"
                      style={{ borderColor: 'var(--tv-card-border)' }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className={`${timeSize} font-semibold`} style={{ color: 'var(--tv-secondary)' }}>
                          {formatEventTime(event.startTime)} – {formatEventTime(event.endTime)}
                        </span>
                        {live && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
                            style={{ background: 'var(--tv-accent)', color: 'var(--tv-bg1)' }}
                          >
                            Now
                          </span>
                        )}
                      </div>
                      <div className={`${eventNameSize} mt-1 font-bold leading-snug`}>
                        {isMaintenanceCard && (
                          <Wrench size={18} className="mr-2 inline-block" style={{ color: 'var(--tv-accent)' }} />
                        )}
                        {title}
                      </div>
                      {notes}
                      {children}
                    </div>
                  );
                }

                return (
                  <div
                    key={event.slotId}
                    className="mb-4 rounded-xl border p-4"
                    style={{
                      background: 'var(--tv-card-bg)',
                      borderColor: live ? 'var(--tv-accent)' : 'var(--tv-card-border)',
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className={`${timeSize} font-semibold`} style={{ color: 'var(--tv-secondary)' }}>
                        {formatEventTime(event.startTime)} – {formatEventTime(event.endTime)}
                      </div>
                      <div className="flex items-center gap-2">
                        {live && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
                            style={{ background: 'var(--tv-accent)', color: 'var(--tv-bg1)' }}
                          >
                            Now
                          </span>
                        )}
                        <span
                          className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: 'var(--tv-card-border)', color: 'var(--tv-secondary)' }}
                        >
                          {formatEventDuration(event.startTime, event.endTime)}
                        </span>
                      </div>
                    </div>
                    <div className={`${eventNameSize} font-bold leading-snug`}>
                      {isMaintenanceCard && (
                        <Wrench size={18} className="mr-2 inline-block" style={{ color: 'var(--tv-accent)' }} />
                      )}
                      {title}
                    </div>
                    {notes}
                    {children}
                  </div>
                );
              })
            );

          return (
            <div
              key={space.id}
              className="flex min-h-0 flex-col transition-opacity"
              style={muted ? { opacity: 0.55, filter: 'grayscale(35%)' } : undefined}
            >
              {!hideSpaceNames && (
                <div className="mb-3 border-b-2 pb-2" style={{ borderColor: 'var(--tv-accent)' }}>
                  <h2 className={`${nameSize} truncate font-bold ${plain ? 'text-center' : ''}`}>{space.name}</h2>
                </div>
              )}
              <div className="relative min-h-0 flex-1">
                <div
                  ref={(el) => {
                    if (el) columnRefs.current.set(space.id, el);
                    else columnRefs.current.delete(space.id);
                  }}
                  className="scrollbar-hide absolute inset-0 overflow-y-auto"
                >
                  {/* flow-root so the copy's measured height includes card margins —
                      the seamless-loop wrap distance must be pixel-exact. */}
                  <div className="flow-root">{renderEventList()}</div>
                  {loopingColumns.has(space.id) && (
                    <div className="flow-root" aria-hidden="true">
                      {renderEventList()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
