import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getConfigBySlug } from '@/lib/config';
import { warmScopeGroupWithTimeout } from '@/lib/discovery-warm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin-only "Refresh now": warms the discovery caches for one slug on
 * demand (plan 008 Step 4). Uses the same bounded warm pipeline as
 * page create/update (plan 006); on timeout the next cron run retries.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  try {
    const config = await getConfigBySlug(slug);
    if (!config) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const result = await warmScopeGroupWithTimeout([config]);
    if (result === 'timeout') {
      return NextResponse.json({ result: 'timeout' }, { status: 202 });
    }
    return NextResponse.json({ result: 'warmed', details: result });
  } catch (error) {
    console.error('[admin-warm] failed to warm slug:', slug, error);
    return NextResponse.json({ error: 'Failed to warm discovery cache' }, { status: 500 });
  }
}
