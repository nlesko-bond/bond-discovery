import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiscoveryConfig } from '@/types';

/**
 * Plan 006: warmScopeGroupWithTimeout — the admin-route wrapper around the
 * cron's warm pipeline. Must resolve 'timeout' (not hang) when Bond is slow,
 * and must swallow pipeline errors so page create/update never fails because
 * a warm failed. warmScopeGroup itself is characterized end-to-end by
 * __tests__/api/warm-discovery.test.ts.
 */

const getDiscoveryEventsMock = vi.fn();
vi.mock('@/lib/discovery-events', () => ({
  getDiscoveryEvents: (...args: unknown[]) => getDiscoveryEventsMock(...args),
  filterEventsForResponse: (events: unknown[]) => events,
}));

const getProgramsMock = vi.fn();
vi.mock('@/lib/bond-client', () => ({
  createBondClient: () => ({ getPrograms: getProgramsMock }),
  DEFAULT_API_KEY: 'test-default-key',
}));

function makeConfig(slug: string): DiscoveryConfig {
  return {
    id: slug,
    name: slug,
    slug,
    organizationIds: ['100'],
    branding: { companyName: 'Test', primaryColor: '#000', secondaryColor: '#111' },
    features: { enableFilters: [], programFilterMode: 'all' },
    allowedParams: [],
    defaultParams: {},
    cacheTtl: 300,
    isActive: true,
  } as unknown as DiscoveryConfig;
}

async function load() {
  vi.resetModules();
  return import('@/lib/discovery-warm');
}

describe('warmScopeGroupWithTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    getProgramsMock.mockResolvedValue({ data: [] });
  });

  it('resolves "timeout" when the warm pipeline hangs', async () => {
    // Bond events fetch never resolves
    getDiscoveryEventsMock.mockReturnValue(new Promise(() => {}));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { warmScopeGroupWithTimeout } = await load();

    const result = await warmScopeGroupWithTimeout([makeConfig('slug-hang')], 50);

    expect(result).toBe('timeout');
    consoleError.mockRestore();
  });

  it('returns warm details when the pipeline completes in time', async () => {
    getDiscoveryEventsMock.mockResolvedValue({
      payload: {
        data: [{ id: '1', startDateUtc: '2026-07-01T10:00:00Z' }],
        meta: { totalEvents: 1 },
      },
    });
    const { warmScopeGroupWithTimeout } = await load();

    const result = await warmScopeGroupWithTimeout([makeConfig('slug-ok')], 5_000);

    expect(result).toEqual([
      expect.objectContaining({ slug: 'slug-ok', status: 'warmed', totalEvents: 1 }),
    ]);
  });
});
