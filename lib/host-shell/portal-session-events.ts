import type { IDiscoveryApiEvent } from '@/lib/host-shell/portal-schedule-events';
import { buildRegistrationUrl } from '@/lib/utils';

const FULL_LABEL = 'Full';

export interface IHostPortalSessionTimeChip {
  eventId: string;
  segmentId?: string;
  dayLabel: string;
  timeLabel: string;
  endTimeLabel?: string;
  spotsLabel: string;
  isFull: boolean;
  registrationUrl?: string;
}

export interface IBuildSessionTimeChipsOptions {
  customRegistrationUrl?: string;
}

function formatEventDay(isoDate: string, timezone?: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: timezone || 'America/New_York',
    });
  } catch {
    return '';
  }
}

function formatEventTime(isoDate: string, timezone?: string): string {
  try {
    return new Date(isoDate).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || 'America/New_York',
    });
  } catch {
    return '';
  }
}

function formatSpotsLabel(event: IDiscoveryApiEvent): { label: string; isFull: boolean } {
  if (event.spotsRemaining === 0 || event.registrationWindowStatus === 'closed') {
    return { label: FULL_LABEL, isFull: true };
  }
  if (event.spotsRemaining !== undefined && event.spotsRemaining > 0) {
    return { label: `${event.spotsRemaining} left`, isFull: false };
  }
  if (event.maxParticipants !== undefined && event.currentParticipants !== undefined) {
    const remaining = event.maxParticipants - event.currentParticipants;
    if (remaining <= 0) {
      return { label: FULL_LABEL, isFull: true };
    }
    return { label: `${remaining} left`, isFull: false };
  }
  return { label: 'Open', isFull: false };
}

function resolveChipRegistrationUrl(
  event: IDiscoveryApiEvent,
  isFull: boolean,
  customRegistrationUrl?: string,
): string | undefined {
  if (customRegistrationUrl) {
    return customRegistrationUrl;
  }
  const isRegistrationOpen =
    event.registrationWindowStatus !== 'closed' && !isFull;
  return buildRegistrationUrl(event.linkSEO, { isRegistrationOpen });
}

function eventToChip(
  event: IDiscoveryApiEvent,
  options?: IBuildSessionTimeChipsOptions,
): IHostPortalSessionTimeChip | null {
  if (!event.startDate) {
    return null;
  }
  const dayLabel = formatEventDay(event.startDate, event.timezone);
  const timeLabel = formatEventTime(event.startDate, event.timezone);
  if (!dayLabel || !timeLabel) {
    return null;
  }
  const endTimeLabel = event.endDate
    ? formatEventTime(event.endDate, event.timezone)
    : undefined;
  const spots = formatSpotsLabel(event);
  return {
    eventId: event.id,
    segmentId: event.segmentId,
    dayLabel,
    timeLabel,
    endTimeLabel: endTimeLabel && endTimeLabel !== timeLabel ? endTimeLabel : undefined,
    spotsLabel: spots.label,
    isFull: spots.isFull,
    registrationUrl: resolveChipRegistrationUrl(event, spots.isFull, options?.customRegistrationUrl),
  };
}

export function formatSessionTimeChipLabel(chip: IHostPortalSessionTimeChip): string {
  const timeRange = chip.endTimeLabel
    ? `${chip.timeLabel} - ${chip.endTimeLabel}`
    : chip.timeLabel;
  return `${chip.dayLabel} · ${timeRange} · ${chip.spotsLabel}`;
}

/**
 * Groups schedule events into per-session time chips for the list-row session picker.
 */
export function buildSessionTimeChipsBySessionId(
  events: IDiscoveryApiEvent[],
  options?: IBuildSessionTimeChipsOptions,
): Map<string, IHostPortalSessionTimeChip[]> {
  const bySession = new Map<string, IHostPortalSessionTimeChip[]>();

  events.forEach((event) => {
    if (!event.sessionId) {
      return;
    }
    const chip = eventToChip(event, options);
    if (!chip) {
      return;
    }
    const sessionId = String(event.sessionId);
    const existing = bySession.get(sessionId) ?? [];
    const duplicate = existing.some(
      (row) =>
        row.dayLabel === chip.dayLabel &&
        row.timeLabel === chip.timeLabel &&
        row.endTimeLabel === chip.endTimeLabel &&
        row.spotsLabel === chip.spotsLabel &&
        row.segmentId === chip.segmentId,
    );
    if (!duplicate) {
      existing.push(chip);
      bySession.set(sessionId, existing);
    }
  });

  bySession.forEach((chips, sessionId) => {
    chips.sort((a, b) => `${a.dayLabel}${a.timeLabel}`.localeCompare(`${b.dayLabel}${b.timeLabel}`));
    bySession.set(sessionId, chips);
  });

  return bySession;
}

const WEEKDAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Compact "days & times" summary for a session card/row, e.g.
 * "Tue, Thu · 9:30 AM" or "Mon, Wed, Fri · multiple times". Built only from
 * real event day/time data (never a fabricated weekly slot). Returns undefined
 * when there are no timed events to summarize.
 */
