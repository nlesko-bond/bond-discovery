import {
  programsCacheKey,
  discoveryResponseCacheKey,
  cacheGet,
  cacheSet,
  markDiscoveryRefreshed,
} from '@/lib/cache';
import {
  getDiscoveryEvents,
  filterEventsForResponse,
  type FullDiscoveryEvent,
  type DiscoveryEventsResult,
} from '@/lib/discovery-events';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import type { DiscoveryConfig } from '@/types';

export interface WarmDetail {
  slug: string;
  status: 'warmed' | 'error' | 'shared';
  totalEvents?: number;
  durationMs: number;
}

/**
 * Warms the discovery caches for a group of configs that share the same
 * data-fetching scope (orgs + apiKey + bondEnv + program filters).
 *
 * The first config in the group is the "primary": the Bond API is hit once
 * for the whole group (programs caches + full events), then a per-slug
 * filtered `discovery:response` payload is written for every config.
 *
 * Invariant: the empty-write guard lives here. A warm that yields zero
 * filtered events must NEVER overwrite a previously non-empty payload —
 * partial rate-limited Bond fetches would otherwise poison live pages for
 * hours. Any future "freshen faster" work must preserve this.
 */
export async function warmScopeGroup(configs: DiscoveryConfig[]): Promise<WarmDetail[]> {
  const details: WarmDetail[] = [];
  if (configs.length === 0) {
    return details;
  }

  const primary = configs[0];
  const groupStart = Date.now();

  try {
    // Warm programs cache (shared across all slugs in this scope)
    const apiKey = primary.apiKey || DEFAULT_API_KEY;
    const client = createBondClient(apiKey, primary.features.bondEnv);
    const programsTtl = Math.max(primary.cacheTtl || 0, 4 * 60 * 60);
    await Promise.all(
      primary.organizationIds.map(async (orgId: string) => {
        try {
          const key = programsCacheKey(orgId, undefined, apiKey, primary.features.bondEnv);
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
          discoveryResponseCacheKey(config.slug, config.features.bondEnv),
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

        await cacheSet(
          discoveryResponseCacheKey(config.slug, config.features.bondEnv),
          precomputed,
          { ttl: 4 * 60 * 60 }
        );
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

  return details;
}

/**
 * Awaits warmScopeGroup with a hard timeout, for use in admin mutation
 * routes (page create/update). Awaiting (rather than fire-and-forget)
 * matters on Vercel: a detached promise can be killed when the lambda
 * tears down after the response is sent. The timeout keeps admin UX
 * bounded when Bond is slow; on timeout the warm is abandoned and the
 * next cron run picks the slug up.
 */
export async function warmScopeGroupWithTimeout(
  configs: DiscoveryConfig[],
  timeoutMs = 20_000,
): Promise<WarmDetail[] | 'timeout'> {
  try {
    const result = await Promise.race([
      warmScopeGroup(configs),
      new Promise<'timeout'>((resolve) => {
        const timer = setTimeout(() => resolve('timeout'), timeoutMs);
        // Don't keep the process alive just for the timer (Node runtime).
        if (typeof timer === 'object' && 'unref' in timer) {
          timer.unref();
        }
      }),
    ]);
    if (result === 'timeout') {
      console.error('[discovery-warm] warm timed out; cron will retry', {
        slugs: configs.map((c) => c.slug),
        timeoutMs,
      });
    }
    return result;
  } catch (error) {
    console.error('[discovery-warm] warm failed', {
      slugs: configs.map((c) => c.slug),
      error,
    });
    return [];
  }
}
