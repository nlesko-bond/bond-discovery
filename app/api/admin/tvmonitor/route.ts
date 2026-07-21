import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { createTvMonitorPage, getAllTvMonitorPages } from '@/lib/tvmonitor-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const pages = await getAllTvMonitorPages();
    return NextResponse.json({ pages });
  } catch (error) {
    console.error('[Admin/TvMonitor] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const session = await getServerSession(authOptions).catch(() => null);
    const page = await createTvMonitorPage({ ...body, created_by: session?.user?.email ?? null });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error('[Admin/TvMonitor] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create page' },
      { status: 400 },
    );
  }
}
