/**
 * Shared request preamble for every public roster route.
 *
 * Collapses the four checks that must happen, in order, before any Bond call:
 * the page exists, it is published, the viewer may see it, and — separately —
 * whether this request is entitled to staff fields.
 *
 * Routes should never assemble these themselves; a route that forgets the
 * `resolveViewerMode` step would default to whatever the caller asked for.
 */

import { NextResponse } from 'next/server';
import { findGroupNode } from '@/lib/roster-tree';
import { canViewRosterPage, resolveViewerMode } from '@/lib/roster-access';
import { getRosterPageBySlug } from '@/lib/rosters-config';
import type {
  RosterGroupNode,
  RosterPageConfig,
  RosterSessionRef,
  RosterViewerMode,
} from '@/types/rosters';

export interface RosterRequestContext {
  config: RosterPageConfig;
  mode: RosterViewerMode;
}

type RosterRequestResult =
  | { ok: true; context: RosterRequestContext }
  | { ok: false; response: NextResponse };

export async function resolveRosterRequest(slug: string): Promise<RosterRequestResult> {
  const config = await getRosterPageBySlug(slug);

  // An unpublished page is indistinguishable from a missing one, so an
  // in-progress page cannot be probed for existence.
  if (!config || !config.isActive) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const allowed = await canViewRosterPage(
    slug,
    config.pageAccess,
    config.hasViewerPassword,
    config.hasStaffPassword
  );
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Password required', locked: true }, { status: 401 }),
    };
  }

  // The only source of 'staff'. Never taken from a query param or header.
  const mode = await resolveViewerMode(slug, config.hasStaffPassword);

  return { ok: true, context: { config, mode } };
}

/** Parse a strictly-numeric positive integer query parameter. */
export function numericParam(value: string | null): number | undefined {
  // Strict: parseInt('12abc') is 12, which would let a malformed id through.
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Resolve the session a request names, bounded by the page's configured scope.
 *
 * Returns undefined when the session is outside the scope, so a viewer cannot
 * reach a session the page's org/program/date configuration excludes by
 * guessing an id.
 */
export function findSessionInScope(
  sessions: RosterSessionRef[],
  sessionId: number
): RosterSessionRef | undefined {
  return sessions.find((s) => s.sessionId === sessionId);
}

/**
 * Bound group ids to the session's own tree.
 *
 * The session check alone is not sufficient: `groupId` and `eventId` are what
 * actually select the data, and without this a viewer could read a roster from
 * a group that belongs to a different session — or to a session this page's
 * program filter deliberately excludes — by guessing an id. Relying on Bond to
 * reject a mismatched path is not a control this codebase owns or tests.
 */
export function assertGroupsInSession(
  tree: RosterGroupNode[],
  groupIds: number[]
): { ok: true } | { ok: false; response: NextResponse } {
  const unknown = groupIds.filter((id) => !findGroupNode(tree, id));
  if (unknown.length > 0) {
    return {
      ok: false,
      // 404 rather than 403: the same response a genuinely missing group gets,
      // so this cannot be used to probe which ids exist.
      response: NextResponse.json(
        { error: 'Group not available on this page' },
        { status: 404 }
      ),
    };
  }
  return { ok: true };
}

/** Bound an event id to the session's own event list, for the same reason. */
export function assertEventInSession(
  events: Array<{ id: number }>,
  eventId: number
): { ok: true } | { ok: false; response: NextResponse } {
  if (!events.some((e) => e.id === eventId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Event not available on this page' },
        { status: 404 }
      ),
    };
  }
  return { ok: true };
}
