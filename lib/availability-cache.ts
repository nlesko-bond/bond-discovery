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
 * The stale shadow key lives 30 min (AVAILABILITY_STALE_TTL_SECONDS): SSR
 * peeks at it so first paint always has recent-ish capacity without waiting
 * on Bond; the client-side `mode=availability` refresh corrects it to live
 * values right after load. See `cachedSWR` / `cachedSWRPeek` in lib/cache.ts.
 *
 * This cache lives in Upstash KV server-side only. It does NOT write to any
 * browser storage (localStorage / sessionStorage / cookies) and therefore has
 * no marketing opt-out implications. See `persistFiltersInLocalStorage` for
 * the browser-storage flag that does have those implications.
 */

import { cachedSWR, cachedSWRPeek } from './cache';
import {
  getDiscoveryEvents,
  type AvailabilityDiscoveryEvent,
  type DiscoveryEventsPayload,
} from './discovery-events';
import { getConfigBySlug } from './config';
import { DEFAULT_BOND_ENV, type BondEnv } from './bond-env';

const DEFAULT_AVAIL_TTL_SECONDS = 180;

/**
 * Stale shadow lifetime. Deliberately much longer than the freshness TTL:
 * stale capacity is only ever *painted* (SSR peek / SWR serve-stale) and is
 * corrected by the client's `mode=availability` refresh moments later, so a
 * wide window here buys instant first paint on quiet pages without changing
 * how fresh the data users end up seeing.
 */
const AVAILABILITY_STALE_TTL_SECONDS = 30 * 60;

function availabilityCacheKey(slug: string, bondEnv: BondEnv): string {
  return `discovery:availability-swr:${bondEnv}:${slug}`;
}

async function resolveAvailabilitySettings(slug: string): Promise<{ ttlSeconds: number; bondEnv: BondEnv }> {
  try {
    const config = await getConfigBySlug(slug);
    const raw = config?.features?.availabilityCacheTtl;
    if (typeof raw === 'number' && raw >= 0) {
      return { ttlSeconds: raw, bondEnv: config?.features?.bondEnv || DEFAULT_BOND_ENV };
    }
    return { ttlSeconds: DEFAULT_AVAIL_TTL_SECONDS, bondEnv: config?.features?.bondEnv || DEFAULT_BOND_ENV };
  } catch {
    // Config fetch failures fall through to default
  }
  return { ttlSeconds: DEFAULT_AVAIL_TTL_SECONDS, bondEnv: DEFAULT_BOND_ENV };
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
  const { ttlSeconds, bondEnv } = await resolveAvailabilitySettings(slug);

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
      availabilityCacheKey(slug, bondEnv),
      async () => {
        const result = await getDiscoveryEvents({ slug, mode: 'availability' });
        return result.payload;
      },
      { ttl: ttlSeconds, staleTtl: AVAILABILITY_STALE_TTL_SECONDS },
    );
  } catch (error) {
    console.error('[availability-cache] SWR fetch failed', { slug, error });
    return null;
  }
}

/**
 * Cached-only variant for SSR: returns whatever availability is in KV (fresh
 * or stale, up to AVAILABILITY_STALE_TTL_SECONDS old) and NEVER fetches from
 * Bond. A cold miss returns an empty map, meaning the page renders with the
 * precomputed payload's capacity numbers and the client-side
 * `mode=availability` refresh overlays live values right after load.
 *
 * This exists because the synchronous cold fetch is a full Bond catalog crawl
 * (tens of seconds for large orgs) — it must never run inside a page render.
 */
export async function getCachedAvailabilityMap(
  slug: string,
): Promise<Map<string, AvailabilityDiscoveryEvent>> {
  const map = new Map<string, AvailabilityDiscoveryEvent>();
  try {
    const { ttlSeconds, bondEnv } = await resolveAvailabilitySettings(slug);
    // ttl 0 means "never cache" — there is nothing to peek at by design.
    if (ttlSeconds === 0) return map;

    const payload = await cachedSWRPeek<DiscoveryEventsPayload>(
      availabilityCacheKey(slug, bondEnv),
    );
    if (!payload?.data) return map;
    for (const item of payload.data as AvailabilityDiscoveryEvent[]) {
      map.set(String(item.id), item);
    }
  } catch (error) {
    console.error('[availability-cache] cached-only read failed', { slug, error });
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
