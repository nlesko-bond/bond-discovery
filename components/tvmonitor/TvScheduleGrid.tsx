'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Wrench } from 'lucide-react';
import type { TvMonitorScheduleBlock, TvMonitorSlot, TvMonitorSpace } from '@/types/tvmonitor';

interface GroupedSlot extends TvMonitorSlot {
  children: TvMonitorSlot[];
}

function formatTime(time: string): string {
  const date = new Date(`2000-01-01T${time}`);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(start: string, end: string): string {
  const s = new Date(`2000-01-01T${start}`);
  const e = new Date(`2000-01-01T${end}`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  const minutes = Math.round((e.getTime() - s.getTime()) / 60000);
  if (minutes <= 0) return '';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function isHappeningNow(slot: TvMonitorSlot, now: Date): boolean {
  if (!slot.date || !slot.startTime || !slot.endTime) return false;
  const start = new Date(`${slot.date}T${slot.startTime}`);
  const end = new Date(`${slot.endDate || slot.date}T${slot.endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return now >= start && now < end;
}

function groupSlots(slots: TvMonitorSlot[], settings: TvMonitorScheduleBlock): GroupedSlot[] {
  const visible = slots.filter((slot) => {
    if (!settings.showPrivateEvents && slot.isPrivate) return false;
    if (!settings.showMaintenance && slot.slotType === 'maintenance') return false;
    return true;
  });
  const parents = visible.filter((slot) => slot.parentSlotId == null);
  const children = visible.filter((slot) => slot.parentSlotId != null);
  return parents.map((parent) => ({
    ...parent,
    children: children.filter((child) => child.parentSlotId === parent.slotId),
  }));
}

/**
 * The resource-schedule building block: one column per resource with
 * requestAnimationFrame auto-scroll — synchronized (all columns in lock-step)
 * or independent (each column loops through its own overflow).
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
    () => spaces.map((space) => ({ space, events: groupSlots(space.slots, settings) })),
    [spaces, settings],
  );

  // ---------------------------------------------------------------------
  // Auto-scroll engine
  // ---------------------------------------------------------------------
  const scrollSignature = grouped.map((g) => `${g.space.id}:${g.events.length}`).join('|');
  useEffect(() => {
    if (!settings.autoScroll) return;

    const pxPerSecond = settings.scrollSpeed * 24;
    const pauseMs = settings.scrollPauseSeconds * 1000;
    const synchronized = settings.scrollMode === 'synchronized';

    interface ScrollState {
      progress: number;
      pauseUntil: number;
    }
    const states = new Map<number, ScrollState>();
    const syncState: ScrollState = { progress: 0, pauseUntil: performance.now() + pauseMs };

    let raf = 0;
    let last = performance.now();

    const tick = (nowMs: number) => {
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;

      const columns = Array.from(columnRefs.current.entries());

      if (synchronized) {
        const maxScroll = Math.max(
          0,
          ...columns.map(([, el]) => el.scrollHeight - el.clientHeight),
        );
        if (maxScroll > 0 && nowMs >= syncState.pauseUntil) {
          syncState.progress += pxPerSecond * dt;
          if (syncState.progress >= maxScroll) {
            syncState.progress = 0;
            syncState.pauseUntil = nowMs + pauseMs;
            columns.forEach(([, el]) => el.scrollTo({ top: 0 }));
          }
        }
        columns.forEach(([, el]) => {
          const ownMax = el.scrollHeight - el.clientHeight;
          if (ownMax > 0) el.scrollTop = Math.min(syncState.progress, ownMax);
        });
      } else {
        columns.forEach(([id, el]) => {
          const ownMax = el.scrollHeight - el.clientHeight;
          if (ownMax <= 0) return;
          let state = states.get(id);
          if (!state) {
            state = { progress: 0, pauseUntil: nowMs + pauseMs };
            states.set(id, state);
          }
          if (nowMs >= state.pauseUntil) {
            state.progress += pxPerSecond * dt;
            if (state.progress >= ownMax) {
              state.progress = 0;
              state.pauseUntil = nowMs + pauseMs;
            }
          }
          el.scrollTop = Math.min(state.progress, ownMax);
        });
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    settings.autoScroll,
    settings.scrollSpeed,
    settings.scrollMode,
    settings.scrollPauseSeconds,
    scrollSignature,
  ]);

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

  return (
    <div
      className="grid h-full min-h-0 gap-6"
      style={{ gridTemplateColumns: `repeat(${grouped.length}, minmax(0, 1fr))` }}
    >
      {grouped.map(({ space, events }) => (
        <div key={space.id} className="flex min-h-0 flex-col">
          {!hideSpaceNames && (
            <div className="mb-3 border-b-2 pb-2" style={{ borderColor: 'var(--tv-accent)' }}>
              <h2 className={`${nameSize} truncate font-bold`}>{space.name}</h2>
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
              {events.length === 0 ? (
                <div className={`${timeSize} py-6`} style={{ color: 'var(--tv-secondary)' }}>
                  No upcoming events
                </div>
              ) : (
                events.map((event) => {
                  const live = now ? isHappeningNow(event, now) : false;
                  const isMaintenanceCard = event.slotType === 'maintenance';
                  const title = event.isPrivate
                    ? settings.privateEventLabel
                    : isMaintenanceCard
                      ? settings.maintenanceLabel
                      : event.reservationName;
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
                          {formatTime(event.startTime)} – {formatTime(event.endTime)}
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
                            {formatDuration(event.startTime, event.endTime)}
                          </span>
                        </div>
                      </div>
                      <div className={`${eventNameSize} font-bold leading-snug`}>
                        {isMaintenanceCard && (
                          <Wrench size={18} className="mr-2 inline-block" style={{ color: 'var(--tv-accent)' }} />
                        )}
                        {title}
                      </div>
                      {settings.showNotes && event.notes && !event.isPrivate && (
                        <div
                          className={`mt-1 line-clamp-3 italic leading-snug ${notesSize}`}
                          style={{ color: 'var(--tv-accent)' }}
                        >
                          {event.notes}
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
                                {childIsMaintenance && (
                                  <Wrench size={14} style={{ color: 'var(--tv-accent)' }} />
                                )}
                                <span style={childIsMaintenance ? { color: 'var(--tv-accent)' } : undefined}>
                                  {childIsMaintenance
                                    ? settings.maintenanceLabel
                                    : child.isPrivate
                                      ? settings.privateEventLabel
                                      : child.reservationName}
                                </span>
                              </div>
                              <div className="text-xs" style={{ color: 'var(--tv-secondary)' }}>
                                {formatTime(child.startTime)} – {formatTime(child.endTime)}
                                {' · '}
                                {formatDuration(child.startTime, child.endTime)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
