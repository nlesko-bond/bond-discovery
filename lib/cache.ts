/**
 * Caching layer for Bond API responses
 * Uses Vercel KV in production, in-memory fallback for development
 */

// In-memory cache for development
const memoryCache = new Map<string, { data: any; expires: number }>();

const DEFAULT_TTL = 300; // 5 minutes
const STALE_GRACE_FACTOR = 2; // Serve stale data up to 2x TTL while revalidating

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

export type DiscoveryRefreshPolicy = '5min' | '15min' | '30min' | '60min';
const DISCOVERY_REFRESH_INTERVALS_MS: Record<DiscoveryRefreshPolicy, number> = {
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '60min': 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Lazy singleton for @vercel/kv -- avoids dynamic import on every call
// ---------------------------------------------------------------------------
import type { VercelKV } from '@vercel/kv';

let _kvInstance: VercelKV | null = null;
let _kvPromise: Promise<VercelKV> | null = null;

function getKV(): Promise<VercelKV> | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  if (_kvInstance) return Promise.resolve(_kvInstance);
  if (!_kvPromise) {
    _kvPromise = import('@vercel/kv').then((mod) => {
      _kvInstance = mod.kv;
      return _kvInstance;
    });
  }
  return _kvPromise;
}

// ---------------------------------------------------------------------------
// In-flight request coalescing -- prevents thundering-herd on cache miss
// ---------------------------------------------------------------------------
const inflight = new Map<string, Promise<any>>();

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const kvPromise = getKV();
  if (kvPromise) {
    try {
      const kv = await kvPromise;
      return await kv.get<T>(key);
    } catch (error) {
      console.error('KV get error:', error);
    }
  }

  // Fallback to memory cache
  const entry = memoryCache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  
  if (entry) {
    memoryCache.delete(key);
  }
  
  return null;
}

/**
 * Set a value in cache
 */
export async function cacheSet<T>(
  key: string, 
  value: T, 
  options: CacheOptions = {}
): Promise<void> {
  const ttl = options.ttl || DEFAULT_TTL;

  const kvPromise = getKV();
  if (kvPromise) {
    try {
      const kv = await kvPromise;
      await kv.set(key, value, { ex: ttl });
      return;
    } catch (error) {
      console.error('KV set error:', error);
    }
  }

  // Fallback to memory cache
  memoryCache.set(key, {
    data: value,
    expires: Date.now() + (ttl * 1000),
  });
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  const kvPromise = getKV();
  if (kvPromise) {
    try {
      const kv = await kvPromise;
      await kv.del(key);
      return;
    } catch (error) {
      console.error('KV delete error:', error);
    }
  }

  // Fallback to memory cache
  memoryCache.delete(key);
}

/**
 * Delete all cache entries matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const kvPromise = getKV();
  if (kvPromise) {
    try {
      const kv = await kvPromise;
      const keys = await kv.keys(pattern);
      if (keys.length > 0) {
        await kv.del(...keys);
      }
      return;
    } catch (error) {
      console.error('KV delete pattern error:', error);
    }
  }

  // Fallback to memory cache - delete matching keys
  const regex = new RegExp(pattern.replace('*', '.*'));
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export async function cacheClear(): Promise<void> {
  const kvPromise = getKV();
  if (kvPromise) {
    try {
      const kv = await kvPromise;
      await kv.flushall();
      return;
    } catch (error) {
      console.error('KV clear error:', error);
    }
  }

  // Fallback to memory cache
  memoryCache.clear();
}

/**
 * Generate a cache key for programs
 */
export function programsCacheKey(orgId: string, facilityId?: string, apiKey?: string): string {
  const keyScope = apiKey
    ? apiKey.split('').reduce((hash, ch) => ((hash * 31) + ch.charCodeAt(0)) >>> 0, 0).toString(16)
    : 'default';

  return facilityId
    ? `programs:${orgId}:${facilityId}:${keyScope}`
    : `programs:${orgId}:${keyScope}`;
}

/**
 * Generate a cache key for schedule
 */
export function scheduleCacheKey(orgId: string, startDate: string, endDate: string): string {
  return `schedule:${orgId}:${startDate}:${endDate}`;
}

/**
 * Generate a cache key for config
 */
