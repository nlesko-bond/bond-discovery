import { describe, expect, it } from 'vitest';
import {
  resolveTimeZone,
  timeZoneLabel,
  toDateColumns,
  zonedDateKey,
  zonedLongDate,
  zonedShortDate,
  zonedTime,
  zonedTimeWithZone,
  zonedWeekday,
} from '@/lib/roster-time';

const LA = 'America/Los_Angeles';
const NY = 'America/New_York';
const TOKYO = 'Asia/Tokyo';

/** Fri 14 Aug 2026, 19:00 in Los Angeles === Sat 15 Aug 02:00 UTC. */
const FRIDAY_EVENING_LA = '2026-08-15T02:00:00Z';

describe('resolveTimeZone', () => {
  it('takes the first valid candidate', () => {
    expect(resolveTimeZone(undefined, NY, LA)).toBe(NY);
  });

  it('skips malformed zones rather than throwing', () => {
    expect(resolveTimeZone('Not/AZone', LA)).toBe(LA);
  });

  it('falls back to UTC when nothing is valid', () => {
    expect(resolveTimeZone(undefined, null, '')).toBe('UTC');
  });
});

describe('zonedDateKey', () => {
  it('buckets a Friday-evening LA event into Friday, not Saturday', () => {
    expect(zonedDateKey(FRIDAY_EVENING_LA, LA)).toBe('2026-08-14');
  });

  it('shows why a naive ISO slice would be wrong', () => {
    expect(new Date(FRIDAY_EVENING_LA).toISOString().slice(0, 10)).toBe('2026-08-15');
    expect(zonedDateKey(FRIDAY_EVENING_LA, LA)).not.toBe('2026-08-15');
  });

  it('buckets the same instant differently per zone', () => {
    expect(zonedDateKey(FRIDAY_EVENING_LA, NY)).toBe('2026-08-14');
    expect(zonedDateKey(FRIDAY_EVENING_LA, TOKYO)).toBe('2026-08-15');
  });

  it('sorts lexicographically', () => {
    const keys = ['2026-09-01', '2026-08-14', '2026-12-03'].sort();
    expect(keys).toEqual(['2026-08-14', '2026-09-01', '2026-12-03']);
  });

  it('returns an empty key for missing or unparseable input', () => {
    expect(zonedDateKey(undefined, LA)).toBe('');
    expect(zonedDateKey('nonsense', LA)).toBe('');
  });

  it('falls back to UTC for an invalid zone instead of throwing', () => {
    expect(zonedDateKey(FRIDAY_EVENING_LA, 'Not/AZone')).toBe('2026-08-15');
  });
});

describe('display helpers', () => {
  it('formats the short date and weekday in the facility zone', () => {
    expect(zonedShortDate(FRIDAY_EVENING_LA, LA)).toBe('8/14');
    expect(zonedWeekday(FRIDAY_EVENING_LA, LA)).toBe('Fr');
    expect(zonedShortDate(FRIDAY_EVENING_LA, TOKYO)).toBe('8/15');
  });

  it('formats the time of day in the facility zone', () => {
    expect(zonedTime(FRIDAY_EVENING_LA, LA)).toBe('7:00 PM');
    expect(zonedTime(FRIDAY_EVENING_LA, NY)).toBe('10:00 PM');
  });

  it('states the zone alongside the time', () => {
    expect(zonedTimeWithZone(FRIDAY_EVENING_LA, LA)).toBe('7:00 PM PDT');
    expect(zonedTimeWithZone(FRIDAY_EVENING_LA, NY)).toBe('10:00 PM EDT');
  });

  it('resolves the zone label per instant, so DST is reflected', () => {
    expect(timeZoneLabel('2026-08-15T02:00:00Z', NY)).toBe('EDT');
    expect(timeZoneLabel('2026-01-15T17:00:00Z', NY)).toBe('EST');
  });

  it('formats a long date for sheet headers', () => {
    expect(zonedLongDate(FRIDAY_EVENING_LA, LA)).toBe('Fri, Aug 14, 2026');
  });

  it('returns empty strings for missing input rather than "Invalid Date"', () => {
    expect(zonedTime(undefined, LA)).toBe('');
    expect(zonedTimeWithZone(null, LA)).toBe('');
    expect(zonedLongDate('nonsense', LA)).toBe('');
    expect(zonedShortDate(undefined, LA)).toBe('');
  });
});

describe('toDateColumns', () => {
  it('produces one ascending column per calendar day', () => {
    const columns = toDateColumns(
      [
        { startTime: '2026-09-12T01:00:00Z' },
        { startTime: '2026-09-05T01:00:00Z' },
        { startTime: '2026-09-19T01:00:00Z' },
      ],
      LA
    );
    expect(columns.map((c) => c.short)).toEqual(['9/4', '9/11', '9/18']);
    expect(columns.map((c) => c.weekday)).toEqual(['Fr', 'Fr', 'Fr']);
  });

  it('collapses a doubleheader into a single column', () => {
    const columns = toDateColumns(
      [{ startTime: '2026-09-12T01:00:00Z' }, { startTime: '2026-09-12T03:00:00Z' }],
      LA
    );
    expect(columns).toHaveLength(1);
  });

  it('falls back to startDate when startTime is absent', () => {
    const columns = toDateColumns([{ startDate: '2026-09-05' }], LA);
    expect(columns).toHaveLength(1);
  });

  it('skips events with no usable date', () => {
    expect(toDateColumns([{}, { startTime: 'nonsense' }], LA)).toEqual([]);
  });
});
