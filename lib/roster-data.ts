/**
 * Server-side data loading for roster pages.
 *
 * Every function here returns *redacted* data. Raw Bond participant records
 * must not escape this module — callers get `RosterParticipant`, which only
 * ever carries what the page's field visibility permits for the given viewer
 * mode. See lib/roster-privacy.ts for the redaction itself.
 */

import { resolveBondEnv } from '@/lib/bond-env';
import { createBondClient } from '@/lib/bond-client';
import {
  cacheGet,
  cacheSet,
  rosterEventParticipantsCacheKey,
  rosterGroupsCacheKey,
  rosterParticipantsCacheKey,
  rosterScopeCacheKey,
} from '@/lib/cache';
import { redactParticipant, resolveExpand, sortParticipants } from '@/lib/roster-privacy';
import { resolveRosterSessions } from '@/lib/roster-scope';
import { resolveTimeZone } from '@/lib/roster-time';
import { buildGroupTree } from '@/lib/roster-tree';
import { transformProgram } from '@/lib/transformers';
import type { Program, Session } from '@/types';
import type {
  BondGroup,
  RosterGroupNode,
  RosterPageConfig,
  RosterParticipant,
  RosterSessionRef,
  RosterViewerMode,
} from '@/types/rosters';

const SCOPE_TTL = 15 * 60;
const GROUPS_TTL = 10 * 60;
const PARTICIPANTS_PUBLIC_TTL = 5 * 60;
const PARTICIPANTS_STAFF_TTL = 60;

/**
 * Ceilings on bulk fan-out. Exceeding one is reported to the caller rather
 * than silently truncating — a roster that quietly drops teams reads as
 * complete when it is not.
 */
export const MAX_BULK_GROUPS = 60;
export const MAX_BULK_EVENTS = 60;

const FETCH_CONCURRENCY = 3;

function clientFor(config: RosterPageConfig) {
  return createBondClient(config.apiKey, resolveBondEnv(config.bondEnv));
}

/**
 * Staff payloads carry participant PII, so they are cached in this process only
 * — production KV is shared with preview and local deployments, and anything
 * written there outlives the request in a place other environments can read.
 */
