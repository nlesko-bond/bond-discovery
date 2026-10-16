import { describe, expect, it } from 'vitest';
import {
  buildSessionScheduleSummaries,
  formatWeekdays,
  summarizeSessionSchedule,
  type SessionScheduleEvent,
} from '@/lib/session-schedule-summary';

const TZ = 'America/Phoenix';
const PHOENIX_UTC_OFFSET_HOURS = 7;

/** Builds an event from a Phoenix wall-clock date and times (UTC-7 all year, no DST). */
function event(date: string, start: string, end?: string, sessionId = 's1'): SessionScheduleEvent {
  const toUtc = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour + PHOENIX_UTC_OFFSET_HOURS, minute)).toISOString();
  };
  return {
    sessionId,
    timezone: TZ,
    startDate: toUtc(start),
    endDate: end ? toUtc(end) : undefined,
  };
}

/** Weekly occurrences starting on `firstDate` (YYYY-MM-DD) for `weeks` weeks. */
function weekly(firstDate: string, weeks: number, start: string, end: string): SessionScheduleEvent[] {
  const first = new Date(`${firstDate}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, week) => {
    const day = new Date(first.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    return event(day.toISOString().slice(0, 10), start, end);
  });
}

describe('formatWeekdays', () => {
  it('joins two days with &', () => {
    expect(formatWeekdays([1, 3])).toBe('Tue & Thu');
  });

  it('collapses three or more consecutive days into a range', () => {
    expect(formatWeekdays([0, 1, 2])).toBe('Mon–Wed');
    expect(formatWeekdays([0, 1, 2, 3, 4])).toBe('Mon–Fri');
  });

  it('lists non-consecutive days Monday-first', () => {
    expect(formatWeekdays([4, 0, 2])).toBe('Mon, Wed, Fri');
  });
});

describe('summarizeSessionSchedule', () => {
  it('returns nothing without usable events', () => {
    expect(summarizeSessionSchedule([])).toEqual([]);
    expect(summarizeSessionSchedule([{ sessionId: 's1', startDate: '2026-10-20T21:00:00Z' }])).toEqual([]);
    expect(
      summarizeSessionSchedule([{ sessionId: 's1', timezone: 'Not/AZone', startDate: '2026-10-20T21:00:00Z' }]),
    ).toEqual([]);
  });

  it('shows a single event as its weekday and time', () => {
    expect(summarizeSessionSchedule([event('2026-10-17', '9:00', '9:55')])).toEqual(['Sat · 9–9:55 AM']);
  });

  it('converts to the event timezone', () => {
    const lines = summarizeSessionSchedule([
      { sessionId: 's1', timezone: 'America/New_York', startDate: '2026-10-20T22:30:00Z', endDate: '2026-10-21T00:00:00Z' },
    ]);
    expect(lines).toEqual(['Tue · 6:30–8 PM']);
  });

  it('summarizes a weekly multi-day pattern on one line', () => {
    const events = [
      ...weekly('2026-10-20', 6, '15:30', '17:00'),
      ...weekly('2026-10-22', 6, '15:30', '17:00'),
    ];
    expect(summarizeSessionSchedule(events)).toEqual(['Tue & Thu · 3:30–5 PM']);
  });

  it('writes AM/PM on both ends when the range crosses noon', () => {
    expect(summarizeSessionSchedule(weekly('2026-10-19', 3, '9:00', '13:00'))).toEqual(['Mon · 9 AM–1 PM']);
  });

  it('gives each distinct days/time pattern its own line, ordered Monday-first', () => {
    const events = [...weekly('2026-10-24', 4, '9:00', '9:55'), ...weekly('2026-10-22', 4, '16:00', '16:55')];
    expect(summarizeSessionSchedule(events)).toEqual(['Thu · 4–4:55 PM', 'Sat · 9–9:55 AM']);
  });

  it('says "Multiple times" for back-to-back slots on the same day', () => {
    const events = ['16:30', '17:00', '17:30', '18:00'].flatMap((start) => {
      const [hour, minute] = start.split(':').map(Number);
      const end = `${minute === 30 ? hour + 1 : hour}:${minute === 30 ? '00' : '30'}`;
      return weekly('2026-10-21', 3, start, end);
    });
    expect(summarizeSessionSchedule(events)).toEqual(['Wed · Multiple times, 4:30–6:30 PM']);
  });

  it('notes a shared start when only the end times differ', () => {
    const events = [...weekly('2026-10-19', 4, '9:00', '13:00'), ...weekly('2026-10-19', 4, '9:00', '16:00')];
    expect(summarizeSessionSchedule(events)).toEqual(['Mon · Starts 9 AM, end times vary']);
  });

  it('labels scattered, non-weekly dates as "Select dates"', () => {
    const events = [
      event('2026-10-19', '9:00', '16:00'),
      event('2026-11-06', '9:00', '16:00'),
      event('2026-11-25', '9:00', '16:00'),
      event('2027-01-18', '9:00', '16:00'),
    ];
    expect(summarizeSessionSchedule(events)).toEqual(['Select dates · 9 AM–4 PM']);
  });

  it('treats a single-week run of consecutive days as weekly', () => {
    const events = ['2026-12-21', '2026-12-22', '2026-12-23'].map((date) => event(date, '9:00', '16:00'));
    expect(summarizeSessionSchedule(events)).toEqual(['Mon–Wed · 9 AM–4 PM']);
  });

  it('folds a rare one-off time into "+N other times" instead of its own line', () => {
    const events = [
      ...weekly('2026-10-20', 12, '16:00', '16:55'),
      event('2026-11-14', '10:00', '11:00'),
    ];
    expect(summarizeSessionSchedule(events)).toEqual(['Tue · 4–4:55 PM · +1 other time']);
  });

  it('does not fold a slot that is a sizeable share of the events', () => {
    const events = [...weekly('2026-10-20', 6, '16:00', '16:55'), ...weekly('2026-10-24', 2, '10:00', '11:00')];
    expect(summarizeSessionSchedule(events)).toEqual(['Select dates · Multiple times, 10 AM–4:55 PM']);
  });

  it('collapses more than two lines into "Times vary"', () => {
    const events = [
      ...weekly('2026-10-19', 3, '9:00', '10:00'),
      ...weekly('2026-10-21', 3, '12:00', '13:00'),
      ...weekly('2026-10-23', 3, '17:00', '18:00'),
    ];
    expect(summarizeSessionSchedule(events)).toEqual(['Mon, Wed, Fri · Times vary']);
  });

  it('ignores duplicate events with identical times', () => {
    const events = weekly('2026-10-20', 3, '16:00', '16:55');
    expect(summarizeSessionSchedule([...events, ...events])).toEqual(['Tue · 4–4:55 PM']);
  });

  it('shows the start alone when events have no end time', () => {
    expect(summarizeSessionSchedule([event('2026-10-20', '18:00')])).toEqual(['Tue · 6 PM']);
  });
});

describe('buildSessionScheduleSummaries', () => {
  it('keys summaries by session id and skips sessions without usable events', () => {
    const summaries = buildSessionScheduleSummaries([
      event('2026-10-20', '16:00', '16:55', 'a'),
      event('2026-10-23', '18:00', '19:00', 'b'),
      { sessionId: 'c', startDate: 'not-a-date', timezone: TZ },
      { startDate: '2026-10-20T21:00:00Z', timezone: TZ },
    ]);
    expect(Object.fromEntries(summaries)).toEqual({
      a: ['Tue · 4–4:55 PM'],
      b: ['Fri · 6–7 PM'],
    });
  });
});
