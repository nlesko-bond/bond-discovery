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

// ---------------------------------------------------------------------------
// Duplicate-booking merge (schedule.mergeDuplicateBookings)
//
// Bond models dependent and parent/child spaces, so its slots-schedule endpoint
// returns ONE SLOT PER (reservation x space): a booking reappears under every
// space it blocks. A real facility returned 33 rows for 4 actual reservations,
// one of them 20 times — including 4 times inside a single column, because that
// reservation was booked on 4 sub-spaces that all cascade into the same court.
//
// Note the two different space ids in play: `slot.spaceId` is the space the
// reservation was actually BOOKED on, while the space object a slot is nested
// under is where it DISPLAYS. They routinely differ.
// ---------------------------------------------------------------------------

/**
 * Stable identity for one real reservation occurrence, or null when the slot
 * must never be merged.
 *
 * Returning null for a missing `reservationId` is the safety rule: name + time
 * alone can collide across genuinely different bookings, and wrongly fusing two
 * real events is far worse than leaving a duplicate on screen. `date`/`endDate`
 * are part of the key so that a recurring reservation at the same clock time on
 * two different days never merges — which also keeps the "Now" highlight honest.
 */
export function reservationKeyOf(slot: TvMonitorSlot): string | null {
  if (slot.reservationId == null) return null;
  return [slot.reservationId, slot.reservationName, slot.date, slot.endDate, slot.startTime, slot.endTime].join('|');
}

/**
 * space id -> display name, for resolving a slot's booked `spaceId`.
 *
 * Only the page's configured resources are in here, because that's all Bond
 * returns — so a booked sub-space the operator didn't configure simply won't
 * resolve, and the merge falls back to the containing space's name. Blank names
 * are excluded rather than passed through: joining them would render ", , Court 3".
 */
export function buildSpaceNameIndex(spaces: TvMonitorSpace[]): Map<number, string> {
  const index = new Map<number, string>();
  spaces.forEach((space) => {
    if (space.name.trim()) index.set(space.id, space.name);
  });
  return index;
}

/** A schedule item carrying its render key and the resources it occupies. */
export type MergeableScheduleSlot<T> = T & {
  /** React key. Prefixed so merged and unmerged keys can never collide. */
  key: string;
  /** Names of the resources this booking occupies, within the merged scope. Empty when unmerged. */
  occupancy: string[];
};

/**
 * Collapses slots that are the same underlying reservation into one item.
 *
 * Occupancy is derived from the members passed in, NOT from a page-wide map:
 * it is a property of a reservation *within the set being merged*, so the
 * caller's scope decides what the card claims. Feed passes every space (one
 * card naming everything), grouped passes one column's spaces (each column
 * self-describing), columns passes a single space. A page-wide occupancy map
 * would put building-wide half-courts on a card sitting under a "Court 1" header.
 *
 * Must run AFTER groupScheduleSlots so hidden slots never contribute a name,
 * and BEFORE the chronological sort so the representative is deterministically
 * the one from the earliest configured resource (spaces arrive in resourceIds
 * order, see lib/tvmonitor-schedule.ts) and occupancy comes out in that order too.
 *
 * With the setting off this is an identity passthrough — same objects, plus the
 * `key`/`occupancy` fields — so an existing board renders exactly as before.
 */
export function mergeSharedReservations<T extends GroupedScheduleSlot>(
  items: T[],
  settings: TvMonitorScheduleBlock,
  spaceNames: Map<number, string>,
  /** Display name of the space these items were nested under; the fallback when a booked id doesn't resolve. */
  containingSpaceName: (item: T) => string,
): MergeableScheduleSlot<T>[] {
  if (!settings.mergeDuplicateBookings) {
    return items.map((item) => ({ ...item, key: `slot:${item.slotId}`, occupancy: [] }));
  }

  const merged: MergeableScheduleSlot<T>[] = [];
  const byKey = new Map<string, MergeableScheduleSlot<T>>();

  items.forEach((item) => {
    const reservationKey = reservationKeyOf(item);
    const occupancyName = spaceNames.get(item.spaceId) ?? containingSpaceName(item);

    if (reservationKey == null) {
      merged.push({ ...item, key: `slot:${item.slotId}`, occupancy: [] });
      return;
    }

    const existing = byKey.get(reservationKey);
    if (!existing) {
      const entry: MergeableScheduleSlot<T> = {
        ...item,
        key: `res:${reservationKey}`,
        occupancy: occupancyName.trim() ? [occupancyName] : [],
      };
      byKey.set(reservationKey, entry);
      merged.push(entry);
      return;
    }

    if (occupancyName.trim() && !existing.occupancy.includes(occupancyName)) {
      existing.occupancy.push(occupancyName);
    }
    // Conservative on privacy: if ANY copy is marked private, the merged card is
    // private. First-wins could print a real reservation name Bond hid.
    if (item.isPrivate) existing.isPrivate = true;
    // First non-null wins, rather than first-wins — the representative copy can
    // legitimately have null notes while a sibling carries them.
    if (existing.notes == null && item.notes != null) existing.notes = item.notes;
    // Each duplicated parent brings its own copy of the same child, so this must
    // dedupe rather than concat — otherwise the duplication just moves one level
    // down and the card shows four identical "Ice Cut" rows.
    item.children.forEach((child) => {
      const childKey = reservationKeyOf(child);
      const alreadyPresent = existing.children.some((seen) =>
        childKey == null ? seen.slotId === child.slotId : reservationKeyOf(seen) === childKey,
      );
      if (!alreadyPresent) existing.children.push(child);
    });
  });

  return merged;
}

/**
 * Renders an occupancy list as "Court 1, Court 2 +6", or null when there is
 * nothing worth showing. Callers must render nothing on null — an empty pill on
 * a lobby TV reads as a rendering bug to the facility staff.
 */
export function formatOccupancyLabel(names: string[], max: number): string | null {
  const usable = names.filter((name) => name.trim());
  if (usable.length === 0) return null;
  const shown = usable.slice(0, max);
  const extra = usable.length - shown.length;
  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ');
}

/**
 * The columns view's per-resource event list: filter/nest, then merge within
 * that single space so a reservation booked on four sub-spaces of one court
 * stops rendering as four identical cards in that court's column.
 */
export function buildResourceEvents(
  space: TvMonitorSpace,
  settings: TvMonitorScheduleBlock,
  spaceNames: Map<number, string>,
): MergeableScheduleSlot<GroupedScheduleSlot>[] {
  return mergeSharedReservations(groupScheduleSlots(space.slots, settings), settings, spaceNames, () => space.name);
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
  /** Page-wide space id -> name, for resolving a slot's booked space when merging. */
  spaceNames: Map<number, string> = buildSpaceNameIndex(spaces),
): MergeableScheduleSlot<FeedScheduleItem>[] {
  const items: FeedScheduleItem[] = [];
  spaces.forEach((space) => {
    const spaceColor = colors.get(space.id) ?? resourceColorFor(0);
    groupScheduleSlots(space.slots, settings).forEach((event) => {
      items.push({ ...event, spaceName: space.name, spaceColor });
    });
  });
  // Merge before sorting: `spaces` is in resourceIds order, so the surviving
  // representative — and the order of its occupancy names — follows the order
  // the operator configured rather than whatever order Bond cascaded them in.
  // The scope is whatever `spaces` the caller passed: all of them for the feed
  // view, one column's worth for each grouped column.
  const merged = mergeSharedReservations(items, settings, spaceNames, (item) => item.spaceName);
  return merged.sort((a, b) => slotStartTimestamp(a) - slotStartTimestamp(b));
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
