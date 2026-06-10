import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { DiscoveryConfig } from '@/types';

/**
 * Characterization tests for the warm-discovery cron route (plan 002).
 *
 * Bond API + config + discovery pipeline are mocked; the cache layer runs
 * for real on its in-memory fallback (KV env vars unset in tests), so the
 * empty-write guard / refresh-policy / last-run paths are exercised end to end.
 */

const getAllPageConfigsMock = vi.fn();
vi.mock('@/lib/config', () => ({
  getAllPageConfigs: (...args: unknown[]) => getAllPageConfigsMock(...args),
}));

const getDiscoveryEventsMock = vi.fn();
const filterEventsForResponseMock = vi.fn();
vi.mock('@/lib/discovery-events', () => ({
  getDiscoveryEvents: (...args: unknown[]) => getDiscoveryEventsMock(...args),
  filterEventsForResponse: (...args: unknown[]) => filterEventsForResponseMock(...args),
}));

const getProgramsMock = vi.fn();
vi.mock('@/lib/bond-client', () => ({
  createBondClient: () => ({ getPrograms: getProgramsMock }),
  DEFAULT_API_KEY: 'test-default-key',
  resetBondApiStats: vi.fn(),
  getBondApiStats: () => ({ requests: 1 }),
}));

function makeConfig(slug: string, overrides: Record<string, unknown> = {}): DiscoveryConfig {
  return {
    id: slug,
    name: slug,
    slug,
    organizationIds: ['100'],
    branding: { companyName: 'Test', primaryColor: '#000', secondaryColor: '#111' },
    features: {
      enableFilters: [],
      programFilterMode: 'all',
      ...(overrides.features as Record<string, unknown> | undefined),
    },
    allowedParams: [],
    defaultParams: {},
    cacheTtl: 300,
    isActive: true,
    ...overrides,
  } as unknown as DiscoveryConfig;
}

const FULL_EVENTS = [
  { id: '1', startDateUtc: '2026-07-01T10:00:00Z' },
  { id: '2', startDateUtc: '2026-07-02T10:00:00Z' },
];

function mockSuccessfulPipeline() {
  getProgramsMock.mockResolvedValue({ data: [] });
  getDiscoveryEventsMock.mockResolvedValue({
    payload: {
      data: FULL_EVENTS,
      meta: { totalEvents: FULL_EVENTS.length },
    },
  });
  // Default: filtering passes everything through
  filterEventsForResponseMock.mockImplementation((events: unknown[]) => events);
}

/**
 * Fresh module registry per test so the route shares one in-memory cache
 * instance with the test, and module-level cache state never leaks.
 */
async function load() {
  vi.resetModules();
  const cache = await import('@/lib/cache');
  const route = await import('@/app/api/cron/warm-discovery/route');
  return { cache, route };
}

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cron/warm-discovery', { headers });
}

describe('GET /api/cron/warm-discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.CRON_SECRET;
    mockSuccessfulPipeline();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('auth', () => {
    it('returns 401 when CRON_SECRET is set and no auth header is sent', async () => {
      vi.stubEnv('CRON_SECRET', 'super-secret');
      const { route } = await load();

      const res = await route.GET(makeRequest());
      expect(res.status).toBe(401);
      expect(getAllPageConfigsMock).not.toHaveBeenCalled();
    });

    it('returns 401 in production when CRON_SECRET is unset (fail closed)', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { route } = await load();

      const res = await route.GET(makeRequest());
      expect(res.status).toBe(401);
      expect(getAllPageConfigsMock).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        '[warm-discovery] CRON_SECRET not configured; refusing to run'
      );
      consoleError.mockRestore();
    });

    it('allows the request when the bearer token matches CRON_SECRET', async () => {
      vi.stubEnv('CRON_SECRET', 'super-secret');
      getAllPageConfigsMock.mockResolvedValue([]);
      const { route } = await load();

      const res = await route.GET(makeRequest({ authorization: 'Bearer super-secret' }));
      expect(res.status).toBe(200);
    });
  });

  describe('scope grouping', () => {
    it('fetches once per shared data scope; second slug reported as shared', async () => {
      const a = makeConfig('slug-a');
      const b = makeConfig('slug-b'); // identical orgIds/apiKey/filters => same scope
      getAllPageConfigsMock.mockResolvedValue([a, b]);
      const { route } = await load();

      const res = await route.GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(getDiscoveryEventsMock).toHaveBeenCalledTimes(1);
      expect(body.details).toHaveLength(2);
      const bySlug = Object.fromEntries(
        body.details.map((d: { slug: string; status: string }) => [d.slug, d.status])
      );
      expect(bySlug['slug-a']).toBe('warmed');
      expect(bySlug['slug-b']).toBe('shared');
      expect(body.warmed).toBe(2);
    });
  });

  describe('empty-write guard', () => {
    it('refuses to overwrite a non-empty cached response with an empty payload', async () => {
      const config = makeConfig('slug-guard');
      getAllPageConfigsMock.mockResolvedValue([config]);
      filterEventsForResponseMock.mockReturnValue([]); // pipeline yields zero events
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { cache, route } = await load();

      // Pre-seed a previous non-empty payload
      const previousPayload = { data: [{ id: 'old' }], meta: { totalFiltered: 5 } };
      await cache.cacheSet(cache.discoveryResponseCacheKey('slug-guard'), previousPayload, {
        ttl: 3600,
      });

      const res = await route.GET(makeRequest());
      const body = await res.json();

      expect(body.details).toEqual([
        expect.objectContaining({ slug: 'slug-guard', status: 'error' }),
      ]);
      // Previous payload preserved
      expect(await cache.cacheGet(cache.discoveryResponseCacheKey('slug-guard'))).toEqual(
        previousPayload
      );
      consoleError.mockRestore();
    });
  });

  describe('refresh policy', () => {
    it('skips a freshly refreshed config with a 60min policy', async () => {
      const config = makeConfig('slug-fresh', {
        features: { enableFilters: [], programFilterMode: 'all', discoveryRefreshPolicy: '60min' },
      });
      getAllPageConfigsMock.mockResolvedValue([config]);
      const { cache, route } = await load();

      await cache.markDiscoveryRefreshed('slug-fresh');

      const res = await route.GET(makeRequest());
      const body = await res.json();

      expect(body.skipped).toBe(1);
      expect(body.details).toHaveLength(0);
      expect(getDiscoveryEventsMock).not.toHaveBeenCalled();
    });
  });

  describe('last-run record', () => {
    it('writes discovery:cron:lastRun on a successful run', async () => {
      getAllPageConfigsMock.mockResolvedValue([makeConfig('slug-run')]);
      const { cache, route } = await load();

      const res = await route.GET(makeRequest());
      expect(res.status).toBe(200);

      const lastRun = await cache.cacheGet<{
        at: string;
        warmed: number;
        errors: string[];
        skipped: number;
        bondApi: unknown;
        elapsedMs: number;
      }>('discovery:cron:lastRun');

      expect(lastRun).not.toBeNull();
      expect(lastRun!.warmed).toBe(1);
      expect(lastRun!.errors).toEqual([]);
      expect(lastRun!.skipped).toBe(0);
      expect(typeof lastRun!.at).toBe('string');
      expect(lastRun!.bondApi).toEqual({ requests: 1 });
    });
  });
});
