import { describe, it, expect } from 'vitest';
import {
  formatEventDuration,
  formatEventTime,
  groupScheduleSlots,
  isSlotHappeningNow,
  resourceColorFor,
  slotStartTimestamp,
} from '@/lib/tvmonitor-schedule-format';
import { buildTvMonitorTemplateConfig } from '@/lib/tvmonitor-templates';
import type { TvMonitorSlot } from '@/types/tvmonitor';

function slot(overrides: Partial<TvMonitorSlot> = {}): TvMonitorSlot {
  return {
    slotId: 1,
    parentSlotId: null,
    reservationId: 1,
    reservationName: 'Practice',
    date: '2026-07-27',
    endDate: '2026-07-27',
    startTime: '10:00:00',
    endTime: '11:00:00',
    notes: null,
    spaceId: 100,
    slotType: 'internal',
    isPrivate: false,
    ...overrides,
  };
}

const settings = buildTvMonitorTemplateConfig('custom').schedule;

describe('formatEventTime / formatEventDuration', () => {
  it('formats times as 12-hour clock', () => {
    expect(formatEventTime('14:30:00')).toMatch(/2:30/);
  });

  it('formats durations in minutes and hours', () => {
    expect(formatEventDuration('10:00:00', '10:45:00')).toBe('45m');
    expect(formatEventDuration('10:00:00', '11:30:00')).toBe('1h 30m');
    expect(formatEventDuration('10:00:00', '12:00:00')).toBe('2h');
  });

  it('returns empty string for zero/negative duration', () => {
    expect(formatEventDuration('10:00:00', '10:00:00')).toBe('');
  });
});

describe('isSlotHappeningNow', () => {
  it('is true when now falls within the slot window', () => {
    const now = new Date('2026-07-27T10:30:00');
    expect(isSlotHappeningNow(slot(), now)).toBe(true);
  });

  it('is false outside the window', () => {
    const now = new Date('2026-07-27T12:00:00');
    expect(isSlotHappeningNow(slot(), now)).toBe(false);
  });
});

describe('groupScheduleSlots', () => {
  it('nests children under their parent by parentSlotId', () => {
    const parent = slot({ slotId: 1 });
    const child = slot({ slotId: 2, parentSlotId: 1, slotType: 'maintenance' });
    const grouped = groupScheduleSlots([parent, child], settings);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].children).toHaveLength(1);
    expect(grouped[0].children[0].slotId).toBe(2);
  });

  it('filters private and maintenance slots per settings', () => {
    const priv = slot({ slotId: 1, isPrivate: true });
    const maint = slot({ slotId: 2, slotType: 'maintenance' });
    const grouped = groupScheduleSlots([priv, maint], {
      ...settings,
      showPrivateEvents: false,
      showMaintenance: false,
    });
    expect(grouped).toHaveLength(0);
  });
});

describe('slotStartTimestamp', () => {
  it('sorts slots chronologically across resources', () => {
    const early = slot({ slotId: 1, startTime: '08:00:00' });
    const late = slot({ slotId: 2, startTime: '18:00:00' });
    const mid = slot({ slotId: 3, startTime: '13:00:00' });
    const sorted = [late, early, mid].sort((a, b) => slotStartTimestamp(a) - slotStartTimestamp(b));
    expect(sorted.map((s) => s.slotId)).toEqual([1, 3, 2]);
  });

  it('pushes unparseable slots to the end', () => {
    const bad = slot({ slotId: 1, date: '', startTime: '' });
    const good = slot({ slotId: 2 });
    const sorted = [bad, good].sort((a, b) => slotStartTimestamp(a) - slotStartTimestamp(b));
    expect(sorted.map((s) => s.slotId)).toEqual([2, 1]);
  });
});

describe('resourceColorFor', () => {
  it('is deterministic and cycles through the palette', () => {
    expect(resourceColorFor(0)).toBe(resourceColorFor(0));
    expect(resourceColorFor(0)).not.toBe(resourceColorFor(1));
  });
});
