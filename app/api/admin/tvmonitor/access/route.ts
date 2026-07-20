import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { createTvMonitorAccessGrant, listTvMonitorAccessGrants } from '@/lib/tvmonitor-access';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const grants = await listTvMonitorAccessGrants();
  return NextResponse.json({ grants });
}

/**
 * Creates an org-scoped studio access link. The raw token is returned exactly
 * once here — only its hash is stored.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const session = await getServerSession(authOptions).catch(() => null);
    const { grant, token } = await createTvMonitorAccessGrant({
      organization_id: body.organization_id,
      label: body.label,
      created_by: session?.user?.email ?? null,
    });
    const origin = new URL(request.url).origin;
    return NextResponse.json(
      { grant, url: `${origin}/tvmonitor/studio?key=${token}` },
      { status: 201 },
    );
  } catch (error) {
    console.error('[Admin/TvMonitorAccess] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create access link' },
      { status: 400 },
    );
  }
}
