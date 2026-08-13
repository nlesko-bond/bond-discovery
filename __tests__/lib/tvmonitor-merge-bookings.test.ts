import { describe, it, expect } from 'vitest';
import {
  buildFeedItems,
  buildResourceColors,
  buildResourceEvents,
  buildScheduleGroupColumns,
  buildSpaceNameIndex,
  formatOccupancyLabel,
  reservationKeyOf,
} from '@/lib/tvmonitor-schedule-format';
import { normalizeTvMonitorConfig } from '@/lib/tvmonitor-config';
import { buildMansfieldSchedule, MANSFIELD_RESOURCE_IDS } from '@/__tests__/fixtures/tvmonitor-mansfield';
import type { TvMonitorScheduleBlock, TvMonitorSpace } from '@/types/tvmonitor';

function settings(overrides: Record<string, unknown> = {}): TvMonitorScheduleBlock {
  return normalizeTvMonitorConfig({
    schedule: { resourceIds: MANSFIELD_RESOURCE_IDS, ...overrides },
  }).schedule;
}

const ON = settings({ mergeDuplicateBookings: true });
const OFF = settings({ mergeDuplicateBookings: false });

function spacesOf(): TvMonitorSpace[] {
  return buildMansfieldSchedule().spaces;
}
function feed(s: TvMonitorScheduleBlock, spaces = spacesOf()) {
  return buildFeedItems(spaces, s, buildResourceColors(spaces));
}
function names(spaces = spacesOf()) {
  return buildSpaceNameIndex(spaces);
}

describe('mergeDuplicateBookings — off is a no-op', () => {
  it('leaves feed output identical to the unmerged slot list apart from the added key/occupancy', () => {
    const spaces = spacesOf();
    const items = feed(OFF, spaces);
    // Every visible parent slot still has its own card.
    const rawParents = spaces.flatMap((s) => s.slots.filter((sl) => sl.parentSlotId == null));
    expect(items).toHaveLength(rawParents.length);
    expect(items.map((i) => i.slotId).sort()).toEqual(rawParents.map((s) => s.slotId).sort());
    items.forEach((item) => {
      expect(item.key).toBe(`slot:${item.slotId}`);
      expect(item.occupancy).toEqual([]);
    });
  });

  it('leaves each column untouched', () => {
    const spaces = spacesOf();
    const court7 = spaces.find((s) => s.name === 'Court 7')!;
    expect(buildResourceEvents(court7, OFF, names(spaces))).toHaveLength(4);
  });
});

describe('mergeDuplicateBookings — scopes', () => {
  it('feed scope collapses the whole board to one card per reservation', () => {
    const before = feed(OFF);
    const after = feed(ON);
    // 6 TAV (1 in Court 6, 4 in Court 7, 1 in Court 8) + 2 St. Paul + Solo + 2 Walk-in
    expect(before.length).toBe(11);
    // TAV x6 -> 1, St. Paul x2 -> 1, Solo and the two null-reservation walk-ins untouched.
    expect(after.length).toBe(5);
    expect(after.filter((i) => i.reservationName === 'TAV Volleyball')).toHaveLength(1);
    expect(after.filter((i) => i.reservationName === 'St. Paul Volleyball')).toHaveLength(1);
  });

  it('columns scope collapses within a column but keeps the event in every column it occupies', () => {
    const spaces = spacesOf();
    const index = names(spaces);
    const perColumn = spaces.map((space) => ({
      name: space.name,
      tav: buildResourceEvents(space, ON, index).filter((e) => e.reservationName === 'TAV Volleyball').length,
    }));
    // Court 7 had 4 copies -> 1. Courts 6 and 8 keep their single card each.
    expect(perColumn).toEqual(
      expect.arrayContaining([
        { name: 'Court 7', tav: 1 },
        { name: 'Court 6', tav: 1 },
        { name: 'Court 8', tav: 1 },
        { name: 'Court 1', tav: 0 },
      ]),
    );
  });

  it('grouped scope yields one card per group column the booking touches', () => {
    const spaces = spacesOf();
    const grouped = settings({
      viewMode: 'grouped',
      mergeDuplicateBookings: true,
      groups: [
        { id: 'low', label: 'Courts 1-6', resourceIds: [8009, 8010, 8013, 8014] },
        { id: 'high', label: 'Courts 7-8', resourceIds: [8015, 8016] },
      ],
    });
    const colors = buildResourceColors(spaces);
    const index = buildSpaceNameIndex(spaces);
    const columns = buildScheduleGroupColumns(spaces, grouped).map((c) => ({
      label: c.label,
      tav: buildFeedItems(c.spaces, grouped, colors, index).filter((i) => i.reservationName === 'TAV Volleyball').length,
    }));
    expect(columns).toEqual([
      { label: 'Courts 1-6', tav: 1 },
      { label: 'Courts 7-8', tav: 1 },
    ]);
  });
});

