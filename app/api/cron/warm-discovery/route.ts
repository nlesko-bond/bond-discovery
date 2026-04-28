import { NextRequest, NextResponse } from 'next/server';
import { getAllPageConfigs } from '@/lib/config';
import {
  shouldRefreshDiscovery,
  markDiscoveryRefreshed,
  programsCacheKey,
  cacheGet,
  cacheSet,
  type DiscoveryRefreshPolicy,
} from '@/lib/cache';
import {
  getDiscoveryEvents,
  filterEventsForResponse,
  type FullDiscoveryEvent,
  type DiscoveryEventsResult,
} from '@/lib/discovery-events';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import type { DiscoveryConfig } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Compute a deterministic key representing the data-fetching scope of a
 * config.  Configs that share the same scope hit the exact same Bond API
 * endpoints, so we only need to fetch once per scope.
 */
function computeDataScope(config: DiscoveryConfig): string {
  const orgIds = config.organizationIds.slice().sort().join(',');
  const apiKey = config.apiKey || DEFAULT_API_KEY;
  const filterMode = config.features?.programFilterMode || 'all';
  const excluded = (config.excludedProgramIds || []).slice().sort().join(',');
  const included = (config.includedProgramIds || []).slice().sort().join(',');
  return `${orgIds}|${apiKey}|${filterMode}|${excluded}|${included}`;
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const configs = await getAllPageConfigs();
    const activeConfigs = configs.filter(
      (config) =>
        config.isActive !== false &&
        config.features.discoveryCacheEnabled !== false
    );

    const toWarm: DiscoveryConfig[] = [];
    const skipped: string[] = [];

    for (const config of activeConfigs) {
      const policy = (config.features.discoveryRefreshPolicy || '15min') as DiscoveryRefreshPolicy;
      const needsRefresh = await shouldRefreshDiscovery(config.slug, policy);
      if (needsRefresh) {
        toWarm.push(config);
      } else {
        skipped.push(config.slug);
      }
    }

    // Group configs by data scope so we fetch from Bond API only once per
    // unique org+filter combination. This prevents rate-limiting when
    // multiple slugs (e.g. pbsz / pbsz-copy) share the same orgs.
    const scopeGroups = new Map<string, DiscoveryConfig[]>();
    for (const config of toWarm) {
      const scope = computeDataScope(config);
      const group = scopeGroups.get(scope) || [];
      group.push(config);
      scopeGroups.set(scope, group);
    }

    const details: Array<{
      slug: string;
      status: 'warmed' | 'error' | 'shared';
      totalEvents?: number;
      durationMs: number;
    }> = [];

    // Process one scope group at a time to avoid cross-scope rate-limiting
    for (const [, configs] of scopeGroups) {
      const primary = configs[0];
      const groupStart = Date.now();

      try {
        // Warm programs cache (shared across all slugs in this scope)
        const apiKey = primary.apiKey || DEFAULT_API_KEY;
        const client = createBondClient(apiKey);
        const programsTtl = Math.max(primary.cacheTtl || 0, 4 * 60 * 60);
        await Promise.all(
          primary.organizationIds.map(async (orgId: string) => {
            try {
              const key = programsCacheKey(orgId, undefined, apiKey);
              const response = await client.getPrograms(orgId);
              await cacheSet(key, response, { ttl: programsTtl });
            } catch (err) {
              console.error(`[warm-discovery] Failed to warm programs for org ${orgId}:`, err);
            }
          })
        );

        // Fetch full events ONCE for this scope
        const full: DiscoveryEventsResult = await getDiscoveryEvents({
          slug: primary.slug,
          mode: 'full',
          forceFresh: true,
        });

        // Availability is no longer written to KV (always fetched fresh from Bond per request).

        // Write discovery:response for EVERY slug that shares this scope
        const today = new Date().toISOString().split('T')[0];
        for (const config of configs) {
          try {
            const horizonMonths = config.features?.eventHorizonMonths ?? 3;
            const filtered = filterEventsForResponse(
              full.payload.data as FullDiscoveryEvent[],
              horizonMonths,
              today,
            );
            const precomputed = {
              ...full.payload,
              data: filtered,
              meta: {
                ...full.payload.meta,
                totalFiltered: filtered.length,
                precomputedAt: new Date().toISOString(),
              },
            };

            const previous = await cacheGet<{ meta?: { totalFiltered?: number } }>(
              `discovery:response:${config.slug}`,
            );
            const previousCount = previous?.meta?.totalFiltered ?? 0;
            if (filtered.length === 0 && previousCount > 0) {
              console.error('[warm-discovery] refusing empty write; keeping previous payload', {
                slug: config.slug,
                previousCount,
              });
              details.push({
                slug: config.slug,
                status: 'error',
                durationMs: Date.now() - groupStart,
              });
              continue;
            }

            await cacheSet(`discovery:response:${config.slug}`, precomputed, { ttl: 4 * 60 * 60 });
            await markDiscoveryRefreshed(config.slug);

            const isPrimary = config.slug === primary.slug;
            details.push({
              slug: config.slug,
              status: isPrimary ? 'warmed' : 'shared',
              totalEvents: full.payload.meta.totalEvents,
              durationMs: Date.now() - groupStart,
            });

            if (!isPrimary) {
              console.log(
                `[warm-discovery] ${config.slug} shared data from ${primary.slug} (${full.payload.meta.totalEvents} events)`
              );
            }
          } catch (writeErr) {
            console.error(`[warm-discovery] Failed to write response for ${config.slug}:`, writeErr);
            details.push({
              slug: config.slug,
              status: 'error',
              durationMs: Date.now() - groupStart,
            });
          }
        }
      } catch (error) {
        console.error(`[warm-discovery] Failed to warm scope (primary: ${primary.slug}):`, error);
        for (const config of configs) {
          details.push({
            slug: config.slug,
            status: 'error',
            durationMs: Date.now() - groupStart,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalActive: activeConfigs.length,
      warmed: details.filter((d) => d.status === 'warmed' || d.status === 'shared').length,
      skipped: skipped.length,
      elapsedMs: Date.now() - start,
      details,
    });
  } catch (error) {
    console.error('[warm-discovery] Cron error:', error);
    return NextResponse.json(
      {
        error: 'Failed to warm discovery cache',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
