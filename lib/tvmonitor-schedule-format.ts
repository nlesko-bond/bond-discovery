/**
 * Shared formatting/grouping helpers for rendering Bond slots on a TV —
 * used by both the per-resource column view (TvScheduleGrid) and the
 * unified chronological feed view (TvScheduleFeed).
 */

import type { TvMonitorScheduleBlock, TvMonitorSlot, TvMonitorSpace } from '@/types/tvmonitor';

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

/**
 * Space id → palette color, assigned by position in the fetched `spaces`
 * array (which getTvMonitorSchedule orders by the page's resourceIds).
 * Grouped view needs colors keyed by id rather than by position within a
 * column: two columns each starting at palette[0] would paint unrelated
 * resources the same color on one screen.
 */
export function buildResourceColors(spaces: TvMonitorSpace[]): Map<number, string> {
  return new Map(spaces.map((space, index) => [space.id, resourceColorFor(index)]));
}

/** A feed row: one grouped slot, tagged with the resource it belongs to. */
export interface FeedScheduleItem extends GroupedScheduleSlot {
  spaceName: string;
  spaceColor: string;
}

/**
 * Merges several resources' slots into one chronologically-sorted feed.
 * Shared by the full-width 'feed' view, each column of the 'grouped' view,
 * and the zero-JS legacy renderer, so all three stay in lock-step on
 * filtering, parent/child nesting, and sort order.
 */
export function buildFeedItems(
  spaces: TvMonitorSpace[],
  settings: TvMonitorScheduleBlock,
  colors: Map<number, string>,
): FeedScheduleItem[] {
  const items: FeedScheduleItem[] = [];
  spaces.forEach((space) => {
    const spaceColor = colors.get(space.id) ?? resourceColorFor(0);
    groupScheduleSlots(space.slots, settings).forEach((event) => {
      items.push({ ...event, spaceName: space.name, spaceColor });
    });
  });
  return items.sort((a, b) => slotStartTimestamp(a) - slotStartTimestamp(b));
}

/** One rendered column of the 'grouped' view. */
export interface ScheduleGroupColumn {
  /** Stable React/DOM key — the group's config id, or UNGROUPED_COLUMN_KEY. */
  key: string;
  label: string;
  spaces: TvMonitorSpace[];
}

export const UNGROUPED_COLUMN_KEY = '__ungrouped__';
export const UNGROUPED_COLUMN_LABEL = 'Other';

/**
 * Splits the fetched spaces into the grouped view's columns.
 *
 * Resources not claimed by any group land in a trailing "Other" column
 * instead of being dropped. That's deliberate: this feature's whole config
 * surface is "which resources go in which column", and a resource silently
 * vanishing from a board because nobody assigned it is exactly the failure
 * mode that shipped once already with the shared resource-ID cap (a real
 * customer page lost 24 of 36 IDs with no signal). A visibly odd extra column
 * is recoverable; an invisible omission is not.
 *
 * Groups whose resources returned no spaces still render as empty columns —
 * a "this group is misconfigured" signal on screen, and it keeps column
 * widths stable as events come and go through the day.
 */
export function buildScheduleGroupColumns(
  spaces: TvMonitorSpace[],
  settings: TvMonitorScheduleBlock,
): ScheduleGroupColumn[] {
  const spaceById = new Map(spaces.map((space) => [space.id, space]));
  const claimed = new Set<number>();

  const columns: ScheduleGroupColumn[] = settings.groups.map((group) => ({
    key: group.id,
    label: group.label,
    spaces: group.resourceIds.reduce<TvMonitorSpace[]>((acc, id) => {
      claimed.add(id);
      const space = spaceById.get(id);
      if (space) acc.push(space);
      return acc;
    }, []),
  }));

  const unassigned = spaces.filter((space) => !claimed.has(space.id));
  if (unassigned.length > 0) {
    columns.push({ key: UNGROUPED_COLUMN_KEY, label: UNGROUPED_COLUMN_LABEL, spaces: unassigned });
  }
  return columns;
}
