import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireStudioSession, TV_STUDIO_COOKIE_NAME } from '@/lib/tvmonitor-access';
import { duplicateTvMonitorPage, getTvMonitorPageBySlug } from '@/lib/tvmonitor-config';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: { slug: string } }) {
  const session = await requireStudioSession(cookies().get(TV_STUDIO_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const source = await getTvMonitorPageBySlug(params.slug);
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!session.organizationIds.includes(source.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const page = await duplicateTvMonitorPage(params.slug);
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error('[TvMonitorStudio/Duplicate] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to duplicate page' },
      { status: 400 },
    );
  }
}