describe('mergeDuplicateBookings — merge safety', () => {
  it('never merges slots without a reservationId, even when every other field matches', () => {
    const walkIns = feed(ON).filter((i) => i.reservationName === 'Walk-in');
    expect(walkIns).toHaveLength(2);
    expect(new Set(walkIns.map((w) => w.key)).size).toBe(2);
  });

  it('never merges the same reservation across different dates', () => {
    const spaces = spacesOf();
    const a = spaces[1].slots[0];
    const b = { ...a, slotId: 9999, date: '2026-08-14', endDate: '2026-08-14' };
    expect(reservationKeyOf(a)).not.toBe(reservationKeyOf(b));
  });

  it('treats the merged card as private if ANY copy is private', () => {
    const spaces = spacesOf();
    const court7 = spaces.find((s) => s.name === 'Court 7')!;
    // Mark only the LAST copy private; the representative is the first.
    const parents = court7.slots.filter((s) => s.parentSlotId == null);
    parents[parents.length - 1].isPrivate = true;
    const merged = buildResourceEvents(court7, ON, names(spaces));
    expect(merged).toHaveLength(1);
    expect(merged[0].isPrivate).toBe(true);
  });

  it('keeps notes from a later copy when the representative has none', () => {
    const spaces = spacesOf();
    const court7 = spaces.find((s) => s.name === 'Court 7')!;
    const parents = court7.slots.filter((s) => s.parentSlotId == null);
    expect(parents[0].notes).toBeNull();
    parents[2].notes = 'Bring your own ball';
    const merged = buildResourceEvents(court7, ON, names(spaces));
    expect(merged[0].notes).toBe('Bring your own ball');
  });

  it('dedupes duplicated children instead of unioning them into four identical rows', () => {
    const spaces = spacesOf();
    const court7 = spaces.find((s) => s.name === 'Court 7')!;
    // Four parent copies each carry their own "Ice Cut" child.
    expect(court7.slots.filter((s) => s.parentSlotId != null)).toHaveLength(4);
    const merged = buildResourceEvents(court7, ON, names(spaces));
    expect(merged[0].children).toHaveLength(1);
  });
});

describe('mergeDuplicateBookings — occupancy naming', () => {
  it('uses the booked space name when that space is a configured resource', () => {
    const stPaul = feed(ON).find((i) => i.reservationName === 'St. Paul Volleyball')!;
    // Booked on Court 5 (8013), which is configured — so the booked name wins
    // even though it also displays under Court 6.
    expect(stPaul.occupancy).toEqual(['Court 5']);
  });

  it('falls back to the displaying column when the booked sub-space is not configured', () => {
    const tav = feed(ON).find((i) => i.reservationName === 'TAV Volleyball')!;
    // Booked on 9001-9004, none configured -> falls back to the courts it shows under,
    // in resourceIds order rather than Bond's cascade order.
    expect(tav.occupancy).toEqual(['Court 6', 'Court 7', 'Court 8']);
  });

  it('scopes occupancy to the spaces passed in, so a grouped column names only its own', () => {
    const spaces = spacesOf();
    const highCourts = spaces.filter((s) => ['Court 7', 'Court 8'].includes(s.name));
    const tav = buildFeedItems(highCourts, ON, buildResourceColors(spaces), buildSpaceNameIndex(spaces)).find(
      (i) => i.reservationName === 'TAV Volleyball',
    )!;
    expect(tav.occupancy).toEqual(['Court 7', 'Court 8']);
  });
});

describe('listAllSpacesInFeed', () => {
  it('caps the pill at two names by default', () => {
    const tav = feed(ON).find((i) => i.reservationName === 'TAV Volleyball')!;
    expect(formatOccupancyLabel(tav.occupancy, 2)).toBe('Court 6, Court 7 +1');
  });

  it('lists every booked resource when uncapped', () => {
    const tav = feed(ON).find((i) => i.reservationName === 'TAV Volleyball')!;
    expect(formatOccupancyLabel(tav.occupancy, Number.POSITIVE_INFINITY)).toBe('Court 6, Court 7, Court 8');
  });

  it('defaults off so an existing feed board keeps the capped pill', () => {
    expect(OFF.listAllSpacesInFeed).toBe(false);
    expect(normalizeTvMonitorConfig({}).schedule.listAllSpacesInFeed).toBe(false);
  });
});

describe('formatOccupancyLabel', () => {
  it('joins up to max and counts the rest', () => {
    expect(formatOccupancyLabel(['Court 1', 'Court 2'], 2)).toBe('Court 1, Court 2');
    expect(formatOccupancyLabel(['Court 1', 'Court 2', 'Court 3'], 2)).toBe('Court 1, Court 2 +1');
  });

  it('returns null rather than an empty label, so callers render nothing at all', () => {
    expect(formatOccupancyLabel([], 2)).toBeNull();
    expect(formatOccupancyLabel(['', '   '], 2)).toBeNull();
  });
});
