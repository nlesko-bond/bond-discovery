import type { IDiscoveryApiEvent } from '@/lib/host-shell/portal-schedule-events';

/** The event fields the session days/times summary reads. */
export type SessionScheduleEvent = Pick<
  IDiscoveryApiEvent,
  'sessionId' | 'startDate' | 'endDate' | 'timezone'
>;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MIN_CONSECUTIVE_DAYS_FOR_RANGE = 3;
const MAX_SUMMARY_LINES = 2;
const MIN_WEEKLY_COVERAGE = 0.75;
const MAX_OUTLIER_SLOT_EVENTS = 2;
const MAX_OUTLIER_SLOT_SHARE = 0.15;
const DAYS_PER_WEEK = 7;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const NOON_HOUR = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SELECT_DATES_LABEL = 'Select dates';
const SEPARATOR = ' · ';

interface ILocalOccurrence {
  weekdayIndex: number;
  dayNumber: number;
  startMinutes: number;
  endMinutes?: number;
}

interface ITimeSlot {
  startMinutes: number;
  endMinutes?: number;
  occurrences: ILocalOccurrence[];
}

interface ISummaryLine {
  firstWeekdayIndex: number;
  earliestStart: number;
  text: string;
}

const formatterCache = new Map<string, Intl.DateTimeFormat | null>();

function getLocalFormatter(timeZone: string): Intl.DateTimeFormat | null {
  if (!formatterCache.has(timeZone)) {
    try {
      formatterCache.set(
        timeZone,
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          weekday: 'short',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hourCycle: 'h23',
        }),
      );
    } catch {
      formatterCache.set(timeZone, null);
    }
  }
  return formatterCache.get(timeZone) ?? null;
}

interface ILocalParts {
  weekdayIndex: number;
  dayNumber: number;
  minutes: number;
}

function toLocalParts(iso: string, formatter: Intl.DateTimeFormat): ILocalParts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  const weekdayIndex = WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % HOURS_PER_DAY;
  const minute = Number(parts.minute);
  if (weekdayIndex < 0 || [year, month, day, hour, minute].some(Number.isNaN)) {
    return null;
  }
  return {
    weekdayIndex,
    dayNumber: Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY),
    minutes: hour * MINUTES_PER_HOUR + minute,
  };
}

function toLocalOccurrence(event: SessionScheduleEvent): ILocalOccurrence | null {
  if (!event.startDate || !event.timezone) {
    return null;
  }
  const formatter = getLocalFormatter(event.timezone);
  if (!formatter) {
    return null;
  }
  const start = toLocalParts(event.startDate, formatter);
  if (!start) {
    return null;
  }
  const end = event.endDate ? toLocalParts(event.endDate, formatter) : null;
  return {
    weekdayIndex: start.weekdayIndex,
    dayNumber: start.dayNumber,
    startMinutes: start.minutes,
    endMinutes: end && end.minutes !== start.minutes ? end.minutes : undefined,
  };
}

function splitClock(minutes: number): { clock: string; period: 'AM' | 'PM' } {
  const hour24 = Math.floor(minutes / MINUTES_PER_HOUR);
  const minute = minutes % MINUTES_PER_HOUR;
  const hour12 = hour24 % NOON_HOUR === 0 ? NOON_HOUR : hour24 % NOON_HOUR;
  const clock = minute === 0 ? String(hour12) : `${hour12}:${String(minute).padStart(2, '0')}`;
  return { clock, period: hour24 < NOON_HOUR ? 'AM' : 'PM' };
}

function formatClock(minutes: number): string {
  const { clock, period } = splitClock(minutes);
  return `${clock} ${period}`;
}

/** "4–4:55 PM", "9 AM–1 PM", or "4 PM" when there is no end time. */
function formatTimeRange(startMinutes: number, endMinutes?: number): string {
  if (endMinutes === undefined) {
    return formatClock(startMinutes);
  }
  const start = splitClock(startMinutes);
  const end = splitClock(endMinutes);
  return start.period === end.period
    ? `${start.clock}–${end.clock} ${end.period}`
    : `${start.clock} ${start.period}–${end.clock} ${end.period}`;
}

