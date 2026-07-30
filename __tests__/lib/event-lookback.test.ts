import { describe, expect, it } from 'vitest';
import {
  clampEventLookbackDays,
  getDefaultScheduleDateRangeForLookback,
  getEventLookbackStartDate,
  getScheduleDateBounds,
  resolveInitialScheduleDateRange,
  shouldApplyScheduleEventDateFilters,
} from '@/lib/event-lookback';

describe('event lookback helpers', () => {
  const fixedNow = new Date('2026-07-30T15:00:00');

  it('clamps lookback to 0–30', () => {
    expect(clampEventLookbackDays(undefined)).toBe(0);
    expect(clampEventLookbackDays(-3)).toBe(0);
    expect(clampEventLookbackDays(7.9)).toBe(7);
    expect(clampEventLookbackDays(99)).toBe(30);
  });

  it('computes lookback start date', () => {
    expect(getEventLookbackStartDate(0, fixedNow)).toBe('2026-07-30');
    expect(getEventLookbackStartDate(7, fixedNow)).toBe('2026-07-23');
  });

  it('defaults schedule range to today only when lookback is enabled', () => {
    expect(getDefaultScheduleDateRangeForLookback(0, fixedNow)).toEqual({});
    expect(getDefaultScheduleDateRangeForLookback(7, fixedNow)).toEqual({
      start: '2026-07-30',
    });
  });

  it('resolves initial range from URL within bounds', () => {
    expect(
      resolveInitialScheduleDateRange({
        lookbackDays: 7,
        horizonMonths: 3,
        urlStart: '2026-07-25',
        now: fixedNow,
      }),
    ).toEqual({ start: '2026-07-25' });

    expect(
      resolveInitialScheduleDateRange({
        lookbackDays: 7,
        horizonMonths: 3,
        urlStart: '2026-06-01',
        now: fixedNow,
      }),
    ).toEqual({ start: '2026-07-23' });
  });

  it('exposes schedule bounds and date-filter gating', () => {
    const bounds = getScheduleDateBounds(7, 3, fixedNow);
    expect(bounds.minDate).toBe('2026-07-23');
    expect(bounds.today).toBe('2026-07-30');
    expect(bounds.maxDate).toBe('2026-10-30');

    expect(
      shouldApplyScheduleEventDateFilters({
        showScheduleTableDateFilters: false,
        eventLookbackDays: 0,
      }),
    ).toBe(false);
    expect(
      shouldApplyScheduleEventDateFilters({
        showScheduleTableDateFilters: false,
        eventLookbackDays: 7,
      }),
    ).toBe(true);
  });
});
