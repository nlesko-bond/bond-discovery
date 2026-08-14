import { NextRequest, NextResponse } from 'next/server';
import {
  checkRosterPassword,
  createRosterAccessCookieValue,
  rosterAccessCookieName,
  rosterAccessCookieOptions,
  type RosterAccessScope,
} from '@/lib/roster-access';
import { consumeRosterRateLimit } from '@/lib/roster-rate-limit';
import { getRosterPageSecrets } from '@/lib/rosters-config';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * Exchange a password for a scoped access cookie.
 *
 * `scope: 'viewer'` unlocks a password-protected page; `scope: 'staff'`
 * additionally unlocks the PII columns. The two hashes are independent, so a
 * viewer password can never grant staff fields.
 */
export async function POST(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;

  const limited = consumeRosterRateLimit(request, slug, 'unlock');
  if (limited.blocked) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  let body: { password?: string; scope?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const scope: RosterAccessScope = body.scope === 'staff' ? 'staff' : 'viewer';
  const password = typeof body.password === 'string' ? body.password : '';

  const secrets = await getRosterPageSecrets(slug);
  if (!secrets.found || !secrets.isActive) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const hash = scope === 'staff' ? secrets.staffPasswordHash : secrets.viewerPasswordHash;

  // A page with no hash for this scope cannot be unlocked into it. Reported as
  // a failed attempt rather than a distinct error, so the response does not
  // reveal which scopes a page has configured.
  if (!hash || !checkRosterPassword(password, hash)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  let value: string;
  let maxAgeSeconds: number;
  try {
    ({ value, maxAgeSeconds } = createRosterAccessCookieValue(scope, slug));
  } catch (error) {
    // ROSTER_ACCESS_SECRET missing in a deployed env. Without this the correct
    // password would surface to the user as a generic 500 -- reported as "the
    // password stopped working", with the real cause only in a stack trace.
    console.error(`[rosters/${slug}/unlock] cannot mint access cookie`, error);
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 503 }
    );
  }
  const response = NextResponse.json({ ok: true, scope });
  response.cookies.set(
    rosterAccessCookieName(scope, slug),
    value,
    rosterAccessCookieOptions(maxAgeSeconds)
  );
  return response;
}

