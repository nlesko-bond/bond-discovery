import { NextRequest, NextResponse } from 'next/server';
import {
  loadGroupParticipants,
  loadParticipantMatrix,
  loadRosterGroups,
  loadRosterScope,
  loadSessionEvents,
} from '@/lib/roster-data';
import { consumeRosterRateLimit } from '@/lib/roster-rate-limit';
import {
  assertGroupsInSession,
  findSessionInScope,
  numericParam,
  resolveRosterRequest,
} from '@/lib/roster-request';
import { toDateColumns, zonedDateKey } from '@/lib/roster-time';
import { findGroupNode } from '@/lib/roster-tree';

export const dynamic = 'force-dynamic';
// The matrix path issues up to MAX_BULK_EVENTS Bond requests at concurrency 3.
export const maxDuration = 60;

interface Ctx {
  params: Promise<{ slug: string }>;
}

const NO_STORE = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
};

/**
 * Data for the two grid sheets.
 *
 * `kind=checkin` returns participants plus date columns with no marks — the
 * grid is deliberately blank, because Bond exposes no check-in or attendance
 * state and a pre-filled grid would imply one.
 *
 * `kind=matrix` returns the same shape with marks, where a mark means the
 * participant is *registered for* that event.
 */
export async function GET(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;

  const resolved = await resolveRosterRequest(slug);
  if (!resolved.ok) return resolved.response;


  const limited = consumeRosterRateLimit(request, slug, 'bulk');
  if (limited.blocked) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  const { config, mode } = resolved.context;
  const params = request.nextUrl.searchParams;

  const sessionId = numericParam(params.get('sessionId'));
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }
  const kind = params.get('kind') === 'matrix' ? 'matrix' : 'checkin';
  const groupId = numericParam(params.get('groupId'));

  try {
    const sessions = await loadRosterScope(config);
    const session = findSessionInScope(sessions, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not available on this page' }, { status: 404 });
    }

    const groups = await loadRosterGroups(config, session);
    const { timezone } = groups;

    if (kind === 'matrix') {
      const matrix = await loadParticipantMatrix(config, session, mode);

      // Map each event to its facility-local date column here, where the
      // timezone is known. Doing it in the browser from the UTC timestamp
      // would put a Friday-evening event in Saturday's column.
      const eventDateKeys: Record<number, string> = {};
      for (const event of matrix.events) {
        eventDateKeys[event.id] = zonedDateKey(event.startDate, timezone);
      }

      return NextResponse.json(
        {
          kind,
          mode,
          session,
          timezone,
          columns: toDateColumns(
            matrix.events.map((e) => ({ startTime: e.startDate })),
            timezone
          ),
          eventDateKeys,
          participants: matrix.participants,
          marks: matrix.marks,
          truncated: matrix.truncated,
        },
        { headers: NO_STORE }
      );
    }

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required for a check-in sheet' },
        { status: 400 }
      );
    }

    // Bound the group to this session before fetching its roster.
    const bounded = assertGroupsInSession(groups.tree, [groupId]);
    if (!bounded.ok) return bounded.response;

    const [{ events }, participants] = await Promise.all([
      loadSessionEvents(config, session),
      loadGroupParticipants(config, session, groupId, mode),
    ]);

    return NextResponse.json(
      {
        kind,
        mode,
        session,
        timezone,
        groupName: findGroupNode(groups.tree, groupId)?.name ?? null,
        columns: toDateColumns(
          events.map((e) => ({ startTime: e.startDate })),
          timezone
        ),
        participants,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error(`[rosters/${slug}/sheet]`, error);
    return NextResponse.json({ error: 'Failed to build sheet' }, { status: 502 });
  }
}