function participantCacheOptions(config: RosterPageConfig, mode: RosterViewerMode) {
  if (mode === 'staff') {
    return { ttl: PARTICIPANTS_STAFF_TTL, memoryOnly: true };
  }
  // A gated page's roster is not public, and once names are shown the payload
  // identifies people. Only a genuinely public, de-identified roster is safe to
  // persist in KV that preview and local deployments can read.
  const identifying =
    config.pageAccess !== 'public' || config.fieldVisibility.nameMode !== 'numberOnly';
  return identifying
    ? { ttl: PARTICIPANTS_PUBLIC_TTL, memoryOnly: true }
    : { ttl: PARTICIPANTS_PUBLIC_TTL };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Sessions this page's viewers may browse. */
export async function loadRosterScope(config: RosterPageConfig): Promise<RosterSessionRef[]> {
  const key = rosterScopeCacheKey(config.slug);
  const cached = await cacheGet<RosterSessionRef[]>(key);
  if (cached) return cached;

  // A page with no orgs can never resolve anything. Failing here gives the
  // operator a real error instead of an empty page that reads as "no seasons
  // published yet" -- which sends them to check Bond rather than the config.
  if (config.organizationIds.length === 0) {
    throw new Error(
      `Roster page "${config.slug}" has no organization IDs configured.`
    );
  }

  const client = clientFor(config);
  const programs: Program[] = [];
  const sessionsByProgramId = new Map<number, Session[]>();
  const orgByProgramId = new Map<number, number>();

  for (const orgId of config.organizationIds) {
    const response = await client.getAllPrograms(String(orgId), {
      expand: 'sessions',
    });
    for (const raw of response.data || []) {
      const program = transformProgram(raw);
      programs.push(program);
      orgByProgramId.set(Number(program.id), orgId);

      // Read the transformed program, not the raw payload. Bond returns
      // `expand=sessions` as a `{ meta, data }` envelope rather than a bare
      // array, and `transformProgram` already unwraps it via `normalizeArray`.
      // Reaching back into `raw` and testing `Array.isArray` silently produced
      // zero sessions for every program.
      if (program.sessions?.length) {
        sessionsByProgramId.set(Number(program.id), program.sessions);
      }
    }
  }

  const sessions = resolveRosterSessions(
    config,
    programs,
    sessionsByProgramId,
    new Date(),
    orgByProgramId
  );

  // Log rather than silently caching an empty scope for 15 minutes: zero
  // sessions from a non-zero program list almost always means the program
  // filter or the date window is wrong, not that nothing is published.
  if (sessions.length === 0) {
    console.warn('[roster-scope] resolved zero sessions', {
      slug: config.slug,
      orgIds: config.organizationIds,
      programsFetched: programs.length,
      filterMode: config.programFilter.mode,
    });
    // Deliberately not cached: an empty scope is nearly always a bad program
    // filter or date window, and caching it hides the misconfiguration for a
    // further 15 minutes after someone fixes it.
    return sessions;
  }

  await cacheSet(key, sessions, { ttl: SCOPE_TTL });
  return sessions;
}

export interface RosterGroupsResult {
  tree: RosterGroupNode[];
  /** Facility timezone for the session — every time on the page renders in it. */
  timezone: string;
  groupCount: number;
}

/**
 * The whole division/team tree for a session, in one paginated Bond call.
 * `expand=facility` is what carries the timezone; there is no other source for
 * it on this endpoint.
 */
export async function loadRosterGroups(
  config: RosterPageConfig,
  session: RosterSessionRef
): Promise<RosterGroupsResult> {
  const key = rosterGroupsCacheKey(config.slug, session.sessionId);
  const cached = await cacheGet<RosterGroupsResult>(key);
  if (cached) return cached;

  const client = clientFor(config);
  const response = await client.getSessionGroups(
    session.organizationId,
    session.programId,
    session.sessionId,
    { expand: ['teamIdentity', 'facility'] }
  );

  const groups: BondGroup[] = response.data || [];
  const facilityTimezone = groups
    .map((g) => (g as unknown as { facility?: { timezone?: string } }).facility?.timezone)
    .find(Boolean);

  const result: RosterGroupsResult = {
    tree: buildGroupTree(groups),
    timezone: resolveTimeZone(facilityTimezone, session.timezone),
    groupCount: groups.length,
  };

  await cacheSet(key, result, { ttl: GROUPS_TTL });
  return result;
}

/** One team's roster, redacted for the given viewer. */
export async function loadGroupParticipants(
  config: RosterPageConfig,
  session: RosterSessionRef,
  groupId: number,
  mode: RosterViewerMode
): Promise<RosterParticipant[]> {
  const key = rosterParticipantsCacheKey(config.slug, session.sessionId, groupId, mode);
  const cached = await cacheGet<RosterParticipant[]>(key);
  if (cached) return cached;

  const client = clientFor(config);
  const expand = resolveExpand(mode, config.fieldVisibility);
  const response = await client.getGroupParticipants(
    session.organizationId,
    session.programId,
    session.sessionId,
    groupId,
    { expand }
  );

  const participants = sortParticipants(
    (response.data || [])
      .filter((raw) => !raw.deletedAt)
      .map((raw) => redactParticipant(raw, config.fieldVisibility, mode))
  );

  await cacheSet(key, participants, participantCacheOptions(config, mode));
  return participants;
}

/** Participants attached to one event, redacted. */
export async function loadEventParticipants(
  config: RosterPageConfig,
  session: RosterSessionRef,
  eventId: number,
  mode: RosterViewerMode
): Promise<RosterParticipant[]> {
  const key = rosterEventParticipantsCacheKey(config.slug, session.sessionId, eventId, mode);
  const cached = await cacheGet<RosterParticipant[]>(key);
  if (cached) return cached;

  const client = clientFor(config);
  const expand = resolveExpand(mode, config.fieldVisibility);
  const response = await client.getEventParticipants(
    session.organizationId,
    session.programId,
    session.sessionId,
    eventId,
    { expand }
  );

  const participants = (response.data || [])
    .filter((raw) => !raw.deletedAt)
    .map((raw) => redactParticipant(raw, config.fieldVisibility, mode));

  await cacheSet(key, participants, participantCacheOptions(config, mode));
  return participants;
}

export interface RosterEvent {
  id: number;
  title: string;
  startDate: string;
  endDate?: string;
}

/** Events in a session, used as the date columns of check-in and matrix sheets. */
export async function loadSessionEvents(
  config: RosterPageConfig,
  session: RosterSessionRef
): Promise<{ events: RosterEvent[]; timezone: string }> {
  const key = `roster:events:${config.slug}:${session.sessionId}`;
  const cached = await cacheGet<{ events: RosterEvent[]; timezone: string }>(key);
  if (cached) return cached;

  const client = clientFor(config);
  const response = await client.getEvents(
    String(session.organizationId),
    String(session.programId),
    String(session.sessionId)
  );

  // Bond returns richer event fields than our SessionEvent interface models
  // (title, startDate, timezone), so read them off the raw payload.
  const raw = (response.data || []) as unknown as Array<Record<string, unknown>>;
  const events: RosterEvent[] = raw
    .map((e) => ({
      id: Number(e.id),
      title: String(e.title || e.name || ''),
      startDate: String(e.startDate || e.startTime || ''),
      endDate: e.endDate ? String(e.endDate) : undefined,
    }))
    .filter((e) => Number.isFinite(e.id) && e.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Events carry their own timezone; fall back to the facility's from groups.
  const eventTimezone = raw.map((e) => e.timezone).find((tz) => typeof tz === 'string') as
    | string
    | undefined;

  const result = {
    events,
    timezone: resolveTimeZone(eventTimezone, session.timezone),
  };
  await cacheSet(key, result, { ttl: GROUPS_TTL });
  return result;
}

export interface RosterMatrixResult {
  participants: RosterParticipant[];
  /** One column per event, in chronological order. */
  events: RosterEvent[];
  /**
   * participantId -> set of event ids they are registered for. A mark means
   * *registered for*, never *attended* — Bond exposes no check-in state.
   */
  marks: Record<string, number[]>;
  truncated?: { requested: number; loaded: number; cap: number };
}

/**
 * Build the participant x event matrix by inverting per-event participant
 * lists. Costs one Bond request per event, so it is capped and reports when
 * the cap bites.
 */
export async function loadParticipantMatrix(
  config: RosterPageConfig,
  session: RosterSessionRef,
  mode: RosterViewerMode
): Promise<RosterMatrixResult> {
  const { events } = await loadSessionEvents(config, session);
  const capped = events.slice(0, MAX_BULK_EVENTS);

  const perEvent = await mapWithConcurrency(capped, FETCH_CONCURRENCY, async (event) => ({
    eventId: event.id,
    participants: await loadEventParticipants(config, session, event.id, mode),
  }));

  const byId = new Map<string, RosterParticipant>();
  const marks: Record<string, number[]> = {};

  for (const { eventId, participants } of perEvent) {
    for (const participant of participants) {
      if (!byId.has(participant.id)) byId.set(participant.id, participant);
      (marks[participant.id] ??= []).push(eventId);
    }
  }

  const result: RosterMatrixResult = {
    participants: sortParticipants([...byId.values()]),
    events: capped,
    marks,
  };

  return events.length > capped.length
    ? {
        ...result,
        truncated: { requested: events.length, loaded: capped.length, cap: MAX_BULK_EVENTS },
      }
    : result;
}

export interface BulkRosterResult {
  rosters: Array<{ groupId: number; participants: RosterParticipant[] }>;
  /** Set when the group list was capped; surfaced in the UI, never silent. */
  truncated?: { requested: number; loaded: number; cap: number };
}

/**
 * Rosters for many groups at once — used by print and export.
 *
 * Capped at MAX_BULK_GROUPS because this is one Bond request per group and a
 * large league can hold hundreds. When the cap bites, the caller is told.
 */
export async function loadRostersForGroups(
  config: RosterPageConfig,
  session: RosterSessionRef,
  groupIds: number[],
  mode: RosterViewerMode
): Promise<BulkRosterResult> {
  const capped = groupIds.slice(0, MAX_BULK_GROUPS);

  const rosters = await mapWithConcurrency(capped, FETCH_CONCURRENCY, async (groupId) => ({
    groupId,
    participants: await loadGroupParticipants(config, session, groupId, mode),
  }));

  return groupIds.length > capped.length
    ? {
        rosters,
        truncated: { requested: groupIds.length, loaded: capped.length, cap: MAX_BULK_GROUPS },
      }
    : { rosters };
}
