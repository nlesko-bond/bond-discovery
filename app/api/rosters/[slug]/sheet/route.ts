import { NextRequest, NextResponse } from 'next/server';
import {
  loadGroupParticipants,
  loadParticipantMatrix,
  loadRosterGroups,
  loadRosterScope,
  loadSessionEvents,
} from '@/lib/roster-data';
import { numericParam, resolveRosterRequest } from '@/lib/roster-request';
import { toDateColumns, zonedDateKey } from '@/lib/roster-time';
import { findGroupNode } from '@/lib/roster-tree';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

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
    const session = sessions.find((s) => s.sessionId === sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not available on this page' }, { status: 404 });
    }

    const { timezone } = await loadRosterGroups(config, session);

    if (kind === 'matrix') {
      const matrix = await loadParticipantMatrix(config, session, mode);

      // Map each event to its facility-local date column here, where the
      // timezone is known. Doing it in the browser from the UTC timestamp
      // would put a Friday-evening event in Saturday's column.
      const eventDateKeys: Record<number, string> = {};
      for (const event of matrix.events) {
        eventDateKeys[event.id] = zonedDateKey(event.startDate, timezone);
      }

      return NextResponse.json({
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
      });
    }

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required for a check-in sheet' },
        { status: 400 }
      );
    }

    const [{ events }, participants, groups] = await Promise.all([
      loadSessionEvents(config, session),
      loadGroupParticipants(config, session, groupId, mode),
      loadRosterGroups(config, session),
    ]);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error(`[rosters/${slug}/sheet]`, error);
    return NextResponse.json({ error: 'Failed to build sheet' }, { status: 502 });
  }
}
