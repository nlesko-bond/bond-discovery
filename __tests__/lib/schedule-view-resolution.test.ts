import { describe, it, expect } from 'vitest';
import {
  resolveScheduleViewMode,
  shouldRewriteScheduleViewParam,
} from '@/lib/schedule-view-resolution';

describe('resolveScheduleViewMode', () => {
  const base = {
    allowTableOnMobile: false,
    desktopDefaultView: 'list' as const,
    mobileDefaultRaw: undefined as undefined | 'list' | 'table' | 'day' | 'week' | 'month',
  };

  it('on narrow, scheduleView=table without allow uses mobile default path (not table)', () => {
    expect(
      resolveScheduleViewMode('table', true, {
        ...base,
        desktopDefaultView: 'week',
        mobileDefaultRaw: 'day',
      }),
    ).toBe('day');
  });

  it('on narrow, scheduleView=table without allow falls back to desktop when mobile unset', () => {
    expect(
      resolveScheduleViewMode('table', true, {
        ...base,
        desktopDefaultView: 'week',
      }),
    ).toBe('week');
  });

  it('on narrow, scheduleView=table with allow stays table', () => {
    expect(
      resolveScheduleViewMode('table', true, {
        ...base,
        allowTableOnMobile: true,
      }),
    ).toBe('table');
  });

  it('on wide, scheduleView=table stays table even without allow (desktop)', () => {
    expect(
      resolveScheduleViewMode('table', false, {
        ...base,
        allowTableOnMobile: false,
      }),
    ).toBe('table');
  });

  it('on narrow without param uses mobile default', () => {
    expect(
      resolveScheduleViewMode(null, true, {
        ...base,
        mobileDefaultRaw: 'month',
      }),
    ).toBe('month');
  });

  it('on narrow without param falls back to desktop default', () => {
    expect(
      resolveScheduleViewMode(null, true, {
        ...base,
        desktopDefaultView: 'week',
      }),
    ).toBe('week');
  });

  it('on wide without param uses desktop default', () => {
    expect(
      resolveScheduleViewMode(null, false, {
        ...base,
        desktopDefaultView: 'month',
      }),
    ).toBe('month');
  });

  it('on narrow, honors non-table URL params', () => {
    expect(
      resolveScheduleViewMode('week', true, {
        ...base,
        mobileDefaultRaw: 'list',
      }),
    ).toBe('week');
  });

  it('strips table from auto default on narrow when mobile default is table and not allowed', () => {
    expect(
      resolveScheduleViewMode(null, true, {
        ...base,
        desktopDefaultView: 'list',
        mobileDefaultRaw: 'table',
      }),
    ).toBe('list');
  });

  it('strips table from auto default on narrow when only desktop is table and not allowed', () => {
    expect(
      resolveScheduleViewMode(null, true, {
        ...base,
        desktopDefaultView: 'table',
        mobileDefaultRaw: undefined,
      }),
    ).toBe('list');
  });
});

describe('shouldRewriteScheduleViewParam', () => {
  it('returns false when narrow URL table is ignored so link preserves desktop intent', () => {
    expect(
      shouldRewriteScheduleViewParam('table', true, false, 'list'),
    ).toBe(false);
  });

  it('returns true when resolved view matches URL or wide', () => {
    expect(shouldRewriteScheduleViewParam('table', false, false, 'table')).toBe(
      true,
    );
    expect(shouldRewriteScheduleViewParam('week', true, false, 'week')).toBe(
      true,
    );
  });
});
