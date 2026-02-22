import { createBondClient, DEFAULT_API_KEY, DEFAULT_ORG_IDS } from '@/lib/bond-client';
import { getConfigBySlug } from '@/lib/config';
import { transformProgram } from '@/lib/transformers';
import { cacheGet, cacheSet, discoveryAvailabilityCacheKey, discoveryFullCacheKey } from '@/lib/cache';
import type { Program, DiscoveryConfig } from '@/types';

export type DiscoveryEventsMode = 'full' | 'availability';

export interface DiscoveryEventsRequest {
  slug?: string;
  apiKey?: string;
  orgIds?: string[];
  facilityId?: string;
  includePast?: boolean;
  startDateFilter?: string;
  endDateFilter?: string;
  mode?: DiscoveryEventsMode;
  forceFresh?: boolean;
}

interface DiscoveryEventsContext {
  slug: string;
  apiKey: string;
  apiKeyScope: string;
  orgIds: string[];
  facilityId?: string;
  includePast: boolean;
  startDateFilter?: string;
  endDateFilter?: string;
  mode: DiscoveryEventsMode;
  programFilterMode: 'all' | 'exclude' | 'include';
  excludedProgramIds: string[];
  includedProgramIds: string[];
  fullCacheTtl: number;
  availabilityCacheTtl: number;
  config?: DiscoveryConfig | null;
}

export interface FullDiscoveryEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  timezone?: string;
  programId: string;
  programName: string;
  sessionId: string;
  sessionName: string;
  facilityName?: string;
  spaceName?: string;
  sport?: string;
  type?: string;
  linkSEO?: string;
  registrationWindowStatus?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  spotsRemaining?: number;
  startingPrice?: number;
  memberPrice?: number;
  isWaitlistEnabled?: boolean;
  waitlistCount?: number;
  segmentId?: string;
  segmentName?: string;
  isSegmented?: boolean;
}

export interface AvailabilityDiscoveryEvent {
  id: string;
  sessionId: string;
  spotsRemaining?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  isWaitlistEnabled?: boolean;
  waitlistCount?: number;
  segmentId?: string;
}

type DiscoveryEvent = FullDiscoveryEvent | AvailabilityDiscoveryEvent;

export interface DiscoveryEventsPayload {
  data: DiscoveryEvent[];
  meta: {
    totalEvents: number;
    organizations: number;
    fetchDurationMs: number;
    cachedAt: string;
    mode: DiscoveryEventsMode;
  };
}

export interface DiscoveryEventsResult {
  payload: DiscoveryEventsPayload;
  cacheStatus: 'HIT' | 'MISS';
  cacheKey: string;
  context: DiscoveryEventsContext;
}

const DEFAULT_FULL_TTL = 15 * 60;
const DEFAULT_AVAILABILITY_TTL = 60;
const PROGRAM_CONCURRENCY = 3;
const SESSION_CONCURRENCY = 5;

