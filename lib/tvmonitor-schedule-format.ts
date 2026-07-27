/**
 * Shared formatting/grouping helpers for rendering Bond slots on a TV —
 * used by both the per-resource column view (TvScheduleGrid) and the
 * unified chronological feed view (TvScheduleFeed).
 */

import type { TvMonitorScheduleBlock, TvMonitorSlot } from '@/types/tvmonitor';

export interface GroupedScheduleSlot extends TvMonitorSlot {
  children: TvMonitorSlot[];
}

export function formatEventTime(time: string): string {
  const date = new Date(`2000-01-01T${time}`);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatEventDuration(start: string, end: string): string {
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

export function isSlotHappeningNow(slot: TvMonitorSlot, now: Date): boolean {
  if (!slot.date || !slot.startTime || !slot.endTime) return false;
  const start = new Date(`${slot.date}T${slot.startTime}`);
  const end = new Date(`${slot.endDate || slot.date}T${slot.endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return now >= start && now < end;
}

/** Returns a sortable timestamp for a slot's start; NaN-safe (invalid slots sort last). */
export function slotStartTimestamp(slot: TvMonitorSlot): number {
  const t = new Date(`${slot.date}T${slot.startTime}`).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Filters by show/hide settings, then nests child slots (maintenance, locker rooms) under their parent. */
export function groupScheduleSlots(slots: TvMonitorSlot[], settings: TvMonitorScheduleBlock): GroupedScheduleSlot[] {
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
 * A small, distinguishable palette for color-coding resources in the unified
 * feed view. Deterministic by position, not by ID, so colors stay stable
 * relative to each other regardless of Bond's numeric space IDs.
 */
const RESOURCE_PALETTE = [
  '#60a5fa', // blue
  '#34d399', // emerald
  '#f472b6', // pink
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#4ade80', // green
  '#f87171', // red
  '#c084fc', // purple
  '#facc15', // yellow
  '#2dd4bf', // teal
];

export function resourceColorFor(index: number): string {
  return RESOURCE_PALETTE[index % RESOURCE_PALETTE.length];
}
