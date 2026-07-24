import type { BondClient } from '@/lib/bond-client';
import { formatDateRange } from '@/lib/utils';
import {
  resolvePortalSegmentAvailability,
  type IPortalSegmentAvailability,
} from '@/lib/host-shell/portal-segment-availability';
import {
  trimSegmentDisplayName,
  type IHostPortalSegmentRow,
} from '@/lib/host-shell/session-card-model';

const SEGMENT_EVENTS_CONCURRENCY = 5;
const SEGMENT_EVENTS_EXPAND = 'resources,capacity';

export interface IPortalSessionSegmentEnrichmentContext {
  name: string;
  programName: string;
  facilityName?: string;
  registrationWindowStatus?: string;
  waitlistEnabled?: boolean;
  priceLabel?: string;
}

interface IRawSegmentEvent {
  id?: string | number;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  timezone?: string;
  maxParticipants?: number;
  max_participants?: number;
  capacity?: number;
  participantsNumber?: number;
  currentParticipants?: number;
  current_participants?: number;
  spotsLeft?: number;
  spots_left?: number;
  isWaitlistEnabled?: boolean;
  waitlistEnabled?: boolean;
  resources?: Array<{ name?: string }>;
}

function readResourceNames(event: IRawSegmentEvent): string | undefined {
  if (!Array.isArray(event.resources)) {
    return undefined;
  }
  const names = event.resources.map((resource) => resource.name).filter(Boolean);
  return names.length > 0 ? names.join(', ') : undefined;
}

function readEventSpotsRemaining(event: IRawSegmentEvent): {
  spotsRemaining?: number;
  maxParticipants?: number;
  currentParticipants?: number;
} {
  const maxParticipants =
    event.maxParticipants ??
    event.max_participants ??
    (typeof event.capacity === 'number' ? event.capacity : undefined);
  const currentParticipants =
    event.participantsNumber ?? event.currentParticipants ?? event.current_participants ?? 0;
  const spotsRemaining =
    event.spotsLeft ??
    event.spots_left ??
    (typeof maxParticipants === 'number'
      ? Math.max(0, maxParticipants - currentParticipants)
      : undefined);

  return { spotsRemaining, maxParticipants, currentParticipants };
}

const WEEKDAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatSegmentEventDay(iso: string, timezone?: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: timezone || 'America/New_York',
    });
  } catch {
    return '';
  }
}

function formatSegmentEventTime(iso: string, timezone?: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || 'America/New_York',
    });
  } catch {
    return '';
  }
}

/**
 * Derives a segment's day/time label from its ACTUAL events (never the Bond
 * segment name, which operators can rename freely). Returns e.g.
 * "Mon 4:30 – 5:30 PM" or "Mon, Wed 4:30 PM". The end time is only shown when
 * every event shares one start and one end (so we never assert a time that
 * isn't consistent); if starts vary, returns undefined so the caller can fall
 * back to the segment name.
 */
function buildSegmentScheduleLabelFromEvents(events: IRawSegmentEvent[]): string | undefined {
  const parsed = events
    .map((event) => {
      const start = event.startDate ?? event.start_date;
      if (!start) return undefined;
      const end = event.endDate ?? event.end_date;
      return {
        day: formatSegmentEventDay(start, event.timezone),
        start: formatSegmentEventTime(start, event.timezone),
        end: end ? formatSegmentEventTime(end, event.timezone) : undefined,
      };
    })
    .filter((row): row is { day: string; start: string; end: string | undefined } =>
      Boolean(row && row.day && row.start),
    );

  if (parsed.length === 0) {
    return undefined;
  }

  const days = [...new Set(parsed.map((row) => row.day))].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
  );
  const starts = [...new Set(parsed.map((row) => row.start))];
  // Inconsistent start times → don't guess; caller falls back to the name.
  if (starts.length !== 1) {
    return undefined;
  }
  const start = starts[0];
  const ends = [...new Set(parsed.map((row) => row.end).filter(Boolean))];
  const end = ends.length === 1 ? ends[0] : undefined;
  const timeLabel = end && end !== start ? `${start} – ${end}` : start;
  return `${days.join(', ')} ${timeLabel}`;
}