function getTodayInTimezone(timezone: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getLocalDate(isoDateStr: string, timezone: string): string {
  try {
    const date = new Date(isoDateStr);
    return date.toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return isoDateStr.split('T')[0];
  }
}

function calculateSessionRegistrationStatus(
  registrationStartDate?: string,
  registrationEndDate?: string,
  timezone?: string
): string {
  const today = timezone ? getTodayInTimezone(timezone) : new Date().toISOString().split('T')[0];
  if (registrationStartDate && registrationStartDate > today) return 'not_opened_yet';
  if (registrationEndDate && registrationEndDate < today) return 'closed';
  return 'open';
}

function hashScope(value: string): string {
  return value
    .split('')
    .reduce((hash, ch) => ((hash * 31) + ch.charCodeAt(0)) >>> 0, 0)
    .toString(16);
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const limit = Math.max(1, concurrency);

  async function next(): Promise<void> {
    const currentIndex = index++;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await worker(items[currentIndex]);
    await next();
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

async function buildContext(request: DiscoveryEventsRequest): Promise<DiscoveryEventsContext> {
  const slug = request.slug || 'adhoc';
  let apiKey = request.apiKey || DEFAULT_API_KEY;
  let orgIds = request.orgIds && request.orgIds.length > 0 ? request.orgIds : DEFAULT_ORG_IDS;
  let programFilterMode: 'all' | 'exclude' | 'include' = 'all';
  let excludedProgramIds: string[] = [];
  let includedProgramIds: string[] = [];
  let fullCacheTtl = DEFAULT_FULL_TTL;
  let availabilityCacheTtl = DEFAULT_AVAILABILITY_TTL;

  const config = request.slug ? await getConfigBySlug(request.slug) : null;
  if (config) {
    apiKey = config.apiKey || apiKey;
    if (config.organizationIds.length > 0) {
      orgIds = config.organizationIds;
    }
    fullCacheTtl = config.cacheTtl || fullCacheTtl;
    programFilterMode = config.features?.programFilterMode || 'all';
    excludedProgramIds = config.excludedProgramIds || [];
    includedProgramIds = config.includedProgramIds || [];
    if (typeof config.features?.availabilityCacheTtl === 'number') {
      availabilityCacheTtl = config.features.availabilityCacheTtl;
    }
  }

  return {
    slug,
    apiKey,
    apiKeyScope: hashScope(apiKey || 'default'),
    orgIds,
    facilityId: request.facilityId,
    includePast: Boolean(request.includePast),
    startDateFilter: request.startDateFilter,
    endDateFilter: request.endDateFilter,
    mode: request.mode || 'full',
    programFilterMode,
    excludedProgramIds,
    includedProgramIds,
    fullCacheTtl,
    availabilityCacheTtl,
    config,
  };
}

function toCacheKey(context: DiscoveryEventsContext): string {
  const cacheScope = [
    context.orgIds.join(','),
    context.facilityId || 'all',
    context.includePast ? 'past' : 'future',
    context.startDateFilter || 'none',
    context.endDateFilter || 'none',
    context.programFilterMode,
    context.includedProgramIds.join(',') || 'none',
    context.excludedProgramIds.join(',') || 'none',
    context.apiKeyScope,
  ].join(':');

  if (context.mode === 'availability') {
    return discoveryAvailabilityCacheKey(context.slug, cacheScope);
  }
  return discoveryFullCacheKey(context.slug, cacheScope);
}

function shouldSkipProgram(programId: string, context: DiscoveryEventsContext): boolean {
  if (context.programFilterMode === 'include' && context.includedProgramIds.length > 0) {
    return !context.includedProgramIds.includes(programId);
  }
  if (context.programFilterMode === 'exclude' && context.excludedProgramIds.length > 0) {
    return context.excludedProgramIds.includes(programId);
  }
  return false;
}

function shouldSkipSessionByDate(session: any, includePast: boolean): boolean {
  if (includePast || !session.endDate) return false;
  const sessionTimezone = session.timezone as string | undefined;
  const todayInSessionTz = sessionTimezone ? getTodayInTimezone(sessionTimezone) : new Date().toISOString().split('T')[0];
  const sessionEndLocalDate = sessionTimezone
    ? getLocalDate(session.endDate, sessionTimezone)
    : session.endDate.split('T')[0];
  return sessionEndLocalDate < todayInSessionTz;
}

function passesDateFilters(
  event: any,
  context: DiscoveryEventsContext
): { keep: boolean; eventLocalDate?: string; eventTimezone?: string } {
  const eventTimezone = event.timezone as string | undefined;
  const eventLocalDate = eventTimezone
    ? getLocalDate(event.startDate, eventTimezone)
    : event.startDate.split('T')[0];

  if (!context.includePast) {
    const todayInEventTz = eventTimezone ? getTodayInTimezone(eventTimezone) : new Date().toISOString().split('T')[0];
    if (eventLocalDate < todayInEventTz) {
      return { keep: false, eventLocalDate, eventTimezone };
    }
  }

  if (context.startDateFilter && eventLocalDate < context.startDateFilter) {
    return { keep: false, eventLocalDate, eventTimezone };
  }
  if (context.endDateFilter && eventLocalDate > context.endDateFilter) {
    return { keep: false, eventLocalDate, eventTimezone };
  }
  return { keep: true, eventLocalDate, eventTimezone };
}

function getPriceSummary(session: any): { startingPrice?: number; memberPrice?: number } {
  const products = session.products || [];
  let startingPrice: number | undefined;
  let memberPrice: number | undefined;

  for (const product of products) {
    const prices = product.prices || [];
    for (const price of prices) {
      const amount = price.price || price.amount || 0;
      if (product.membershipRequired || product.isMemberProduct) {
        if (memberPrice === undefined || amount < memberPrice) {
          memberPrice = amount;
        }
      } else if (startingPrice === undefined || amount < startingPrice) {
        startingPrice = amount;
      }
    }
  }

  return { startingPrice, memberPrice };
}

function toAvailabilityEvent(
  event: any,
  session: any,
  context: DiscoveryEventsContext,
  segmentId?: string
): AvailabilityDiscoveryEvent | null {
  const dateCheck = passesDateFilters(event, context);
  if (!dateCheck.keep) return null;

  const maxParticipants = event.maxParticipants ?? event.max_participants ?? event.capacity;
  const currentParticipants = event.participantsNumber ?? event.currentParticipants ?? event.current_participants ?? 0;
  const spotsRemaining =
    event.spotsLeft ??
    event.spots_left ??
    (maxParticipants !== undefined && maxParticipants !== null
      ? Math.max(0, maxParticipants - currentParticipants)
      : undefined);

  return {
    id: String(event.id),
    sessionId: String(session.id),
    segmentId,
    spotsRemaining,
    maxParticipants,
    currentParticipants,
    isWaitlistEnabled: session.isWaitlistEnabled || session.waitlistEnabled || event.isWaitlistEnabled,
    waitlistCount: session.waitlistCount || event.waitlistCount,
  };
}

function toFullEvent(
  event: any,
  program: Program,
  session: any,
  context: DiscoveryEventsContext,
  segmentId?: string,
  segmentName?: string
): FullDiscoveryEvent | null {
  const dateCheck = passesDateFilters(event, context);
  if (!dateCheck.keep) return null;

  const maxParticipants = event.maxParticipants ?? event.max_participants ?? event.capacity;
  const currentParticipants = event.participantsNumber ?? event.currentParticipants ?? event.current_participants ?? 0;
  const spotsRemaining =
    event.spotsLeft ??
    event.spots_left ??
    (maxParticipants !== undefined && maxParticipants !== null
      ? Math.max(0, maxParticipants - currentParticipants)
      : undefined);

  const resourceNames = Array.isArray(event.resources)
    ? event.resources.map((r: any) => r.name).filter(Boolean).join(', ')
    : undefined;

  const sessionTimezone = session.timezone as string | undefined;
  const registrationWindowStatus = calculateSessionRegistrationStatus(
    session.registrationStartDate,
    session.registrationEndDate,
    sessionTimezone
  );
  const prices = getPriceSummary(session);

  return {
    id: String(event.id),
    title: event.title || segmentName || session.name || program.name,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    programId: program.id,
    programName: program.name,
    sessionId: String(session.id),
    sessionName: segmentName || session.name || '',
    facilityName: session.facility?.name || program.facilityName,
    spaceName: resourceNames,
    sport: program.sport,
    type: program.type,
    linkSEO: session.linkSEO || program.linkSEO,
    registrationWindowStatus,
    maxParticipants,
    currentParticipants,
    spotsRemaining,
    startingPrice: prices.startingPrice,
    memberPrice: prices.memberPrice,
    isWaitlistEnabled: session.isWaitlistEnabled || session.waitlistEnabled || event.isWaitlistEnabled,
    waitlistCount: session.waitlistCount || event.waitlistCount,
    segmentId,
    segmentName,
    isSegmented: Boolean(segmentId),
  };
}

async function fetchSessionEvents(
  client: ReturnType<typeof createBondClient>,
  orgId: string,
  program: Program,
  session: any,
  context: DiscoveryEventsContext
): Promise<DiscoveryEvent[]> {
  if (shouldSkipSessionByDate(session, context.includePast)) {
    return [];
  }

  const events: DiscoveryEvent[] = [];
  const useAvailabilityMode = context.mode === 'availability';

  if (session.isSegmented) {
    const segmentsResponse = await client.getSegments(orgId, program.id, String(session.id));
    const segments = segmentsResponse.data || [];

    const segmentResults = await runWithConcurrency(segments, SESSION_CONCURRENCY, async (segment: any) => {
      const segmentEventsResponse = await client.getSegmentEvents(
        orgId,
        program.id,
        String(session.id),
        String(segment.id),
        { expand: 'resources,capacity' }
      );

      const segmentEvents = segmentEventsResponse.data || [];
      return segmentEvents
        .map((event: any) =>
          useAvailabilityMode
            ? toAvailabilityEvent(event, session, context, String(segment.id))
            : toFullEvent(event, program, session, context, String(segment.id), segment.name)
        )
        .filter(Boolean) as DiscoveryEvent[];
    });

    segmentResults.forEach((result) => events.push(...result));
    return events;
  }

  const eventsResponse = await client.getEvents(orgId, program.id, String(session.id), {
    expand: 'resources,capacity',
  });

  return (eventsResponse.data || [])
    .map((event: any) =>
      useAvailabilityMode
        ? toAvailabilityEvent(event, session, context)
        : toFullEvent(event, program, session, context)
    )
    .filter(Boolean) as DiscoveryEvent[];
}

async function fetchAndTransformEvents(context: DiscoveryEventsContext): Promise<DiscoveryEventsPayload> {
  const fetchStartedAt = Date.now();
  const client = createBondClient(context.apiKey);
  const orgResults = await runWithConcurrency(context.orgIds, PROGRAM_CONCURRENCY, async (orgId) => {
    try {
      const programsResponse = await client.getPrograms(orgId, {
        expand: 'sessions,sessions.products,sessions.products.prices',
        facilityId: context.facilityId,
      });
      const transformedPrograms = (programsResponse.data || []).map((raw) => ({
        ...transformProgram(raw),
        organizationId: orgId,
      }));

      const filteredPrograms = transformedPrograms.filter((program) => !shouldSkipProgram(program.id, context));
      const sessions = filteredPrograms.flatMap((program) =>
        (program.sessions || []).map((session) => ({ orgId, program, session }))
      );

      const sessionEventResults = await runWithConcurrency(sessions, SESSION_CONCURRENCY, async (item) => {
        try {
          return await fetchSessionEvents(client, item.orgId, item.program, item.session, context);
        } catch (error) {
          console.error(`Error fetching events for session ${item.session?.id}:`, error);
          return [];
        }
      });

      return sessionEventResults.flat();
    } catch (error) {
      console.error(`Error fetching programs for org ${orgId}:`, error);
      return [];
    }
  });

  const allEvents = orgResults.flat();
  if (context.mode === 'full') {
    (allEvents as FullDiscoveryEvent[]).sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }

  return {
    data: allEvents,
    meta: {
      totalEvents: allEvents.length,
      organizations: context.orgIds.length,
      fetchDurationMs: Date.now() - fetchStartedAt,
      cachedAt: new Date().toISOString(),
      mode: context.mode,
    },
  };
}

export async function getDiscoveryEvents(
  request: DiscoveryEventsRequest
): Promise<DiscoveryEventsResult> {
  const context = await buildContext(request);
  const cacheKey = toCacheKey(context);
  const cacheTtl = context.mode === 'availability' ? context.availabilityCacheTtl : context.fullCacheTtl;

  if (!request.forceFresh) {
    const cachedPayload = await cacheGet<DiscoveryEventsPayload>(cacheKey);
    if (cachedPayload) {
      return {
        payload: cachedPayload,
        cacheStatus: 'HIT',
        cacheKey,
        context,
      };
    }
  }

  let payload: DiscoveryEventsPayload;
  try {
    payload = await fetchAndTransformEvents(context);
    await cacheSet(cacheKey, payload, { ttl: cacheTtl });
  } catch (error) {
    const stalePayload = await cacheGet<DiscoveryEventsPayload>(cacheKey);
    if (stalePayload) {
      return {
        payload: stalePayload,
        cacheStatus: 'HIT',
        cacheKey,
        context,
      };
    }
    throw error;
  }

  return {
    payload,
    cacheStatus: 'MISS',
    cacheKey,
    context,
  };
}
