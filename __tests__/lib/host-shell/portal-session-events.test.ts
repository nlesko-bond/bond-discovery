import { describe, it, expect } from 'vitest';
import {
  buildSessionScheduleSummary,
  formatSessionTimeChipLabel,
  summarizeSessionTimeChips,
  type IHostPortalSessionTimeChip,
} from '@/lib/host-shell/portal-session-events';

function buildChip(
  overrides: Partial<IHostPortalSessionTimeChip> = {},
): IHostPortalSessionTimeChip {
  return {
    eventId: 'evt-1',
    dayLabel: 'Sat',
    timeLabel: '9:00 AM',
    spotsLabel: '10 left',
    isFull: false,
    ...overrides,
  };
}

describe('formatSessionTimeChipLabel', () => {
  it('includes start and end time when end time is present', () => {
    const label = formatSessionTimeChipLabel(
      buildChip({ endTimeLabel: '10:00 AM' }),
    );
    expect(label).toBe('Sat · 9:00 AM - 10:00 AM · 10 left');
  });

  it('uses start time only when end time is missing', () => {
    const label = formatSessionTimeChipLabel(buildChip());
    expect(label).toBe('Sat · 9:00 AM · 10 left');
  });
});

describe('summarizeSessionTimeChips', () => {
  it('summarizes session count and day names', () => {
    const summary = summarizeSessionTimeChips([
      buildChip({ dayLabel: 'Sat' }),
      buildChip({ eventId: 'evt-2', dayLabel: 'Tue' }),
    ]);
    expect(summary).toBe('2 sessions · Sat, Tue');
  });
});

describe('buildSessionScheduleSummary', () => {
  it('returns undefined when there are no chips', () => {
    expect(buildSessionScheduleSummary([])).toBeUndefined();
  });

  it('shows the shared time when every slot starts at the same time', () => {
    const summary = buildSessionScheduleSummary([
      buildChip({ dayLabel: 'Tue', timeLabel: '9:30 AM' }),
      buildChip({ eventId: 'e2', dayLabel: 'Thu', timeLabel: '9:30 AM' }),
    ]);
    expect(summary).toBe('Tue, Thu · 9:30 AM');
  });

  it('orders days Sunday-first regardless of input order', () => {
    const summary = buildSessionScheduleSummary([
      buildChip({ dayLabel: 'Fri', timeLabel: '9:30 AM' }),
      buildChip({ eventId: 'e2', dayLabel: 'Mon', timeLabel: '9:30 AM' }),
    ]);
    expect(summary).toBe('Mon, Fri · 9:30 AM');
  });

  it('dedupes repeated day/time slots (many weeks of the same class)', () => {
    const summary = buildSessionScheduleSummary([
      buildChip({ dayLabel: 'Tue', timeLabel: '9:30 AM', spotsLabel: '5 left' }),
      buildChip({ eventId: 'e2', dayLabel: 'Tue', timeLabel: '9:30 AM', spotsLabel: '3 left' }),
    ]);
    expect(summary).toBe('Tue · 9:30 AM');
  });

  it('collapses varying times to "multiple times"', () => {
    const summary = buildSessionScheduleSummary([
      buildChip({ dayLabel: 'Tue', timeLabel: '9:30 AM' }),
      buildChip({ eventId: 'e2', dayLabel: 'Tue', timeLabel: '10:30 AM' }),
    ]);
    expect(summary).toBe('Tue · multiple times');
  });
});
