/**
 * A reduced-scale reproduction of the real duplication Bond returns for
 * dependent / parent-child spaces, taken from facility 673 (Mansfield).
 *
 * The real payload had 36 spaces and 33 slot rows for 4 actual reservations,
 * with one reservation appearing 20 times — including 4 times inside a single
 * column, because it was booked on 4 sub-spaces that all cascade into the same
 * court. The shape is what matters here, not the volume, so this keeps 8 courts
 * and reproduces every structural case:
 *
 *  - TAV: booked on 4 sub-spaces (9001-9004) that are NOT configured resources,
 *    so booked-name resolution fails and the merge falls back to court names.
 *    Appears 4x inside Court 7 and once each under Courts 6 and 8.
 *  - ST_PAUL: booked on Court 5 itself (a configured resource, so booked-name
 *    resolution succeeds), cascading onto Court 6.
 *  - SOLO: a single-space control that must never be touched by the merge.
 *  - NO_RESERVATION: two rows with reservationId null that must never merge,
 *    even though every other field matches.
 *  - TAV carries a maintenance child duplicated once per parent copy — the case
 *    that turns a naive children union into 4 identical "Ice Cut" rows.
 */

import type { TvMonitorSchedulePayload, TvMonitorSlot } from '@/types/tvmonitor';

export const MANSFIELD_DATE = '2026-08-13';

/** Configured resources. Note 9001-9004 are deliberately absent — they are booked-only sub-spaces. */
export const MANSFIELD_RESOURCE_IDS = [8009, 8010, 8013, 8014, 8015, 8016];

let nextSlotId = 1;

function slot(overrides: Partial<TvMonitorSlot> & { spaceId: number }): TvMonitorSlot {
  return {
    slotId: nextSlotId++,
    parentSlotId: null,
    reservationId: null,
    reservationName: '',
    date: MANSFIELD_DATE,
    endDate: MANSFIELD_DATE,
    startTime: '17:00:00',
    endTime: '22:00:00',
    notes: null,
    slotType: 'external',
    isPrivate: false,
    ...overrides,
  };
}

/**
 * One TAV copy plus its duplicated maintenance child. Each copy is a distinct
 * slotId booked on a distinct sub-space — exactly why slotId cannot be the
 * dedup key.
 */
function tavCopy(bookedSpaceId: number, opts: { notes?: string | null; isPrivate?: boolean } = {}): TvMonitorSlot[] {
  const parent = slot({
    spaceId: bookedSpaceId,
    reservationId: 406453,
    reservationName: 'TAV Volleyball',
    notes: opts.notes ?? null,
    isPrivate: opts.isPrivate ?? false,
  });
  const child = slot({
    spaceId: bookedSpaceId,
    parentSlotId: parent.slotId,
    reservationId: 406453,
    reservationName: 'Ice Cut',
    slotType: 'maintenance',
    startTime: '22:00:00',
    endTime: '22:15:00',
  });
  return [parent, child];
}

function stPaulCopy(bookedSpaceId: number): TvMonitorSlot {
  return slot({
    spaceId: bookedSpaceId,
    reservationId: 434121,
    reservationName: 'St. Paul Volleyball',
    startTime: '14:00:00',
    endTime: '16:00:00',
  });
}

export function buildMansfieldSchedule(): TvMonitorSchedulePayload {
  nextSlotId = 1;
  return {
    facilityId: 673,
    facilityName: 'Mansfield Fieldhouse',
    spaces: [
      { id: 8009, name: 'Court 1', slots: [] },
      {
        id: 8010,
        name: 'Court 2',
        slots: [
          // Single-space control — one reservation, one space, nothing to merge.
          slot({ spaceId: 8010, reservationId: 999001, reservationName: 'Solo Booking', startTime: '09:00:00', endTime: '10:00:00' }),
          // Null reservationId pair: identical in every other field, must stay 2 cards.
          slot({ spaceId: 8010, reservationName: 'Walk-in', startTime: '11:00:00', endTime: '12:00:00' }),
          slot({ spaceId: 8010, reservationName: 'Walk-in', startTime: '11:00:00', endTime: '12:00:00' }),
        ],
      },
      {
        id: 8013,
        name: 'Court 5',
        // Booked on Court 5 itself, which IS a configured resource -> booked-name path.
        slots: [stPaulCopy(8013)],
      },
      {
        id: 8014,
        name: 'Court 6',
        slots: [stPaulCopy(8013), ...tavCopy(9001)],
      },
      {
        id: 8015,
        name: 'Court 7',
        // The pathological case: 4 copies of one reservation inside ONE column.
        slots: [...tavCopy(9001), ...tavCopy(9002), ...tavCopy(9003), ...tavCopy(9004)],
      },
      {
        id: 8016,
        name: 'Court 8',
        slots: [...tavCopy(9004)],
      },
    ],
    fetchedAt: `${MANSFIELD_DATE}T17:30:00.000Z`,
  };
}
