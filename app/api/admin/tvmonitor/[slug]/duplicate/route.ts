import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { duplicateTvMonitorPage } from '@/lib/tvmonitor-config';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: { slug: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const page = await duplicateTvMonitorPage(params.slug);
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error('[Admin/TvMonitor] duplicate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to duplicate page' },
      { status: 400 },
    );
  }
}
