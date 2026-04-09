type EventWithScheduleFields = { startDate: string; timezone?: string };

/** Local calendar date YYYY-MM-DD for an event (matches discovery-events getEventLocalDate). */
export function getEventLocalDateForFilter(event: EventWithScheduleFields): string {
  if (event.timezone) {
    try {
      const d = new Date(event.startDate);
      return d.toLocaleDateString('en-CA', { timeZone: event.timezone });
    } catch {
      // fall through
    }
  }
  return event.startDate.split('T')[0];
}

export function getLocalWeekday(isoDateStr: string, timezone?: string): number {
  const d = new Date(isoDateStr);
  const tz = timezone || 'UTC';
  const dayStr = d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[dayStr] ?? d.getDay();
}

export function eventMatchesDateRange(
  event: EventWithScheduleFields,
  dateRange?: { start?: string; end?: string },
): boolean {
  if (!dateRange?.start && !dateRange?.end) return true;
  const local = getEventLocalDateForFilter(event);
  if (dateRange.start && local < dateRange.start) return false;
  if (dateRange.end && local > dateRange.end) return false;
  return true;
}

export function eventMatchesDaysOfWeek(
  event: EventWithScheduleFields,
  daysOfWeek?: number[],
): boolean {
  if (!daysOfWeek || daysOfWeek.length === 0) return true;
  const wd = getLocalWeekday(event.startDate, event.timezone);
  return daysOfWeek.includes(wd);
}

/** Schedule: filter events whose `spaceName` exactly matches one of the selected labels. */
export function eventMatchesSpaceNames(
  event: { spaceName?: string },
  spaceNames?: string[],
): boolean {
  if (!spaceNames || spaceNames.length === 0) return true;
  const selected = new Set(spaceNames.map((s) => s.trim()).filter(Boolean));
  const sn = (event.spaceName || '').trim();
  return sn.length > 0 && selected.has(sn);
}
