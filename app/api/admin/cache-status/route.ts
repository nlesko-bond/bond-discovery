import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { cacheGet, discoveryLastRefreshedKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * Read-only cache freshness for the admin page editor (Data & Caching
 * section): the global warm-cron last-run record (plan 002) plus the
 * page's own discovery:lastRefreshed timestamp. Returns nulls (not an
 * error) when KV is unconfigured so the UI can render "unknown".
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  try {
    const [cronLastRun, lastRefreshed] = await Promise.all([
      cacheGet<Record<string, unknown>>('discovery:cron:lastRun'),
      cacheGet<number>(discoveryLastRefreshedKey(slug)),
    ]);
    return NextResponse.json(
      { cronLastRun: cronLastRun ?? null, lastRefreshed: lastRefreshed ?? null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[cache-status] failed to read cache status:', error);
    return NextResponse.json({ cronLastRun: null, lastRefreshed: null });
  }
}
