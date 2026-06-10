import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Characterization tests for lib/cache.ts (plan 002).
 *
 * The KV env vars (KV_REST_API_URL / KV_REST_API_TOKEN) are unset in the test
 * environment, so the module-level in-memory fallback cache is exercised —
 * these tests run the real code paths without mocking @vercel/kv.
 *
 * Because the memory cache and inflight map are module-level state, each test
 * gets a fresh module instance via vi.resetModules() + dynamic import.
 */

type CacheModule = typeof import('@/lib/cache');

async function loadCache(): Promise<CacheModule> {
  vi.resetModules();
  return import('@/lib/cache');
}

/** A promise whose resolution is controlled by the test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('lib/cache (memory fallback)', () => {
  beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('cacheSet / cacheGet', () => {
    it('returns the value after set, and null after the TTL elapses', async () => {
      vi.useFakeTimers();
      const cache = await loadCache();

      await cache.cacheSet('k1', { hello: 'world' }, { ttl: 60 });
      expect(await cache.cacheGet('k1')).toEqual({ hello: 'world' });

      // Just before expiry: still present
      vi.advanceTimersByTime(59_000);
      expect(await cache.cacheGet('k1')).toEqual({ hello: 'world' });

      // After expiry: gone
      vi.advanceTimersByTime(2_000);
      expect(await cache.cacheGet('k1')).toBeNull();
    });
  });

  describe('cached()', () => {
    it('calls the fetcher once on miss and not at all on a subsequent hit', async () => {
      const cache = await loadCache();
      const fetcher = vi.fn().mockResolvedValue('value');

      const first = await cache.cached('k', fetcher, { ttl: 60 });
      expect(first).toBe('value');
      expect(fetcher).toHaveBeenCalledTimes(1);

      const second = await cache.cached('k', fetcher, { ttl: 60 });
      expect(second).toBe('value');
      expect(fetcher).toHaveBeenCalledTimes(1); // not called again
    });

    it('coalesces concurrent calls for the same key into one fetch', async () => {
      const cache = await loadCache();
      const gate = deferred<string>();
      const fetcher = vi.fn(() => gate.promise);

      const p1 = cache.cached('slow', fetcher);
      const p2 = cache.cached('slow', fetcher);

      // Let both callers reach the inflight map before resolving
      await Promise.resolve();
      gate.resolve('shared-result');

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe('shared-result');
      expect(r2).toBe('shared-result');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('cachedSWR()', () => {
    it('does not call the fetcher on a primary cache hit', async () => {
      const cache = await loadCache();
      await cache.cacheSet('swr-hit', 'fresh', { ttl: 60 });

      const fetcher = vi.fn().mockResolvedValue('should-not-be-used');
      const result = await cache.cachedSWR('swr-hit', fetcher, { ttl: 60 });

      expect(result).toBe('fresh');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('serves stale value immediately on primary miss and refreshes in the background', async () => {
      const cache = await loadCache();
      // Stale shadow key present, primary missing
      await cache.cacheSet('swr:k', 'stale-value', { ttl: 600 });

      const fetched = deferred<string>();
      let fetchStarted = false;
      const fetcher = vi.fn(async () => {
        fetchStarted = true;
        return fetched.promise;
      });

      const result = await cache.cachedSWR<string>('k', fetcher, { ttl: 60 });
      expect(result).toBe('stale-value'); // served immediately, no waiting
      expect(fetcher).toHaveBeenCalledTimes(1); // background refresh kicked off
      expect(fetchStarted).toBe(true);

      // Complete the background refresh and verify both keys updated
      fetched.resolve('fresh-value');
      await new Promise((r) => setTimeout(r, 0)); // flush microtasks + cacheSet
      expect(await cache.cacheGet('k')).toBe('fresh-value');
      expect(await cache.cacheGet('swr:k')).toBe('fresh-value');
    });

    it('fetches synchronously on total miss and populates primary + swr shadow keys', async () => {
      const cache = await loadCache();
      const fetcher = vi.fn().mockResolvedValue('cold-value');

      const result = await cache.cachedSWR('cold', fetcher, { ttl: 60 });

      expect(result).toBe('cold-value');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(await cache.cacheGet('cold')).toBe('cold-value');
      expect(await cache.cacheGet('swr:cold')).toBe('cold-value');
    });

    it('still serves the stale value when the background refresh fails (no throw)', async () => {
      const cache = await loadCache();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      await cache.cacheSet('swr:fail', 'stale-but-safe', { ttl: 600 });

      const fetcher = vi.fn().mockRejectedValue(new Error('bond is down'));
      const result = await cache.cachedSWR<string>('fail', fetcher, { ttl: 60 });

      expect(result).toBe('stale-but-safe');
      await new Promise((r) => setTimeout(r, 0)); // let the rejection settle
      // Stale shadow untouched, primary still empty, error logged not thrown
      expect(await cache.cacheGet('swr:fail')).toBe('stale-but-safe');
      expect(await cache.cacheGet('fail')).toBeNull();
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('shouldRefreshDiscovery() / markDiscoveryRefreshed()', () => {
    it('returns true with no marker, false right after marking, true after 5min policy elapses', async () => {
      vi.useFakeTimers();
      const cache = await loadCache();

      expect(await cache.shouldRefreshDiscovery('slug-a', '5min')).toBe(true);

      await cache.markDiscoveryRefreshed('slug-a');
      expect(await cache.shouldRefreshDiscovery('slug-a', '5min')).toBe(false);

      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(await cache.shouldRefreshDiscovery('slug-a', '5min')).toBe(true);
    });

    it('honors the 60min policy interval', async () => {
      vi.useFakeTimers();
      const cache = await loadCache();

      await cache.markDiscoveryRefreshed('slug-b');
      expect(await cache.shouldRefreshDiscovery('slug-b', '60min')).toBe(false);

      // 59 minutes: still fresh under the 60min policy
      vi.advanceTimersByTime(59 * 60 * 1000);
      expect(await cache.shouldRefreshDiscovery('slug-b', '60min')).toBe(false);

      // Past 60 minutes: needs refresh
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(await cache.shouldRefreshDiscovery('slug-b', '60min')).toBe(true);
    });
  });

  describe('cache deletion', () => {
    // Note: plan 002 referenced invalidateDiscoveryResponseCache(), which does
    // not exist in lib/cache.ts. These tests characterize the deletion
    // primitives that such an invalidation would be built on.
    it('cacheDelete removes a single key', async () => {
      const cache = await loadCache();
      await cache.cacheSet(cache.discoveryResponseCacheKey('slug-c'), { data: [1] }, { ttl: 60 });
      await cache.cacheDelete(cache.discoveryResponseCacheKey('slug-c'));
      expect(await cache.cacheGet(cache.discoveryResponseCacheKey('slug-c'))).toBeNull();
    });

    it('cacheDeletePattern removes both the response key and lastRefreshed key for a slug', async () => {
      const cache = await loadCache();
      await cache.cacheSet(cache.discoveryResponseCacheKey('slug-d'), { data: [1] }, { ttl: 60 });
      await cache.cacheSet(cache.discoveryLastRefreshedKey('slug-d'), Date.now(), { ttl: 60 });

      await cache.cacheDeletePattern('discovery:*:slug-d');

      expect(await cache.cacheGet(cache.discoveryResponseCacheKey('slug-d'))).toBeNull();
      expect(await cache.cacheGet(cache.discoveryLastRefreshedKey('slug-d'))).toBeNull();
    });
  });

  describe('key helpers', () => {
    it('discoveryResponseCacheKey includes bondEnv only for non-production', async () => {
      const cache = await loadCache();
      expect(cache.discoveryResponseCacheKey('x', 'staging')).toBe('discovery:response:staging:x');
      expect(cache.discoveryResponseCacheKey('x', 'production')).toBe('discovery:response:x');
      expect(cache.discoveryResponseCacheKey('x')).toBe('discovery:response:x');
    });
  });
});