export function configCacheKey(configId: string): string {
  return `config:${configId}`;
}

/**
 * Discovery events cache keys
 */
export function discoveryFullCacheKey(slug: string, scopeHash: string): string {
  return `discovery:full:${slug}:${scopeHash}`;
}

export function discoveryAvailabilityCacheKey(slug: string, scopeHash: string): string {
  return `discovery:availability:${slug}:${scopeHash}`;
}

export function discoveryLastRefreshedKey(slug: string): string {
  return `discovery:lastRefreshed:${slug}`;
}

/**
 * Discovery refresh policy helpers
 */
export async function shouldRefreshDiscovery(
  slug: string,
  policy: DiscoveryRefreshPolicy = '15min'
): Promise<boolean> {
  const key = discoveryLastRefreshedKey(slug);
  const lastRefreshed = await cacheGet<number>(key);
  if (!lastRefreshed) return true;
  const interval = DISCOVERY_REFRESH_INTERVALS_MS[policy] || DISCOVERY_REFRESH_INTERVALS_MS['15min'];
  return (Date.now() - lastRefreshed) >= interval;
}

export async function markDiscoveryRefreshed(slug: string): Promise<void> {
  await cacheSet(discoveryLastRefreshedKey(slug), Date.now(), { ttl: 48 * 60 * 60 });
}

/**
 * Membership cache keys
 */
export function membershipsCacheKey(slug: string): string {
  return `memberships:${slug}`;
}

export function membershipsLastGoodKey(slug: string): string {
  return `memberships:lastGood:${slug}`;
}

export function membershipsLastRefreshedKey(slug: string): string {
  return `memberships:lastRefreshed:${slug}`;
}

export async function shouldRefreshMemberships(
  slug: string,
  ttlSeconds: number = 900
): Promise<boolean> {
  const key = membershipsLastRefreshedKey(slug);
  const lastRefreshed = await cacheGet<number>(key);
  if (!lastRefreshed) return true;
  return (Date.now() - lastRefreshed) >= ttlSeconds * 1000;
}

export async function markMembershipsRefreshed(slug: string): Promise<void> {
  await cacheSet(membershipsLastRefreshedKey(slug), Date.now(), { ttl: 48 * 60 * 60 });
}

/**
 * Wrapper function to get or set cache with request coalescing.
 *
 * When multiple concurrent callers request the same key and all miss,
 * only one actual fetch runs -- the rest await the same promise.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cachedValue = await cacheGet<T>(key);
  if (cachedValue !== null) {
    return cachedValue;
  }

  // Coalesce concurrent fetches for the same key
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const freshValue = await fetcher();
      await cacheSet(key, freshValue, options);
      return freshValue;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Stale-while-revalidate wrapper.
 *
 * Tries the primary cache key first. If that misses, tries a stale
 * shadow key (`swr:{key}`) that lives 2x the TTL. If stale data exists,
 * it is returned immediately and a background refresh is kicked off.
 * This guarantees no user ever waits for the slow fallback pipeline.
 */
export async function cachedSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cachedValue = await cacheGet<T>(key);
  if (cachedValue !== null) {
    return cachedValue;
  }

  // Primary miss -- check the stale shadow key
  const staleKey = `swr:${key}`;
  const staleValue = await cacheGet<T>(staleKey);

  if (staleValue !== null) {
    // Serve stale immediately; refresh in the background (fire-and-forget)
    if (!inflight.has(key)) {
      const bgPromise = (async () => {
        try {
          const fresh = await fetcher();
          const ttl = options.ttl || DEFAULT_TTL;
          await cacheSet(key, fresh, options);
          await cacheSet(staleKey, fresh, { ttl: ttl * STALE_GRACE_FACTOR });
        } catch (err) {
          console.error(`[cachedSWR] background refresh failed for ${key}:`, err);
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, bgPromise);
    }
    return staleValue;
  }

  // Total miss (no stale data either) -- fetch synchronously with coalescing
  return cached(key, async () => {
    const fresh = await fetcher();
    const ttl = options.ttl || DEFAULT_TTL;
    // Also populate the stale shadow key for future SWR
    await cacheSet(staleKey, fresh, { ttl: ttl * STALE_GRACE_FACTOR });
    return fresh;
  }, options);
}
