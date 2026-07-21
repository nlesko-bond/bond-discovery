import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireStudioSession, TV_STUDIO_COOKIE_NAME } from '@/lib/tvmonitor-access';
import { createTvMonitorPage, getTvMonitorPagesByOrgs } from '@/lib/tvmonitor-config';

export const dynamic = 'force-dynamic';

async function getSession() {
  return requireStudioSession(cookies().get(TV_STUDIO_COOKIE_NAME)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const pages = await getTvMonitorPagesByOrgs(session.organizationIds);
  return NextResponse.json({ pages });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const organizationId = Number(body.organization_id);
    if (!session.organizationIds.includes(organizationId)) {
      return NextResponse.json({ error: 'You do not have access to that organization' }, { status: 403 });
    }
    const page = await createTvMonitorPage({
      ...body,
      organization_id: organizationId,
      created_by: session.email ?? 'studio',
    });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error('[TvMonitorStudio/Pages] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create page' },
      { status: 400 },
    );
  }
}