export function buildSessionScheduleSummary(
  chips: IHostPortalSessionTimeChip[],
): string | undefined {
  if (chips.length === 0) {
    return undefined;
  }
  const days = [...new Set(chips.map((chip) => chip.dayLabel).filter(Boolean))].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
  );
  const times = [...new Set(chips.map((chip) => chip.timeLabel).filter(Boolean))];

  const dayPart = days.length > 0 ? days.join(', ') : undefined;
  const timePart =
    times.length === 1 ? times[0] : times.length > 1 ? 'multiple times' : undefined;

  if (dayPart && timePart) {
    return `${dayPart} · ${timePart}`;
  }
  return dayPart ?? timePart;
}

/** Max upcoming occurrences shown in the rows expand panel for event-based sessions. */
export const PORTAL_V2_EXPAND_UPCOMING_EVENT_LIMIT = 4;

export interface IHostPortalUpcomingSessionEvent {
  eventId: string;
  dateLabel: string;
  timeLabel: string;
  spotsLabel: string;
  isFull: boolean;
  isWaitlistEnabled: boolean;
  registrationUrl?: string;
  startDateMs: number;
}

export interface IPortalV2EventSchedulePanel {
  summary?: string;
  upcoming: IHostPortalUpcomingSessionEvent[];
  totalUpcomingCount: number;
}

function formatEventDateLabel(isoDate: string, timezone?: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone || 'America/New_York',
    });
  } catch {
    return '';
  }
}

function eventToUpcomingOccurrence(
  event: IDiscoveryApiEvent,
  options?: IBuildSessionTimeChipsOptions,
): IHostPortalUpcomingSessionEvent | null {
  if (!event.startDate) {
    return null;
  }
  const startDateMs = Date.parse(event.startDate);
  if (!Number.isFinite(startDateMs)) {
    return null;
  }
  const dateLabel = formatEventDateLabel(event.startDate, event.timezone);
  const timeLabel = formatEventTime(event.startDate, event.timezone);
  if (!dateLabel || !timeLabel) {
    return null;
  }
  const spots = formatSpotsLabel(event);
  return {
    eventId: event.id,
    dateLabel,
    timeLabel,
    spotsLabel: spots.label,
    isFull: spots.isFull,
    isWaitlistEnabled: event.isWaitlistEnabled === true,
    registrationUrl: resolveChipRegistrationUrl(
      event,
      spots.isFull,
      options?.customRegistrationUrl,
    ),
    startDateMs,
  };
}

/**
 * Builds per-session expand-panel schedule data for non-segmented sessions:
 * a compact day/time pattern summary plus the next N upcoming occurrences.
 */
export function buildEventSchedulePanelsBySessionId(
  events: IDiscoveryApiEvent[],
  options?: IBuildSessionTimeChipsOptions & {
    limit?: number;
    nowMs?: number;
  },
): Map<string, IPortalV2EventSchedulePanel> {
  const limit = options?.limit ?? PORTAL_V2_EXPAND_UPCOMING_EVENT_LIMIT;
  const nowMs = options?.nowMs ?? Date.now();
  const chipsBySession = buildSessionTimeChipsBySessionId(events, options);
  const upcomingBySession = new Map<string, IHostPortalUpcomingSessionEvent[]>();

  events.forEach((event) => {
    if (!event.sessionId) {
      return;
    }
    const occurrence = eventToUpcomingOccurrence(event, options);
    if (!occurrence || occurrence.startDateMs < nowMs) {
      return;
    }
    const sessionId = String(event.sessionId);
    const existing = upcomingBySession.get(sessionId) ?? [];
    existing.push(occurrence);
    upcomingBySession.set(sessionId, existing);
  });

  const panels = new Map<string, IPortalV2EventSchedulePanel>();
  const sessionIds = new Set([...chipsBySession.keys(), ...upcomingBySession.keys()]);
  sessionIds.forEach((sessionId) => {
    const chips = chipsBySession.get(sessionId) ?? [];
    const upcomingAll = (upcomingBySession.get(sessionId) ?? []).sort(
      (left, right) => left.startDateMs - right.startDateMs,
    );
    const summary = buildSessionScheduleSummary(chips);
    if (!summary && upcomingAll.length === 0) {
      return;
    }
    panels.set(sessionId, {
      summary,
      upcoming: upcomingAll.slice(0, limit),
      totalUpcomingCount: upcomingAll.length,
    });
  });

  return panels;
}

export function summarizeSessionTimeChips(chips: IHostPortalSessionTimeChip[]): string {
  if (chips.length === 0) {
    return 'View schedule';
  }
  const days = [...new Set(chips.map((chip) => chip.dayLabel))];
  const daySummary =
    days.length <= 3 ? days.join(', ') : `${days.slice(0, 2).join(', ')}…`;
  return `${chips.length} session${chips.length === 1 ? '' : 's'} · ${daySummary}`;
}
