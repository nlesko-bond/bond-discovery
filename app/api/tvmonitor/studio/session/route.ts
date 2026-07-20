import { NextRequest, NextResponse } from 'next/server';
import {
  createStudioCookieValue,
  resolveAccessToken,
  TV_STUDIO_COOKIE_NAME,
} from '@/lib/tvmonitor-access';

export const dynamic = 'force-dynamic';

/**
 * Exchanges a raw access-link token (?key=...) for an httpOnly studio cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { key?: string };
    const grant = await resolveAccessToken(body.key ?? '');
    if (!grant) {
      return NextResponse.json({ error: 'This access link is invalid or has been revoked.' }, { status: 401 });
    }
    const cookie = createStudioCookieValue({ grantId: grant.id, organizationIds: [grant.organization_id] });
    const response = NextResponse.json({ organizationIds: [grant.organization_id], label: grant.label });
    response.cookies.set(TV_STUDIO_COOKIE_NAME, cookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookie.maxAgeSeconds,
      path: '/',
    });
    return response;
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
