import { NextRequest, NextResponse } from 'next/server';
import { loadRosterGroups, loadRosterScope } from '@/lib/roster-data';
import { numericParam, resolveRosterRequest } from '@/lib/roster-request';
import { isSessionInScope } from '@/lib/roster-scope';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

/** The division/team tree for one session, plus its facility timezone. */
export async function GET(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;

  const resolved = await resolveRosterRequest(slug);
  if (!resolved.ok) return resolved.response;

  const { config } = resolved.context;
  const sessionId = numericParam(request.nextUrl.searchParams.get('sessionId'));
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const sessions = await loadRosterScope(config);
    const session = sessions.find((s) => s.sessionId === sessionId);

    // Bounds the page: a viewer cannot reach a session outside the configured
    // scope by guessing an id.
    if (!session || !isSessionInScope(sessions, session.programId, sessionId)) {
      return NextResponse.json({ error: 'Session not available on this page' }, { status: 404 });
    }

    const groups = await loadRosterGroups(config, session);
    return NextResponse.json({ session, ...groups });
  } catch (error) {
    console.error(`[rosters/${slug}/groups]`, error);
    // Bond 404s a session that is not published; that is an empty state for us,
    // not an error the viewer can act on.
    return NextResponse.json({ error: 'Failed to load groups' }, { status: 502 });
  }
}
