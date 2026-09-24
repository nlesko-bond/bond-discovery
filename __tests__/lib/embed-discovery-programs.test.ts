import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiscoveryConfig } from '@/types';

const getPrograms = vi.fn();
const getAllPrograms = vi.fn();
const cacheKeys: string[] = [];

vi.mock('@/lib/bond-client', () => ({
  createBondClient: () => ({ getPrograms, getAllPrograms }),
  resolveBondApiKey: (key?: string) => key || 'test-key',
}));
vi.mock('@/lib/cache', () => ({
  programsCacheKey: (orgId: string) => `programs:${orgId}:scope`,
  cachedSWR: async (key: string, fn: () => Promise<unknown>) => {
    cacheKeys.push(key);
    return fn();
  },
}));

import { fetchProgramsForDiscoveryPage } from '@/lib/embed-discovery-programs';

const rawProgram = (id: string, type: string, sessions: Array<{ id: string; endDate: string }>) => ({
  id,
  name: `Program ${id}`,
  type,
  sessions: sessions.map((s) => ({ ...s, name: `Session ${s.id}`, startDate: '2026-01-01' })),
});

function config(features: Partial<DiscoveryConfig['features']> = {}): DiscoveryConfig {
  return {
    slug: 'the-yard',
    apiKey: 'k',
    organizationIds: ['604'],
    facilityIds: [],
    features: { enableFilters: [], ...features },
  } as unknown as DiscoveryConfig;
}

describe('fetchProgramsForDiscoveryPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-23T15:00:00Z'), toFake: ['Date'] });
    cacheKeys.length = 0;
    getPrograms.mockReset().mockResolvedValue({
      data: [
        rawProgram('15087', 'LEAGUE', [{ id: '122775', endDate: '2026-10-15' }]),
        rawProgram('15202', 'CLASS', [{ id: '123725', endDate: '2026-12-31' }]),
      ],
    });
    getAllPrograms.mockReset().mockResolvedValue({
      data: [
        rawProgram('15087', 'LEAGUE', [
          { id: '122762', endDate: '2026-08-20' },
          { id: '122775', endDate: '2026-10-15' },
        ]),
      ],
    });
  });
  afterEach(() => vi.useRealTimers());

  it('makes no extra Bond call and returns every type by default', async () => {
    const programs = await fetchProgramsForDiscoveryPage(config());
    expect(getAllPrograms).not.toHaveBeenCalled();
    expect(cacheKeys).toEqual(['programs:604:scope']);
    expect(programs.map((p) => p.id)).toEqual(['15087', '15202']);
  });

  it('scopes to program types after the shared cache', async () => {
    const programs = await fetchProgramsForDiscoveryPage(config({ programTypeScope: ['league'] }));
    expect(getAllPrograms).not.toHaveBeenCalled();
    expect(programs.map((p) => p.id)).toEqual(['15087']);
  });

  it('ignores completedSeasonDays without the league layout', async () => {
    await fetchProgramsForDiscoveryPage(config({ completedSeasonDays: 30 }));
    expect(getAllPrograms).not.toHaveBeenCalled();
  });

  it('merges recently completed seasons for league-layout pages', async () => {
    const programs = await fetchProgramsForDiscoveryPage(
      config({ programCardLayout: 'league', completedSeasonDays: 45, programTypeScope: ['league'] }),
    );
    expect(getAllPrograms).toHaveBeenCalledWith('604', expect.objectContaining({
      includePast: true,
      programTypes: ['league'],
    }));
    expect(cacheKeys).toContain('programs:604:scope:past:league');
    expect(programs[0].sessions!.map((s) => s.id)).toEqual(['122775', '122762']);
  });

  it('keeps the live list when the completed-season fetch fails', async () => {
    getAllPrograms.mockRejectedValue(new Error('429'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const programs = await fetchProgramsForDiscoveryPage(
      config({ programCardLayout: 'league', completedSeasonDays: 45 }),
    );
    expect(programs.map((p) => p.id)).toEqual(['15087', '15202']);
    errorSpy.mockRestore();
  });
});
