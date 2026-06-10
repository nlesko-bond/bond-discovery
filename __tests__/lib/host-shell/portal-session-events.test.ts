import { describe, expect, it } from 'vitest';
import {
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
