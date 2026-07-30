import { addMonths, format, subDays } from 'date-fns';

export const MAX_EVENT_LOOKBACK_DAYS = 30;
export const DEFAULT_EVENT_LOOKBACK_DAYS = 0;
export const MIN_EVENT_LOOKBACK_DAYS = 0;
export const DEFAULT_EVENT_HORIZON_MONTHS = 3;

/**
 * Clamps a page-config lookback to 0–30 (0 = today-and-forward only).
 */
export function clampEventLookbackDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_EVENT_LOOKBACK_DAYS;
  }
  return Math.max(
    MIN_EVENT_LOOKBACK_DAYS,
    Math.min(MAX_EVENT_LOOKBACK_DAYS, Math.floor(value)),
  );
}

/**
 * YYYY-MM-DD for “today” in local browser/server timezone.
 */
export function getTodayDateString(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/**
 * Earliest calendar day included when lookbackDays > 0; otherwise today.
 */
export function getEventLookbackStartDate(
  lookbackDays: number,
  now: Date = new Date(),
): string {
  const days = clampEventLookbackDays(lookbackDays);
  if (days <= 0) {
    return getTodayDateString(now);
  }
  return format(subDays(now, days), 'yyyy-MM-dd');
}

/**
 * Schedule date picker bounds from page features.
 */
export function getScheduleDateBounds(
  lookbackDays: number,
  horizonMonths: number,
  now: Date = new Date(),
): { minDate: string; maxDate: string; today: string } {
  const today = getTodayDateString(now);
  const lookback = clampEventLookbackDays(lookbackDays);
  const months =
    typeof horizonMonths === 'number' && Number.isFinite(horizonMonths) && horizonMonths > 0
      ? Math.floor(horizonMonths)
      : DEFAULT_EVENT_HORIZON_MONTHS;
  return {
    today,
    minDate: lookback > 0 ? getEventLookbackStartDate(lookback, now) : today,
    maxDate: format(addMonths(now, months), 'yyyy-MM-dd'),
  };
}

/**
 * Clamps a YYYY-MM-DD string into [minDate, maxDate].
 */
export function clampDateStringToBounds(
  date: string | undefined,
  minDate: string,
  maxDate: string,
): string | undefined {
  if (!date) {
    return undefined;
  }
  if (date < minDate) {
    return minDate;
  }
  if (date > maxDate) {
    return maxDate;
  }
  return date;
}

/**
 * Default schedule dateRange when lookback is enabled: from today forward
 * (past days available only when the visitor widens the start date).
 */
export function getDefaultScheduleDateRangeForLookback(
  lookbackDays: number,
  now: Date = new Date(),
): { start?: string; end?: string } {
  if (clampEventLookbackDays(lookbackDays) <= 0) {
    return {};
  }
  return { start: getTodayDateString(now) };
}

/**
 * Resolves initial schedule dateRange from URL + lookback defaults, clamped
 * to the configured lookback/horizon window.
 */
export function resolveInitialScheduleDateRange(options: {
  lookbackDays: number;
  horizonMonths: number;
  urlStart?: string;
  urlEnd?: string;
  now?: Date;
}): { start?: string; end?: string } {
  const now = options.now ?? new Date();
  const bounds = getScheduleDateBounds(
    options.lookbackDays,
    options.horizonMonths,
    now,
  );
  const defaults = getDefaultScheduleDateRangeForLookback(options.lookbackDays, now);
  const start =
    clampDateStringToBounds(options.urlStart, bounds.minDate, bounds.maxDate) ??
    defaults.start;
  const end =
    clampDateStringToBounds(options.urlEnd, bounds.minDate, bounds.maxDate) ??
    defaults.end;
  if (!start && !end) {
    return {};
  }
  return { ...(start ? { start } : {}), ...(end ? { end } : {}) };
}

/**
 * True when schedule/event views should honor dateRange filters — either the
 * opt-in schedule table filters flag, or when lookback makes past events load.
 */
export function shouldApplyScheduleEventDateFilters(features: {
  showScheduleTableDateFilters?: boolean;
  eventLookbackDays?: number;
}): boolean {
  return (
    features.showScheduleTableDateFilters === true ||
    clampEventLookbackDays(features.eventLookbackDays) > 0
  );
}
