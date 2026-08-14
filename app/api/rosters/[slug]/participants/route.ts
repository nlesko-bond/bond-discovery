import { NextRequest, NextResponse } from 'next/server';
import {
  loadEventParticipants,
  loadGroupParticipants,
  loadRosterScope,
  loadRostersForGroups,
} from '@/lib/roster-data';
import { numericParam, resolveRosterRequest } from '@/lib/roster-request';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * Participants for a group, an event, or several groups at once.
 *
 * Everything returned is already redacted for the resolved viewer mode — the
 * mode comes from a verified cookie, never from this request's parameters.
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

  const groupId = numericParam(params.get('groupId'));
  const eventId = numericParam(params.get('eventId'));
  const groupIds = (params.get('groupIds') || '')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!groupId && !eventId && groupIds.length === 0) {
    return NextResponse.json(
      { error: 'One of groupId, eventId or groupIds is required' },
      { status: 400 }
    );
  }

  try {
    const sessions = await loadRosterScope(config);
    const session = sessions.find((s) => s.sessionId === sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not available on this page' }, { status: 404 });
    }

    if (eventId) {
      const participants = await loadEventParticipants(config, session, eventId, mode);
      return NextResponse.json({ mode, participants });
    }

    if (groupId) {
      const participants = await loadGroupParticipants(config, session, groupId, mode);
      return NextResponse.json({ mode, participants });
    }

    const bulk = await loadRostersForGroups(config, session, groupIds, mode);
    return NextResponse.json({ mode, ...bulk });
  } catch (error) {
    console.error(`[rosters/${slug}/participants]`, error);
    return NextResponse.json({ error: 'Failed to load participants' }, { status: 502 });
  }
}
