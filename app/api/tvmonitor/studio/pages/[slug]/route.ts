import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireStudioSession, TV_STUDIO_COOKIE_NAME } from '@/lib/tvmonitor-access';
import {
  deleteTvMonitorPage,
  getTvMonitorPageBySlug,
  updateTvMonitorPage,
} from '@/lib/tvmonitor-config';

export const dynamic = 'force-dynamic';

async function getAuthorizedPage(slug: string) {
  const session = await requireStudioSession(cookies().get(TV_STUDIO_COOKIE_NAME)?.value);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const page = await getTvMonitorPageBySlug(slug);
  if (!page) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!session.organizationIds.includes(page.organization_id)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { page };
}

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const { page, error } = await getAuthorizedPage(params.slug);
  if (error) return error;
  return NextResponse.json({ page });
}

export async function PATCH(request: NextRequest, { params }: { params: { slug: string } }) {
  const { error } = await getAuthorizedPage(params.slug);
  if (error) return error;
  try {
    const body = await request.json();
    // Org ownership is fixed at creation; studio users cannot re-home a page.
    delete body.organization_id;
    const page = await updateTvMonitorPage(params.slug, body);
    return NextResponse.json({ page });
  } catch (err) {
    console.error('[TvMonitorStudio/Page] PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update page' },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { slug: string } }) {
  const { error } = await getAuthorizedPage(params.slug);
  if (error) return error;
  const ok = await deleteTvMonitorPage(params.slug);
  if (!ok) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
