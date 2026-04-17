/**
 * Stale-while-revalidate cache for the lightweight "availability" payload
 * (event id + capacity fields only), keyed by slug.
 *
 * Use cases:
 *   - /api/events?mode=availability: sub-100ms response using cached value,
 *     background refresh keeps it fresh to within `availabilityCacheTtl` seconds.
 *   - SSR overlay in app/[slug]/page.tsx and app/embed/[slug]/page.tsx: merge
 *     fresh capacity into precomputed full payload so first paint is accurate.
 *
 * Default TTL is 180s (3 min) per the "spotsLeft ideally fresh within 2-5 min"
 * product requirement. Per-slug override via `features.availabilityCacheTtl`.
 * Stale shadow key lives 2x TTL (default 360s / 6 min) as a safety net if Bond
 * is down; see `cachedSWR` in lib/cache.ts.
 *
 * This cache lives in Upstash KV server-side only. It does NOT write to any
 * browser storage (localStorage / sessionStorage / cookies) and therefore has
 * no marketing opt-out implications. See `persistFiltersInLocalStorage` for
 * the browser-storage flag that does have those implications.
 */

import { cachedSWR } from './cache';
import {
  getDiscoveryEvents,
  type AvailabilityDiscoveryEvent,
  type DiscoveryEventsPayload,
} from './discovery-events';
import { getConfigBySlug } from './config';

const DEFAULT_AVAIL_TTL_SECONDS = 180;

function availabilityCacheKey(slug: string): string {
  return `discovery:availability-swr:${slug}`;
}

async function resolveAvailabilityTtlSeconds(slug: string): Promise<number> {
  try {
    const config = await getConfigBySlug(slug);
    const raw = config?.features?.availabilityCacheTtl;
    if (typeof raw === 'number' && raw >= 0) {
      return raw;
    }
  } catch {
    // Config fetch failures fall through to default
  }
  return DEFAULT_AVAIL_TTL_SECONDS;
}

/**
 * Fetch availability payload for a slug using stale-while-revalidate.
 *
 * - Fresh cache hit: returns cached value in ~50ms. No Bond call.
 * - Stale cache hit (within 2x TTL): returns stale value immediately, kicks off
 *   a background refresh. Next caller gets fresh.
 * - Cold miss: synchronous fetch from Bond (4-10s first time only).
 *
 * When `ttlSeconds === 0`, the cache is skipped entirely — every call fetches
 * live from Bond. Use this per-slug via `features.availabilityCacheTtl = 0`
 * for rare "must-be-live" cases.
 */
export async function getAvailabilityPayload(
  slug: string,
): Promise<DiscoveryEventsPayload | null> {
  const ttlSeconds = await resolveAvailabilityTtlSeconds(slug);

  if (ttlSeconds === 0) {
    try {
      const result = await getDiscoveryEvents({ slug, mode: 'availability' });
      return result.payload;
    } catch (error) {
      console.error('[availability-cache] live fetch failed', { slug, error });
      return null;
    }
  }

  try {
    return await cachedSWR<DiscoveryEventsPayload>(
      availabilityCacheKey(slug),
      async () => {
        const result = await getDiscoveryEvents({ slug, mode: 'availability' });
        return result.payload;
      },
      { ttl: ttlSeconds },
    );
  } catch (error) {
    console.error('[availability-cache] SWR fetch failed', { slug, error });
    return null;
  }
}

/**
 * Return a `Map<eventId, availabilityFields>` for fast overlay merges onto
 * precomputed full event lists. Empty map on cache miss + Bond failure so
 * callers never crash — they just serve the precomputed (possibly stale)
 * capacity until Bond recovers.
 */
export async function getAvailabilityMap(
  slug: string,
): Promise<Map<string, AvailabilityDiscoveryEvent>> {
  const payload = await getAvailabilityPayload(slug);
  const map = new Map<string, AvailabilityDiscoveryEvent>();
  if (!payload?.data) return map;
  for (const item of payload.data as AvailabilityDiscoveryEvent[]) {
    map.set(String(item.id), item);
  }
  return map;
}

/**
 * Merge fresh availability fields onto a list of full events by id.
 * Safe against undefined values — only overwrites a field when the
 * availability value is defined (so if Bond doesn't know an event's
 * capacity right now, we don't wipe the precomputed number).
 */
export function mergeAvailabilityIntoEvents<T extends { id?: string | number }>(
  events: T[],
  availabilityById: Map<string, AvailabilityDiscoveryEvent>,
): T[] {
  if (availabilityById.size === 0) return events;
  return events.map((event) => {
    const a = availabilityById.get(String(event.id));
    if (!a) return event;
    return {
      ...event,
      ...(a.spotsRemaining !== undefined ? { spotsRemaining: a.spotsRemaining } : {}),
      ...(a.maxParticipants !== undefined ? { maxParticipants: a.maxParticipants } : {}),
      ...(a.currentParticipants !== undefined ? { currentParticipants: a.currentParticipants } : {}),
      ...(a.isWaitlistEnabled !== undefined ? { isWaitlistEnabled: a.isWaitlistEnabled } : {}),
      ...(a.waitlistCount !== undefined ? { waitlistCount: a.waitlistCount } : {}),
    };
  });
}
