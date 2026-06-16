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
): IHostPortalSegmentRow {
  const segmentName = segment.name?.trim() || 'Segment';
  const scheduleLabel = trimSegmentDisplayName(segmentName, {
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
        const representativeEvent = pickRepresentativeSegmentEvent(
          (eventsResponse.data ?? []) as IRawSegmentEvent[],
        );
        return buildSegmentRow(segment, context, representativeEvent);
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
