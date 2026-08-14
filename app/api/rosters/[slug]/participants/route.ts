import { NextRequest, NextResponse } from 'next/server';
import {
  loadEventParticipants,
  loadGroupParticipants,
  loadRosterGroups,
  loadRosterScope,
  loadRostersForGroups,
  loadSessionEvents,
} from '@/lib/roster-data';
import { consumeRosterRateLimit } from '@/lib/roster-rate-limit';
import {
  assertEventInSession,
  assertGroupsInSession,
  findSessionInScope,
  numericParam,
  resolveRosterRequest,
} from '@/lib/roster-request';

export const dynamic = 'force-dynamic';
// Bulk reads fan out one Bond request per group; without this the platform's
// default duration can kill the request before the route's own error handling.
export const maxDuration = 60;

interface Ctx {
  params: Promise<{ slug: string }>;
}

/** PII responses must never be held by a CDN or shared proxy. */
const NO_STORE = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
};

/**
 * Participants for a group, an event, or several groups at once.
 *
 * Everything returned is already redacted for the resolved viewer mode — the
 * mode comes from a verified cookie, never from this request's parameters —
 * and every id is bounded to the page's configured scope before any fetch.
 */
export async function GET(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;

  const resolved = await resolveRosterRequest(slug);
  if (!resolved.ok) return resolved.response;


  // Charge the number of upstream calls this request will make, not just 1.
  const fanOut = Math.max(1, (request.nextUrl.searchParams.get('groupIds') || '').split(',').filter(Boolean).length);
  const limited = consumeRosterRateLimit(request, slug, 'bulk', fanOut);
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

  const groupId = numericParam(params.get('groupId'));
  const eventId = numericParam(params.get('eventId'));
  const groupIds = (params.get('groupIds') || '')
    .split(',')
    .filter(Boolean)
    .map((value) => numericParam(value))
    .filter((n): n is number => n !== undefined);

  if (!groupId && !eventId && groupIds.length === 0) {
    return NextResponse.json(
      { error: 'One of groupId, eventId or groupIds is required' },
      { status: 400 }
    );
  }

  try {
    const sessions = await loadRosterScope(config);
    const session = findSessionInScope(sessions, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not available on this page' }, { status: 404 });
    }

    if (eventId) {
      const { events } = await loadSessionEvents(config, session);
      const bounded = assertEventInSession(events, eventId);
      if (!bounded.ok) return bounded.response;

      const participants = await loadEventParticipants(config, session, eventId, mode);
      return NextResponse.json({ mode, participants }, { headers: NO_STORE });
    }

    // Both remaining branches select by group id, so bound them against the
    // session's own tree before touching Bond.
    const requested = groupId ? [groupId] : groupIds;
    const { tree } = await loadRosterGroups(config, session);
    const bounded = assertGroupsInSession(tree, requested);
    if (!bounded.ok) return bounded.response;

    if (groupId) {
      const participants = await loadGroupParticipants(config, session, groupId, mode);
      return NextResponse.json({ mode, participants }, { headers: NO_STORE });
    }

    const bulk = await loadRostersForGroups(config, session, groupIds, mode);
    return NextResponse.json({ mode, ...bulk }, { headers: NO_STORE });
  } catch (error) {
    console.error(`[rosters/${slug}/participants]`, error);
    return NextResponse.json({ error: 'Failed to load participants' }, { status: 502 });
  }
}
