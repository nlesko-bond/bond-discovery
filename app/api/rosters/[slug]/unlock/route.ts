import { NextRequest, NextResponse } from 'next/server';
import {
  checkRosterPassword,
  createRosterAccessCookieValue,
  rosterAccessCookieName,
  rosterAccessCookieOptions,
  type RosterAccessScope,
} from '@/lib/roster-access';
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

  const { value, maxAgeSeconds } = createRosterAccessCookieValue(scope, slug);
  const response = NextResponse.json({ ok: true, scope });
  response.cookies.set(
    rosterAccessCookieName(scope, slug),
    value,
    rosterAccessCookieOptions(maxAgeSeconds)
  );
  return response;
}

/** Sign out of a scope — used by the "lock" control on shared machines. */
export async function DELETE(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;
  const scope: RosterAccessScope =
    request.nextUrl.searchParams.get('scope') === 'staff' ? 'staff' : 'viewer';

  const response = NextResponse.json({ ok: true });
  response.cookies.set(rosterAccessCookieName(scope, slug), '', {
    ...rosterAccessCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
