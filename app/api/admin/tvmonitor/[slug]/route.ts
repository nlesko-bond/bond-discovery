import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deleteTvMonitorPage, getTvMonitorPageBySlug, updateTvMonitorPage } from '@/lib/tvmonitor-config';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const page = await getTvMonitorPageBySlug(params.slug);
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ page });
}

export async function PATCH(request: NextRequest, { params }: { params: { slug: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const page = await updateTvMonitorPage(params.slug, body);
    return NextResponse.json({ page });
  } catch (error) {
    console.error('[Admin/TvMonitor] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update page' },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { slug: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ok = await deleteTvMonitorPage(params.slug);
  if (!ok) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