function pickRepresentativeSegmentEvent(events: IRawSegmentEvent[]): IRawSegmentEvent | undefined {
  if (events.length === 0) {
    return undefined;
  }
  const sorted = [...events].sort((left, right) => {
    const leftDate = left.startDate ?? left.start_date ?? '';
    const rightDate = right.startDate ?? right.start_date ?? '';
    return leftDate.localeCompare(rightDate);
  });
  return sorted[0];
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += concurrency) {
    const batch = items.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }
  return results;
}

function buildSegmentRow(
  segment: { id: string; name?: string; startDate?: string; endDate?: string },
  context: IPortalSessionSegmentEnrichmentContext,
  representativeEvent: IRawSegmentEvent | undefined,
  eventCount = 0,
  scheduleLabelFromEvents?: string,
): IHostPortalSegmentRow {
  const segmentName = segment.name?.trim() || 'Segment';
  // Prefer the day/time derived from the segment's actual events; the Bond
  // segment name is operator-editable and unreliable, so it's only a fallback.
  const scheduleLabel =
    scheduleLabelFromEvents ??
    trimSegmentDisplayName(segmentName, {
      name: context.name,
      programName: context.programName,
    });
  const dateRange =
    segment.startDate || segment.endDate
      ? formatDateRange(segment.startDate ?? '', segment.endDate ?? '')
      : undefined;

  const eventSpots = representativeEvent ? readEventSpotsRemaining(representativeEvent) : {};
  const isWaitlistEnabled =
    context.waitlistEnabled ??
    representativeEvent?.isWaitlistEnabled ??
    representativeEvent?.waitlistEnabled;
  const availability: IPortalSegmentAvailability = resolvePortalSegmentAvailability({
    spotsRemaining: eventSpots.spotsRemaining,
    maxParticipants: eventSpots.maxParticipants,
    currentParticipants: eventSpots.currentParticipants,
    registrationWindowStatus: context.registrationWindowStatus,
    isWaitlistEnabled,
  });

  return {
    id: segment.id,
    name: segmentName,
    scheduleLabel,
    dateRange,
    startDate: segment.startDate,
    endDate: segment.endDate,
    facilityName: context.facilityName,
    spaceName: representativeEvent ? readResourceNames(representativeEvent) : undefined,
    spotsRemaining: eventSpots.spotsRemaining,
    maxParticipants: eventSpots.maxParticipants,
    currentParticipants: eventSpots.currentParticipants,
    isWaitlistEnabled,
    availabilityKind: availability.kind,
    availabilityLabel: availability.label,
    priceLabel: context.priceLabel,
    registrationWindowStatus: context.registrationWindowStatus,
    eventCount: eventCount > 0 ? eventCount : undefined,
  };
}

export async function fetchEnrichedPortalSessionSegments(
  client: BondClient,
  orgId: string,
  programId: string,
  sessionId: string,
  context: IPortalSessionSegmentEnrichmentContext,
): Promise<IHostPortalSegmentRow[]> {
  const segmentsResponse = await client.getSegments(orgId, programId, sessionId);
  const segments = segmentsResponse.data ?? [];
  if (segments.length === 0) {
    return [];
  }

  const enrichedRows = await runWithConcurrency(
    segments,
    SEGMENT_EVENTS_CONCURRENCY,
    async (segment) => {
      try {
        const eventsResponse = await client.getSegmentEvents(
          orgId,
          programId,
          sessionId,
          String(segment.id),
          { expand: SEGMENT_EVENTS_EXPAND },
        );
        const segmentEvents = (eventsResponse.data ?? []) as IRawSegmentEvent[];
        const representativeEvent = pickRepresentativeSegmentEvent(segmentEvents);
        const scheduleLabelFromEvents = buildSegmentScheduleLabelFromEvents(segmentEvents);
        return buildSegmentRow(
          segment,
          context,
          representativeEvent,
          segmentEvents.length,
          scheduleLabelFromEvents,
        );
      } catch (error) {
        console.error('[portal-session-segments] segment events failed', {
          sessionId,
          segmentId: segment.id,
          error,
        });
        return buildSegmentRow(segment, context, undefined);
      }
    },
  );

  return enrichedRows.sort((left, right) =>
    (left.scheduleLabel ?? left.name).localeCompare(right.scheduleLabel ?? left.name),
  );
}
