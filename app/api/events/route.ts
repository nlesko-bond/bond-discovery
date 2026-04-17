import { NextResponse } from 'next/server';
import {
  getDiscoveryEvents,
  filterEventsForResponse,
  type DiscoveryEventsMode,
  type FullDiscoveryEvent,
} from '@/lib/discovery-events';
import { cacheGet } from '@/lib/cache';
import { getConfigBySlug } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events
 *
 * Fast path: reads the pre-computed response that the cron writes to
 * `discovery:response:<slug>` every ~15 min. This skips the config fetch
 * and heavy processing entirely.
 *
 * Fallback: if the pre-computed key is missing (cron hasn't run yet,
 * new slug, etc.), falls back to the full pipeline and then self-heals
 * the precomputed cache so subsequent requests are fast.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const requestedMode = searchParams.get('mode');
  const mode: DiscoveryEventsMode = requestedMode === 'availability' ? 'availability' : 'full';

  // ── Fast path: pre-computed response from cron ──
  // Pages with `discoveryCacheEnabled === false` skip this so full + availability
  // both hit Bond (KV bypass in getDiscoveryEvents); cron does not warm those slugs.
  if (slug && mode === 'full') {
    try {
      const pageConfig = await getConfigBySlug(slug);
      const allowPrecomputed = pageConfig?.features?.discoveryCacheEnabled !== false;
      if (allowPrecomputed) {
        const precomputed = await cacheGet<any>(`discovery:response:${slug}`);
        if (precomputed && Array.isArray(precomputed.data) && precomputed.data.length > 0) {
          return NextResponse.json(precomputed, {
            headers: {
              'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
              'X-Bond-Events-Cache': 'PRECOMPUTED',
              'X-Bond-Events-Mode': 'full',
            },
          });
        }
      }
    } catch (err) {
      // Pre-computed miss — fall through to full pipeline
    }
  }

  // ── Fallback: full pipeline (slower but always works) ──
  const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
  const explicitEndDate = searchParams.get('endDate') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

  try {
    const result = await getDiscoveryEvents({
      slug: searchParams.get('slug') || undefined,
      apiKey: searchParams.get('apiKey') || undefined,
      orgIds: searchParams.get('orgIds')
        ? searchParams.get('orgIds')!.split(/[_,]/).filter(Boolean)
        : undefined,
      facilityId: searchParams.get('facilityId') || undefined,
      includePast: searchParams.get('includePast') === 'true',
      mode,
    });

    let data = result.payload.data;

    if (mode === 'full') {
      const horizonMonths = result.context?.config?.features?.eventHorizonMonths ?? 3;
      data = filterEventsForResponse(
        data as FullDiscoveryEvent[],
        horizonMonths,
        startDate,
        explicitEndDate,
      );
    }

    const totalFiltered = data.length;

    // discovery:response:{slug} is populated ONLY by the cron job, which
    // fetches with careful rate management and produces complete datasets.
    // Write-through from the API fallback is intentionally disabled because
    // fresh pipeline runs can return partial data (Bond API rate-limiting)
    // and that partial data would poison the response cache for hours.

    if (limit) {
      data = data.slice(offset, offset + limit);
    }

    return NextResponse.json(
      { ...result.payload, data, meta: { ...result.payload.meta, totalFiltered } },
      {
        headers: {
                   'Cache-Control':
            mode === 'availability'
              ? 'private, no-store'
              : 's-maxage=60, stale-while-revalidate=120',
          'X-Bond-Events-Cache': result.cacheStatus,
          'X-Bond-Events-Mode': mode,
          'X-Bond-Events-Cache-Key': result.cacheKey,
        },
      }
    );
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
