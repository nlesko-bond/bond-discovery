import { describe, it, expect } from 'vitest';
import {
  eventMatchesDateRange,
  eventMatchesDaysOfWeek,
  getLocalWeekday,
} from '@/lib/schedule-event-filters';

describe('schedule-event-filters', () => {
  it('getLocalWeekday uses 0–6 Sun–Sat in the given timezone', () => {
    // 2025-03-10 15:00 UTC is a Monday in UTC
    expect(getLocalWeekday('2025-03-10T15:00:00.000Z', 'UTC')).toBe(1);
  });

  it('eventMatchesDateRange filters by local date', () => {
    const event = {
      startDate: '2025-03-10T15:00:00.000Z',
      timezone: 'America/New_York',
    };
    const local = '2025-03-10'; // typical for this instant in NY
    expect(
      eventMatchesDateRange(event, { start: local, end: local }),
    ).toBe(true);
    expect(eventMatchesDateRange(event, { start: '2099-01-01' })).toBe(false);
  });

  it('eventMatchesDaysOfWeek filters when set', () => {
    const event = {
      startDate: '2025-03-10T15:00:00.000Z',
      timezone: 'UTC',
    };
    const monday = getLocalWeekday(event.startDate, 'UTC');
    expect(eventMatchesDaysOfWeek(event, [monday])).toBe(true);
    expect(eventMatchesDaysOfWeek(event, [(monday + 1) % 7])).toBe(false);
    expect(eventMatchesDaysOfWeek(event, undefined)).toBe(true);
    expect(eventMatchesDaysOfWeek(event, [])).toBe(true);
  });
});
