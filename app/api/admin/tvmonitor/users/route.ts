import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { createLoginToken, createTvMonitorUser, listTvMonitorUsers } from '@/lib/tvmonitor-users';
import { isStudioEmailConfigured, sendStudioLoginEmail } from '@/lib/tvmonitor-email';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const users = await listTvMonitorUsers();
  return NextResponse.json({ users, emailConfigured: isStudioEmailConfigured() });
}

/**
 * Adds (or reactivates) a studio user and mints a 7-day single-use invite
 * link. If email is configured the invite is also sent to their inbox.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const session = await getServerSession(authOptions).catch(() => null);
    const user = await createTvMonitorUser({
      email: body.email,
      organization_ids: body.organization_ids,
      created_by: session?.user?.email ?? null,
    });

    const token = await createLoginToken(user.id, 'invite');
    const origin = new URL(request.url).origin;
    const inviteUrl = `${origin}/tvmonitor/studio?login=${token}`;

    let emailSent = false;
    if (isStudioEmailConfigured()) {
      emailSent = await sendStudioLoginEmail(user.email, inviteUrl);
    }

    return NextResponse.json({ user, inviteUrl, emailSent }, { status: 201 });
  } catch (error) {
    console.error('[Admin/TvMonitorUsers] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add user' },
      { status: 400 },
    );
  }
}
