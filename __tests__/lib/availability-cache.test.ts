import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the SSR-safe availability read path.
 *
 * The invariant under test: `getCachedAvailabilityMap` must NEVER call the
 * Bond pipeline (`getDiscoveryEvents`). A cold availability miss during a
 * page render used to trigger a synchronous full-catalog Bond crawl (tens of
 * seconds); SSR now only peeks at KV and lets the client-side
 * `mode=availability` refresh supply live capacity.
 *
 * KV env vars are unset in tests, so the in-memory cache in lib/cache.ts is
 * exercised; module state is reset per test via vi.resetModules().
 */

const getDiscoveryEventsMock = vi.fn();
const getConfigBySlugMock = vi.fn();

vi.mock('@/lib/discovery-events', () => ({
  getDiscoveryEvents: (...args: unknown[]) => getDiscoveryEventsMock(...args),
}));

vi.mock('@/lib/config', () => ({
  getConfigBySlug: (...args: unknown[]) => getConfigBySlugMock(...args),
}));

async function loadModules() {
  vi.resetModules();
  const cache = await import('@/lib/cache');
  const availability = await import('@/lib/availability-cache');
  return { cache, availability };
}

function configWith(features: Record<string, unknown> = {}) {
  return { slug: 'test-slug', features };
}

describe('lib/availability-cache', () => {
  beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    getDiscoveryEventsMock.mockReset();
    getConfigBySlugMock.mockReset();
    getConfigBySlugMock.mockResolvedValue(configWith());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCachedAvailabilityMap()', () => {
    it('returns an empty map on a cold miss WITHOUT calling the Bond pipeline', async () => {
      const { availability } = await loadModules();

      const map = await availability.getCachedAvailabilityMap('test-slug');

      expect(map.size).toBe(0);
      expect(getDiscoveryEventsMock).not.toHaveBeenCalled();
    });

    it('returns cached availability keyed by event id on a hit', async () => {
      const { cache, availability } = await loadModules();
      await cache.cacheSet(
        'discovery:availability-swr:production:test-slug',
        { data: [{ id: 42, spotsRemaining: 3 }] },
        { ttl: 180 },
      );

      const map = await availability.getCachedAvailabilityMap('test-slug');

      expect(map.get('42')).toEqual({ id: 42, spotsRemaining: 3 });
      expect(getDiscoveryEventsMock).not.toHaveBeenCalled();
    });

    it('reads the stale shadow key when the primary has expired', async () => {
      const { cache, availability } = await loadModules();
      await cache.cacheSet(
        'swr:discovery:availability-swr:production:test-slug',
        { data: [{ id: 7, spotsRemaining: 0 }] },
        { ttl: 1800 },
      );

      const map = await availability.getCachedAvailabilityMap('test-slug');

      expect(map.get('7')).toEqual({ id: 7, spotsRemaining: 0 });
      expect(getDiscoveryEventsMock).not.toHaveBeenCalled();
    });

    it('returns an empty map for must-be-live pages (availabilityCacheTtl 0) without fetching', async () => {
      getConfigBySlugMock.mockResolvedValue(configWith({ availabilityCacheTtl: 0 }));
      const { availability } = await loadModules();

      const map = await availability.getCachedAvailabilityMap('test-slug');

      expect(map.size).toBe(0);
      expect(getDiscoveryEventsMock).not.toHaveBeenCalled();
    });

    it('uses the bondEnv-segmented cache key for non-production pages', async () => {
      getConfigBySlugMock.mockResolvedValue(configWith({ bondEnv: 'staging' }));
      const { cache, availability } = await loadModules();
      await cache.cacheSet(
        'discovery:availability-swr:staging:test-slug',
        { data: [{ id: 1, spotsRemaining: 9 }] },
        { ttl: 180 },
      );

      const map = await availability.getCachedAvailabilityMap('test-slug');

      expect(map.get('1')).toEqual({ id: 1, spotsRemaining: 9 });
    });
  });

  describe('getAvailabilityPayload()', () => {
    it('still fetches synchronously on a cold miss (API-route behavior unchanged)', async () => {
      const { availability } = await loadModules();
      getDiscoveryEventsMock.mockResolvedValue({
        payload: { data: [{ id: 1, spotsRemaining: 5 }] },
      });

      const payload = await availability.getAvailabilityPayload('test-slug');

      expect(payload?.data).toEqual([{ id: 1, spotsRemaining: 5 }]);
      expect(getDiscoveryEventsMock).toHaveBeenCalledTimes(1);
    });

    it('leaves a 30-minute stale shadow readable by getCachedAvailabilityMap', async () => {
      vi.useFakeTimers();
      const { availability } = await loadModules();
      getDiscoveryEventsMock.mockResolvedValue({
        payload: { data: [{ id: 1, spotsRemaining: 5 }] },
      });

      await availability.getAvailabilityPayload('test-slug');
      getDiscoveryEventsMock.mockClear();

      // Past the 180s freshness TTL and its old 2x grace window (360s),
      // but within the 30-minute stale window.
      vi.advanceTimersByTime(10 * 60 * 1000);
      const map = await availability.getCachedAvailabilityMap('test-slug');

      expect(map.get('1')).toEqual({ id: 1, spotsRemaining: 5 });
      expect(getDiscoveryEventsMock).not.toHaveBeenCalled();
    });
  });

  describe('mergeAvailabilityIntoEvents()', () => {
    it('overlays only defined capacity fields', async () => {
      const { availability } = await loadModules();
      const merged = availability.mergeAvailabilityIntoEvents(
        [{ id: '1', spotsRemaining: 10, waitlistCount: 2 } as any],
        new Map([['1', { id: '1', spotsRemaining: 4 } as any]]),
      );
      expect(merged[0]).toEqual({ id: '1', spotsRemaining: 4, waitlistCount: 2 });
    });
  });
});
