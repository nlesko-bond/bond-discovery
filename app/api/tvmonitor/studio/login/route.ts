import { NextRequest, NextResponse } from 'next/server';
import { createLoginToken, getTvMonitorUserByEmail } from '@/lib/tvmonitor-users';
import { isStudioEmailConfigured, sendStudioLoginEmail } from '@/lib/tvmonitor-email';

export const dynamic = 'force-dynamic';

/**
 * Requests a magic sign-in link. The response is identical whether or not the
 * email has access (no account enumeration); the link only goes to the inbox.
 */
export async function POST(request: NextRequest) {
  const emailConfigured = isStudioEmailConfigured();
  try {
    const body = (await request.json()) as { email?: string };
    const email = (body.email ?? '').trim();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (emailConfigured) {
      const user = await getTvMonitorUserByEmail(email);
      if (user && !user.revoked_at && user.organization_ids.length > 0) {
        const token = await createLoginToken(user.id, 'login');
        const origin = new URL(request.url).origin;
        await sendStudioLoginEmail(user.email, `${origin}/tvmonitor/studio?login=${token}`);
      }
    }

    return NextResponse.json({ ok: true, emailConfigured });
  } catch (error) {
    console.error('[TvMonitorStudio/Login] POST error:', error);
    // Same generic response — never leak whether the email exists.
    return NextResponse.json({ ok: true, emailConfigured });
  }
}
