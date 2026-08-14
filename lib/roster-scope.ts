/**
 * Resolves a roster page's configured bound into the concrete list of sessions
 * a viewer may browse.
 *
 * The admin sets a bound (orgs + program allow/blocklist + a rolling date
 * window); the viewer navigates inside it. The window is rolling rather than a
 * pinned session list so that new seasons appear without anyone re-configuring
 * the page — leagues re-run every term, and hand-pinning is recurring toil.
 * `pinnedSessions` remains available as an explicit override.
 */

import type { Program, Session } from '@/types';
import type { RosterPageConfig, RosterProgramFilter, RosterSessionRef } from '@/types/rosters';

/** Inclusive day-bounded window around today. */
export interface ResolvedWindow {
  from: Date;
  to: Date;
}

/**
 * Bounds are computed in UTC, not local time. Bond returns date-only strings
 * (`2026-09-01`) which `new Date()` parses as UTC midnight, so a locally-anchored
 * boundary would shift the window by a day for any server west of Greenwich and
 * silently include or drop a season at the edge.
 */
export function resolveSessionWindow(
  config: Pick<RosterPageConfig, 'sessionWindow'>,
  now = new Date()
): ResolvedWindow {
  const { pastDays, futureDays } = config.sessionWindow;

  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - Math.max(0, pastDays));
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + Math.max(0, futureDays));
  to.setUTCHours(23, 59, 59, 999);

  return { from, to };
}

export function isProgramAllowed(programId: number, filter: RosterProgramFilter): boolean {
  if (filter.mode === 'all') return true;
  const listed = filter.programIds.includes(programId);
  return filter.mode === 'include' ? listed : !listed;
}

/**
 * A session counts as in-window when its own date range overlaps the window at
 * all — an eight-week season that started before the window opened is still
 * running, and its roster is still the one people want.
 *
 * A session missing both dates is kept: excluding it would silently hide a
 * roster, and the empty-state cost of keeping it is far lower.
 */
export function isSessionInWindow(session: Pick<Session, 'startDate' | 'endDate'>, window: ResolvedWindow): boolean {
  const start = session.startDate ? new Date(session.startDate) : undefined;
  const end = session.endDate ? new Date(session.endDate) : undefined;

  const validStart = start && !Number.isNaN(start.getTime()) ? start : undefined;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : undefined;

  if (!validStart && !validEnd) return true;

  const effectiveStart = validStart ?? validEnd!;
  const effectiveEnd = validEnd ?? validStart!;

  return effectiveStart <= window.to && effectiveEnd >= window.from;
}

function toSessionRef(program: Program, session: Session): RosterSessionRef {
  return {
    programId: Number(program.id),
    programName: program.name,
    sessionId: Number(session.id),
    sessionName: session.name || program.name,
    linkSEO: session.linkSEO,
    startDate: session.startDate,
    endDate: session.endDate,
    sport: program.sport,
  };
}

/**
 * Newest first — the current season is nearly always what a viewer wants, and
 * sessions with no start date sort last rather than jumping to the top.
 */
export function sortSessionRefs(refs: RosterSessionRef[]): RosterSessionRef[] {
  return [...refs].sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : Number.NEGATIVE_INFINITY;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : Number.NEGATIVE_INFINITY;
    if (aTime !== bTime) return bTime - aTime;
    return a.sessionName.localeCompare(b.sessionName, undefined, { numeric: true });
  });
}

/**
 * Build the viewer-facing session list from programs already fetched for the
 * page's orgs. Pure, so the fetching strategy and caching stay in the route.
 *
 * `sessionsByProgramId` holds the sessions for each program; a program with no
 * entry contributes nothing.
 */
export function resolveRosterSessions(
  config: Pick<RosterPageConfig, 'programFilter' | 'pinnedSessions' | 'sessionWindow'>,
  programs: Program[],
  sessionsByProgramId: Map<number, Session[]>,
  now = new Date()
): RosterSessionRef[] {
  const pinned = config.pinnedSessions ?? [];
  const usePins = pinned.length > 0;
  const pinnedKeys = new Set(pinned.map((p) => `${p.programId}:${p.sessionId}`));
  const window = resolveSessionWindow(config, now);

  const refs: RosterSessionRef[] = [];

  for (const program of programs) {
    const programId = Number(program.id);
    if (Number.isNaN(programId)) continue;

    // The allow/blocklist bounds the page even when sessions are pinned, so a
    // stale pin can never reach a program the admin has since excluded.
    if (!isProgramAllowed(programId, config.programFilter)) continue;

    for (const session of sessionsByProgramId.get(programId) ?? []) {
      const sessionId = Number(session.id);
      if (Number.isNaN(sessionId)) continue;

      const keep = usePins
        ? pinnedKeys.has(`${programId}:${sessionId}`)
        : isSessionInWindow(session, window);

      if (keep) refs.push(toSessionRef(program, session));
    }
  }

  return sortSessionRefs(refs);
}

/** True when the viewer-supplied session is inside the page's resolved scope. */
export function isSessionInScope(
  sessions: RosterSessionRef[],
  programId: number,
  sessionId: number
): boolean {
  return sessions.some((s) => s.programId === programId && s.sessionId === sessionId);
}
