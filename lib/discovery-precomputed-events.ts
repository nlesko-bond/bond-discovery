import { cacheGet, discoveryResponseCacheKey } from '@/lib/cache';
import { filterDiscoveryEventsByPageConfig } from '@/lib/discovery-program-scope';
import { getCachedAvailabilityMap, mergeAvailabilityIntoEvents } from '@/lib/availability-cache';
import type { DiscoveryConfig } from '@/types';

interface IPrecomputedDiscoveryPayload {
  data?: unknown[];
  meta?: {
    totalFiltered?: number;
  };
}

/**
 * Reads cron precomputed schedule events from KV and applies current page program filters.
 */
export async function getPrecomputedDiscoveryEvents(
  slug: string,
  config: DiscoveryConfig,
): Promise<{
  events: unknown[];
  total: number;
} | null> {
  if (config.features.discoveryCacheEnabled === false) {
    return null;
  }

  try {
    const precomputed = await cacheGet<IPrecomputedDiscoveryPayload>(
      discoveryResponseCacheKey(slug, config.features.bondEnv),
    );
    if (!precomputed?.data || !Array.isArray(precomputed.data) || precomputed.data.length === 0) {
      return null;
    }

    let events = filterDiscoveryEventsByPageConfig(
      precomputed.data as Array<{ programId?: unknown; id?: string | number }>,
      config,
    );

    try {
      // Cached-only on purpose: a cold availability miss must not block SSR
      // on the full Bond crawl. The client's mode=availability refresh
      // overlays live capacity right after first paint.
      const availabilityById = await getCachedAvailabilityMap(slug);
      if (availabilityById.size > 0) {
        events = mergeAvailabilityIntoEvents(events, availabilityById);
      }
    } catch (err) {
      console.error('[precomputed-events] availability overlay failed', { slug, err });
    }

    return {
      events,
      total: events.length,
    };
  } catch {
    return null;
  }
}
