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
  config?: DiscoveryConfig | null;
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
  /** True when the session has at least one product with isPunchPass from Bond */
  hasPunchPassProduct?: boolean;
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
  /** BYPASS = page opted out of discovery KV (always fresh Bond for this slug). */
  cacheStatus: 'HIT' | 'MISS' | 'BYPASS';
  cacheKey: string;
  context: DiscoveryEventsContext;
}

export function getEventLocalDate(event: FullDiscoveryEvent): string {
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

export function computeHorizonEndDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function filterEventsForResponse(
  events: FullDiscoveryEvent[],
  horizonMonths: number,
  startDate?: string,
  endDate?: string,
): FullDiscoveryEvent[] {
  const horizonEnd = computeHorizonEndDate(horizonMonths);
  const effectiveEnd = endDate
    ? (endDate < horizonEnd ? endDate : horizonEnd)
    : horizonEnd;

  return events.filter((event) => {
    const localDate = getEventLocalDate(event);
    if (startDate && localDate < startDate) return false;
    if (localDate > effectiveEnd) return false;
    return true;
  });
}

const DEFAULT_FULL_TTL = 4 * 60 * 60; // 4 hours – cron refreshes every 15 min; this is a safety net
const DEFAULT_AVAILABILITY_TTL = 30 * 60; // 30 min – cron refreshes every 15 min
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

  const config = request.config !== undefined
    ? request.config
    : (request.slug ? await getConfigBySlug(request.slug) : null);
  if (config) {
    apiKey = config.apiKey || apiKey;
    if (config.organizationIds.length > 0) {
      orgIds = config.organizationIds;
    }
    fullCacheTtl = Math.max(config.cacheTtl || 0, fullCacheTtl);
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

/**
 * Skip Upstash read/write for discovery event pipelines when:
 * - `mode=availability` — capacity must match Bond; KV was routinely stale vs live
 *   enrollment (especially with precomputed full + long TTLs). Same Bond cost on miss
 *   as full mode; caching saved little and broke spots for cache-on pages.
 * - Page opted out: `features.discoveryCacheEnabled === false` — also skip **full**
 *   mode KV/precomputed assumptions (see api/events + app pages).
 */
function shouldBypassDiscoveryKvCache(context: DiscoveryEventsContext): boolean {
  if (context.mode === 'availability') {
    return true;
  }
  return context.config?.features?.discoveryCacheEnabled === false;
}

function toCacheKey(context: DiscoveryEventsContext): string {
  // Cache key is scope-only (no slug). Configs that share the same orgs,
  // API key, and program filters produce identical pipeline data, so they
  // share one cache entry. This prevents rate-limiting when multiple slugs
  // (e.g. pbsz / pbsz-copy) trigger separate requests for the same data.
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
    return discoveryAvailabilityCacheKey('_shared', cacheScope);
  }
  return discoveryFullCacheKey('_shared', cacheScope);
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

function sessionHasPunchPassProduct(session: { products?: { isPunchPass?: boolean }[] }): boolean {
  const products = session.products || [];
  return products.some((p) => p.isPunchPass === true);
}

function toAvailabilityEvent(
  event: any,
  session: any,
  context: DiscoveryEventsContext,
  segmentId?: string
): AvailabilityDiscoveryEvent | null {
  const dateCheck = passesDateFilters(event, context);
  if (!dateCheck.keep) return null;

  const maxParticipants =
    event.maxParticipants ??
    event.max_participants ??
    (typeof event.capacity === 'number' ? event.capacity : undefined);
  const currentParticipants = event.participantsNumber ?? event.currentParticipants ?? event.current_participants ?? 0;
  const spotsRemaining =
    event.spotsLeft ??
    event.spots_left ??
    (typeof maxParticipants === 'number'
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

  const maxParticipants =
    event.maxParticipants ??
    event.max_participants ??
    (typeof event.capacity === 'number' ? event.capacity : undefined);
  const currentParticipants = event.participantsNumber ?? event.currentParticipants ?? event.current_participants ?? 0;
  const spotsRemaining =
    event.spotsLeft ??
    event.spots_left ??
    (typeof maxParticipants === 'number'
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
    hasPunchPassProduct: sessionHasPunchPassProduct(session),
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
  const bypassKv = shouldBypassDiscoveryKvCache(context);
  const allowKv = !request.forceFresh && !bypassKv;

  if (allowKv) {
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
    if (allowKv) {
      await cacheSet(cacheKey, payload, { ttl: cacheTtl });
    }
  } catch (error) {
    if (allowKv) {
      const stalePayload = await cacheGet<DiscoveryEventsPayload>(cacheKey);
      if (stalePayload) {
        return {
          payload: stalePayload,
          cacheStatus: 'HIT',
          cacheKey,
          context,
        };
      }
    }
    throw error;
  }

  return {
    payload,
    cacheStatus: bypassKv ? 'BYPASS' : 'MISS',
    cacheKey,
    context,
  };
}
