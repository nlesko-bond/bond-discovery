/**
 * Facility-timezone date and time handling for roster surfaces.
 *
 * Every time we show must be the facility's local time, with the zone stated —
 * a printed check-in sheet travels, and "7:00 PM" with no zone is ambiguous the
 * moment an org runs sites in two zones.
 *
 * The subtle part is not display, it is *bucketing*. Check-in and matrix
 * columns are days, so a Friday 19:00 event in America/Los_Angeles must land in
 * Friday's column, not Saturday's. `toISOString().slice(0, 10)` gets that wrong
 * on any server not running in the facility's zone, so use `zonedDateKey`.
 *
 * Note the participant endpoints carry no time data at all: the timezone comes
 * from `expand=facility` on the groups call, or from an event's own `timezone`.
 */

const FALLBACK_TIME_ZONE = 'UTC';

function isValidTimeZone(timeZone: string | undefined | null): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pick the timezone to render a session in, preferring the facility's own.
 * Falls back through the supplied candidates, then UTC — never throws, so a
 * malformed value from Bond degrades to a labelled UTC time rather than a
 * crashed page.
 */
export function resolveTimeZone(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    if (isValidTimeZone(candidate)) return candidate;
  }
  return FALLBACK_TIME_ZONE;
}

function parse(value: string | Date | undefined | null): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * `YYYY-MM-DD` as observed in `timeZone`. This is the grouping key for
 * check-in and matrix columns.
 */
export function zonedDateKey(value: string | Date | undefined | null, timeZone: string): string {
  const date = parse(value);
  if (!date) return '';

  // 'en-CA' yields ISO-ordered YYYY-MM-DD, which sorts lexicographically.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Short column header for a date grid, e.g. `8/12`. */
export function zonedShortDate(value: string | Date | undefined | null, timeZone: string): string {
  const date = parse(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

/**
 * Two-letter weekday for the sub-header under a date column. Printed grids put
 * this under the date because staff otherwise mark the wrong column.
 */
export function zonedWeekday(value: string | Date | undefined | null, timeZone: string): string {
  const date = parse(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    weekday: 'short',
  })
    .format(date)
    .slice(0, 2);
}

/** Time of day in the facility zone, e.g. `7:00 PM`. No zone suffix. */
export function zonedTime(value: string | Date | undefined | null, timeZone: string): string {
  const date = parse(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * The zone's short name for a given instant, e.g. `EST` / `EDT` / `GMT+9`.
 * Resolved per-instant because the abbreviation changes across a DST boundary,
 * and a season spans one more often than not.
 */
export function timeZoneLabel(value: string | Date | undefined | null, timeZone: string): string {
  const date = parse(value) ?? new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    timeZoneName: 'short',
  }).formatToParts(date);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** Time with its zone stated, e.g. `7:00 PM EST`. */
export function zonedTimeWithZone(value: string | Date | undefined | null, timeZone: string): string {
  const time = zonedTime(value, timeZone);
  if (!time) return '';
  const label = timeZoneLabel(value, timeZone);
  return label ? `${time} ${label}` : time;
}

/** Full date for a sheet header, e.g. `Fri, Aug 14, 2026`. */
export function zonedLongDate(value: string | Date | undefined | null, timeZone: string): string {
  const date = parse(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * One distinct column per calendar day in the facility zone, sorted ascending.
 * Events sharing a day collapse into a single column — a doubleheader is still
 * one date to tick.
 */
export function toDateColumns(
  events: Array<{ startDate?: string | null; startTime?: string | null }>,
  timeZone: string
): Array<{ key: string; short: string; weekday: string }> {
  const seen = new Map<string, { key: string; short: string; weekday: string }>();

  for (const event of events) {
    const value = event.startTime || event.startDate;
    const key = zonedDateKey(value, timeZone);
    if (!key || seen.has(key)) continue;
    seen.set(key, {
      key,
      short: zonedShortDate(value, timeZone),
      weekday: zonedWeekday(value, timeZone),
    });
  }

  return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
}