/** "Tue & Thu", "Mon–Wed", "Mon, Wed, Fri" (always Monday-first). */
export function formatWeekdays(weekdayIndexes: Iterable<number>): string {
  const sorted = Array.from(new Set(weekdayIndexes)).sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const index of sorted) {
    const lastRun = runs[runs.length - 1];
    if (lastRun && index === lastRun[lastRun.length - 1] + 1) {
      lastRun.push(index);
    } else {
      runs.push([index]);
    }
  }
  const parts = runs.flatMap((run) =>
    run.length >= MIN_CONSECUTIVE_DAYS_FOR_RANGE
      ? [`${WEEKDAYS[run[0]]}–${WEEKDAYS[run[run.length - 1]]}`]
      : run.map((index) => WEEKDAYS[index]),
  );
  return parts.length === 2 ? parts.join(' & ') : parts.join(', ');
}

/**
 * True when every weekday in the set recurs in most weeks the occurrences
 * span, so "Tue & Thu" honestly reads as every week. Camps on scattered
 * dates fail this and are labelled "Select dates" instead.
 */
function isWeeklyPattern(occurrences: ILocalOccurrence[]): boolean {
  const dayNumbers = occurrences.map((occurrence) => occurrence.dayNumber);
  const spanWeeks =
    Math.floor((Math.max(...dayNumbers) - Math.min(...dayNumbers)) / DAYS_PER_WEEK) + 1;
  const datesByWeekday = new Map<number, Set<number>>();
  for (const occurrence of occurrences) {
    const dates = datesByWeekday.get(occurrence.weekdayIndex) ?? new Set<number>();
    dates.add(occurrence.dayNumber);
    datesByWeekday.set(occurrence.weekdayIndex, dates);
  }
  return Array.from(datesByWeekday.values()).every(
    (dates) => dates.size / spanWeeks >= MIN_WEEKLY_COVERAGE,
  );
}

