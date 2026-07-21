import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createLoginToken, listTvMonitorUsers } from '@/lib/tvmonitor-users';
import { isStudioEmailConfigured, sendStudioLoginEmail } from '@/lib/tvmonitor-email';

export const dynamic = 'force-dynamic';

/** Mints a fresh 7-day single-use invite link for an existing user. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const user = (await listTvMonitorUsers()).find((u) => u.id === params.id && !u.revoked_at);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const token = await createLoginToken(user.id, 'invite');
    const origin = new URL(request.url).origin;
    const inviteUrl = `${origin}/tvmonitor/studio?login=${token}`;

    let emailSent = false;
    if (isStudioEmailConfigured()) {
      emailSent = await sendStudioLoginEmail(user.email, inviteUrl);
    }
    return NextResponse.json({ inviteUrl, emailSent });
  } catch (error) {
    console.error('[Admin/TvMonitorUsers] invite error:', error);
    return NextResponse.json({ error: 'Failed to create invite link' }, { status: 500 });
  }
}
