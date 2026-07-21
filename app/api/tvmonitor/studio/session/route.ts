import { NextRequest, NextResponse } from 'next/server';
import {
  createStudioCookieValue,
  resolveAccessToken,
  TV_STUDIO_COOKIE_NAME,
  type TvStudioSession,
} from '@/lib/tvmonitor-access';
import { consumeLoginToken } from '@/lib/tvmonitor-users';

export const dynamic = 'force-dynamic';

function sessionResponse(session: TvStudioSession) {
  const cookie = createStudioCookieValue(session);
  const response = NextResponse.json({
    organizationIds: session.organizationIds,
    email: session.email ?? null,
    kind: session.kind,
  });
  response.cookies.set(TV_STUDIO_COOKIE_NAME, cookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: cookie.maxAgeSeconds,
    path: '/',
  });
  return response;
}

/**
 * Exchanges a credential for an httpOnly studio session cookie:
 * - `login`: single-use magic-link/invite token for a named user
 * - `key`:   legacy org access-link token
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { key?: string; login?: string };

    if (body.login) {
      const user = await consumeLoginToken(body.login);
      if (!user) {
        return NextResponse.json(
          { error: 'This sign-in link is invalid, expired, or already used. Request a new one below.' },
          { status: 401 },
        );
      }
      return sessionResponse({
        kind: 'user',
        id: user.id,
        organizationIds: user.organization_ids,
        email: user.email,
      });
    }

    const grant = await resolveAccessToken(body.key ?? '');
    if (!grant) {
      return NextResponse.json({ error: 'This access link is invalid or has been revoked.' }, { status: 401 });
    }
    return sessionResponse({ kind: 'grant', id: grant.id, organizationIds: [grant.organization_id] });
  } catch (error) {
    console.error('[TvMonitorStudio/Session] POST error:', error);
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TV_STUDIO_COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
  return response;
}