function groupIntoSlots(occurrences: ILocalOccurrence[]): ITimeSlot[] {
  const slots = new Map<string, ITimeSlot>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.startMinutes}-${occurrence.endMinutes ?? ''}`;
    const slot = slots.get(key) ?? {
      startMinutes: occurrence.startMinutes,
      endMinutes: occurrence.endMinutes,
      occurrences: [],
    };
    slot.occurrences.push(occurrence);
    slots.set(key, slot);
  }
  return Array.from(slots.values());
}

function isOutlierSlot(slot: ITimeSlot, totalOccurrences: number): boolean {
  const count = slot.occurrences.length;
  return count <= MAX_OUTLIER_SLOT_EVENTS && count / totalOccurrences < MAX_OUTLIER_SLOT_SHARE;
}

function describeSlotTimes(slots: ITimeSlot[]): string {
  if (slots.length === 1) {
    return formatTimeRange(slots[0].startMinutes, slots[0].endMinutes);
  }
  const starts = new Set(slots.map((slot) => slot.startMinutes));
  const earliestStart = Math.min(...starts);
  if (starts.size === 1) {
    return `Starts ${formatClock(earliestStart)}, end times vary`;
  }
  const latestEnd = Math.max(...slots.map((slot) => slot.endMinutes ?? slot.startMinutes));
  return `Multiple times, ${formatTimeRange(earliestStart, latestEnd)}`;
}

function buildLine(dayLabel: string, slots: ITimeSlot[]): ISummaryLine {
  const occurrences = slots.flatMap((slot) => slot.occurrences);
  return {
    firstWeekdayIndex: Math.min(...occurrences.map((occurrence) => occurrence.weekdayIndex)),
    earliestStart: Math.min(...slots.map((slot) => slot.startMinutes)),
    text: `${dayLabel}${SEPARATOR}${describeSlotTimes(slots)}`,
  };
}

function weekdaySetKey(slot: ITimeSlot): string {
  return Array.from(new Set(slot.occurrences.map((occurrence) => occurrence.weekdayIndex)))
    .sort((a, b) => a - b)
    .join(',');
}

/**
 * Summarizes one session's events into at most two short "days · times"
 * lines, e.g. ["Tue & Thu · 3:30–5 PM"]. Times are local to each event's
 * timezone. Time slots with only one or two events (under 15% of the total)
 * are folded into a trailing "+N other times" instead of getting their own
 * line; more than two lines collapse to "<days> · Times vary". Returns an
 * empty array when there are no usable events, so the card shows nothing.
 */
export function summarizeSessionSchedule(events: SessionScheduleEvent[]): string[] {
  const seen = new Set<string>();
  const occurrences: ILocalOccurrence[] = [];
  for (const event of events) {
    const key = `${event.startDate}|${event.endDate}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const occurrence = toLocalOccurrence(event);
    if (occurrence) {
      occurrences.push(occurrence);
    }
  }
  if (occurrences.length === 0) {
    return [];
  }

  const slots = groupIntoSlots(occurrences);
  const outliers = slots.filter((slot) => isOutlierSlot(slot, occurrences.length));
  const mainSlots =
    outliers.length === slots.length ? slots : slots.filter((slot) => !outliers.includes(slot));
  const otherCount =
    mainSlots === slots ? 0 : outliers.reduce((sum, slot) => sum + slot.occurrences.length, 0);

  const mainOccurrences = mainSlots.flatMap((slot) => slot.occurrences);
  const weekly = isWeeklyPattern(mainOccurrences);

  let lines: ISummaryLine[];
  if (weekly) {
    const slotsByDays = new Map<string, ITimeSlot[]>();
    for (const slot of mainSlots) {
      const key = weekdaySetKey(slot);
      const group = slotsByDays.get(key);
      if (group) {
        group.push(slot);
      } else {
        slotsByDays.set(key, [slot]);
      }
    }
    lines = Array.from(slotsByDays.values()).map((group) =>
      buildLine(
        formatWeekdays(group.flatMap((slot) => slot.occurrences.map((o) => o.weekdayIndex))),
        group,
      ),
    );
  } else {
    lines = [buildLine(SELECT_DATES_LABEL, mainSlots)];
  }
  lines.sort((a, b) => a.firstWeekdayIndex - b.firstWeekdayIndex || a.earliestStart - b.earliestStart);

  let texts = lines.map((line) => line.text);
  if (texts.length > MAX_SUMMARY_LINES) {
    texts = [
      `${formatWeekdays(mainOccurrences.map((o) => o.weekdayIndex))}${SEPARATOR}Times vary`,
    ];
  }
  if (otherCount > 0) {
    const suffix = `+${otherCount} other time${otherCount === 1 ? '' : 's'}`;
    texts[texts.length - 1] = `${texts[texts.length - 1]}${SEPARATOR}${suffix}`;
  }
  return texts;
}

/**
 * Builds the days/times summary for every session in a discovery events
 * feed, keyed by session id. Sessions without events are absent.
 */
export function buildSessionScheduleSummaries(
  events: ReadonlyArray<SessionScheduleEvent>,
): Map<string, string[]> {
  const eventsBySession = new Map<string, SessionScheduleEvent[]>();
  for (const event of events) {
    if (event.sessionId === undefined || event.sessionId === null) {
      continue;
    }
    const sessionId = String(event.sessionId);
    const sessionEvents = eventsBySession.get(sessionId);
    if (sessionEvents) {
      sessionEvents.push(event);
    } else {
      eventsBySession.set(sessionId, [event]);
    }
  }
  const summaries = new Map<string, string[]>();
  eventsBySession.forEach((sessionEvents, sessionId) => {
    const lines = summarizeSessionSchedule(sessionEvents);
    if (lines.length > 0) {
      summaries.set(sessionId, lines);
    }
  });
  return summaries;
}
