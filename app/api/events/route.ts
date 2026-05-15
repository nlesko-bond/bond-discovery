import { NextResponse } from 'next/server';
import {
  getDiscoveryEvents,
  filterEventsForResponse,
  type DiscoveryEventsMode,
  type FullDiscoveryEvent,
} from '@/lib/discovery-events';
import { cacheGet, discoveryResponseCacheKey } from '@/lib/cache';
import { getConfigBySlug } from '@/lib/config';
import { getAvailabilityPayload } from '@/lib/availability-cache';
import { maybeAlertZeroDiscoveryEvents } from '@/lib/discovery-zero-events-alert';
import { getBondApiStats } from '@/lib/bond-client';
import {
  embedKitCorsHeaders,
  isEmbedKitBrowserRequestAllowed,
  type IEmbedKitCorsHeaderOptions,
} from '@/lib/embed-cors';
import type { DiscoveryConfig } from '@/types';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const config = slug ? await getConfigBySlug(slug) : null;
  return new NextResponse(null, {
    status: 204,
    headers: embedKitCorsHeaders(request, config),
  });
}

function mergeEmbedCors(
  request: Request,
  config: DiscoveryConfig | null,
  headers?: HeadersInit,
  embedCorsOptions?: IEmbedKitCorsHeaderOptions,
): Record<string, string> {
  const base = embedKitCorsHeaders(request, config, embedCorsOptions);
  if (!headers) {
    return base;
  }
  const out: Record<string, string> = { ...base };
  if (headers instanceof Headers) {
    headers.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      out[k] = v;
    }
    return out;
  }
  return { ...base, ...headers };
}

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
  const embedCorsConfig: DiscoveryConfig | null = slug
    ? await getConfigBySlug(slug)
    : null;

  if (
    slug &&
    embedCorsConfig &&
    !isEmbedKitBrowserRequestAllowed(request, embedCorsConfig)
  ) {
    return NextResponse.json(
      { error: 'Forbidden' },
      {
        status: 403,
        headers: mergeEmbedCors(request, embedCorsConfig, undefined, {
          reflectRequestOriginForErrorResponse: true,
        }),
      },
    );
  }

  const requestedMode = searchParams.get('mode');
  const mode: DiscoveryEventsMode = requestedMode === 'availability' ? 'availability' : 'full';
  const forceFresh =
    searchParams.get('forceFresh') === 'true' ||
    searchParams.get('forceFresh') === '1' ||
    searchParams.get('refresh') === 'true';

  // ── Fast path: availability SWR cache ──
  // Sub-100ms responses; background refresh keeps data <=TTL seconds stale
  // (default 180s, configurable per-slug via `features.availabilityCacheTtl`).
  // This path replaces what used to hit Bond directly on every client overlay
  // request and took 4-10s due to rate limiting.
  if (slug && mode === 'availability' && !forceFresh) {
    try {
      const payload = await getAvailabilityPayload(slug);
      if (payload) {
        return NextResponse.json(payload, {
          headers: mergeEmbedCors(request, embedCorsConfig, {
            'Cache-Control': 'private, no-store',
            'X-Bond-Events-Cache': 'SWR',
            'X-Bond-Events-Mode': 'availability',
          }),
        });
      }
    } catch (err) {
      console.error('Availability SWR path failed; falling back to live fetch:', err);
    }
  }

  // ── Fast path: pre-computed response from cron ──
  // Pages with `discoveryCacheEnabled === false` skip this so full + availability
  // both hit Bond (KV bypass in getDiscoveryEvents); cron does not warm those slugs.
  if (slug && mode === 'full' && !forceFresh) {
    try {
      const pageConfig = await getConfigBySlug(slug);
      const allowPrecomputed = pageConfig?.features?.discoveryCacheEnabled !== false;
      if (allowPrecomputed) {
        const precomputed = await cacheGet<any>(
          discoveryResponseCacheKey(slug, pageConfig?.features?.bondEnv)
        );
        if (precomputed && Array.isArray(precomputed.data) && precomputed.data.length > 0) {
          return NextResponse.json(precomputed, {
            headers: mergeEmbedCors(request, embedCorsConfig, {
              'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
              'X-Bond-Events-Cache': 'PRECOMPUTED',
              'X-Bond-Events-Mode': 'full',
            }),
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
    const bondStatsBefore = getBondApiStats();
    const result = await getDiscoveryEvents({
      slug: searchParams.get('slug') || undefined,
      apiKey: searchParams.get('apiKey') || undefined,
      orgIds: searchParams.get('orgIds')
        ? searchParams.get('orgIds')!.split(/[_,]/).filter(Boolean)
        : undefined,
      facilityId: searchParams.get('facilityId') || undefined,
      includePast: searchParams.get('includePast') === 'true',
      mode,
      forceFresh,
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
    const bondStatsAfter = getBondApiStats();
    const serverErrors = Math.max(
      0,
      bondStatsAfter.serverErrors - bondStatsBefore.serverErrors
    );

    if (
      mode === 'full' &&
      totalFiltered === 0 &&
      serverErrors > 0 &&
      result.context.slug !== 'adhoc'
    ) {
      await maybeAlertZeroDiscoveryEvents({
        slug: result.context.slug,
        bondEnv: result.context.bondEnv,
        mode,
        cacheStatus: result.cacheStatus,
        cacheKey: result.cacheKey,
        organizations: result.context.orgIds.length,
        serverErrors,
      });
    }

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
        headers: mergeEmbedCors(request, embedCorsConfig, {
          'Cache-Control':
            forceFresh || mode === 'availability'
              ? 'private, no-store'
              : 's-maxage=60, stale-while-revalidate=120',
          'X-Bond-Events-Cache': forceFresh ? 'BYPASS' : result.cacheStatus,
          'X-Bond-Events-Mode': mode,
          'X-Bond-Events-Bond-Env': result.context.bondEnv,
          'X-Bond-Events-Bond-5xxs': String(serverErrors),
          'X-Bond-Events-Cache-Key': result.cacheKey,
        }),
      },
    );
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500, headers: mergeEmbedCors(request, embedCorsConfig) },
    );
  }
}
