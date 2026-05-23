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

export function summarizeSessionTimeChips(chips: IHostPortalSessionTimeChip[]): string {
  if (chips.length === 0) {
    return 'View schedule';
  }
  const days = [...new Set(chips.map((chip) => chip.dayLabel))];
  const daySummary =
    days.length <= 3 ? days.join(', ') : `${days.slice(0, 2).join(', ')}…`;
  return `${chips.length} session${chips.length === 1 ? '' : 's'} · ${daySummary}`;
}
