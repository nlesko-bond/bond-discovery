import { describe, expect, it } from 'vitest';
import {
  filterProgramsByPageConfig,
  filterProgramsWithActiveSessions,
  filterDiscoveryEventsByPageConfig,
  filterDiscoveryEventsByProgramTypeScope,
  getProgramTypeScope,
  getDiscoveryExcludedProgramIds,
  getDiscoveryIncludedProgramIds,
  sessionEndDateOnOrAfterToday,
  shouldSkipProgramByPageConfig,
} from '@/lib/discovery-program-scope';
import type { DiscoveryConfig, Program } from '@/types';

type MinimalConfigOverrides = Omit<Partial<DiscoveryConfig>, 'features'> & {
  features?: Partial<DiscoveryConfig['features']>;
};

function minimalConfig(overrides: MinimalConfigOverrides = {}): DiscoveryConfig {
  return {
    id: '1',
    name: 'Test',
    slug: 'test',
    organizationIds: ['1'],
    branding: {
      companyName: 'Test',
      primaryColor: '#000',
      secondaryColor: '#111',
      accentColor: '#222',
    },
    features: {
      enableFilters: [],
      programFilterMode: 'all',
      ...overrides.features,
    },
    ...overrides,
  } as DiscoveryConfig;
}

function program(id: string, sessions?: Program['sessions']): Program {
  return {
    id,
    name: `Program ${id}`,
    sessions,
  } as Program;
}

describe('sessionEndDateOnOrAfterToday', () => {
  it('treats ISO datetimes by calendar day', () => {
    expect(sessionEndDateOnOrAfterToday('2026-05-20T23:59:59Z', '2026-05-21')).toBe(false);
    expect(sessionEndDateOnOrAfterToday('2026-05-21T00:00:00Z', '2026-05-21')).toBe(true);
  });

  it('keeps sessions without endDate', () => {
    expect(sessionEndDateOnOrAfterToday(undefined, '2026-05-21')).toBe(true);
  });
});

describe('filterProgramsWithActiveSessions', () => {
  it('removes programs whose sessions all ended before today', () => {
    const programs = [
      program('1', [{ id: 's1', name: 'Old', endDate: '2020-01-01' } as Program['sessions'] extends (infer S)[] ? S : never]),
      program('2', [{ id: 's2', name: 'Active', endDate: '2099-01-01' } as Program['sessions'] extends (infer S)[] ? S : never]),
    ];
    const result = filterProgramsWithActiveSessions(programs, '2026-05-21');
    expect(result.map((p) => p.id)).toEqual(['2']);
  });
});

describe('filterProgramsByPageConfig', () => {
  it('includes only listed program ids with numeric/string match', () => {
    const config = minimalConfig({
      features: { enableFilters: [], programFilterMode: 'include', includedProgramIds: ['42'] },
      includedProgramIds: ['42'],
    });
    const programs = [program('42'), program('99')];
    expect(filterProgramsByPageConfig(programs, config).map((p) => p.id)).toEqual(['42']);
  });

  it('reads included ids from features when root is empty', () => {
    const config = minimalConfig({
      includedProgramIds: [],
      features: {
        enableFilters: [],
        programFilterMode: 'include',
        includedProgramIds: ['7'],
      },
    });
    expect(getDiscoveryIncludedProgramIds(config)).toEqual(['7']);
    expect(filterProgramsByPageConfig([program('7'), program('8')], config)).toHaveLength(1);
  });

  it('excludes listed program ids with string-safe matching', () => {
    const config = minimalConfig({
      features: {
        enableFilters: [],
        programFilterMode: 'exclude',
        excludedProgramIds: ['14945', '14849'],
      },
    });
    const programs = [program('14945'), program('999')];
    expect(filterProgramsByPageConfig(programs, config).map((p) => p.id)).toEqual(['999']);
  });

  it('reads excluded ids from features when root is empty', () => {
    const config = minimalConfig({
      features: {
        enableFilters: [],
        programFilterMode: 'exclude',
        excludedProgramIds: ['14951'],
      },
    });
    expect(getDiscoveryExcludedProgramIds(config)).toEqual(['14951']);
    expect(shouldSkipProgramByPageConfig('14951', config)).toBe(true);
    expect(shouldSkipProgramByPageConfig('100', config)).toBe(false);
  });
});

describe('filterDiscoveryEventsByPageConfig', () => {
  it('removes events for excluded program ids from stale precomputed payloads', () => {
    const config = minimalConfig({
      features: {
        enableFilters: [],
        programFilterMode: 'exclude',
        excludedProgramIds: ['14945', '14849', '14951'],
      },
    });
    const events = [
      { id: 'e1', programId: '14945' },
      { id: 'e2', programId: 14849 },
      { id: 'e3', programId: '999' },
    ];
    expect(filterDiscoveryEventsByPageConfig(events, config).map((e) => e.id)).toEqual(['e3']);
  });
});

describe('program type scope', () => {
  const typed = (id: string, type: string) => ({ ...program(id), type }) as Program;

  it('is a no-op (same array) when no scope is set', () => {
    const config = minimalConfig();
    const programs = [typed('1', 'league'), typed('2', 'class')];
    expect(filterProgramsByPageConfig(programs, config)).toBe(programs);
    const events = [{ id: 'e1', programId: '1', type: 'class' }];
    expect(filterDiscoveryEventsByPageConfig(events, config)).toBe(events);
    expect(filterDiscoveryEventsByProgramTypeScope(events, config)).toBe(events);
  });

  it('treats an empty scope like no scope', () => {
    const config = minimalConfig({ features: { enableFilters: [], programTypeScope: [] } });
    expect(getProgramTypeScope(config)).toEqual([]);
    const programs = [typed('1', 'league')];
    expect(filterProgramsByPageConfig(programs, config)).toBe(programs);
  });

  it('keeps only programs of the scoped types', () => {
    const config = minimalConfig({
      features: { enableFilters: [], programTypeScope: ['league', 'tournament'] },
    });
    const programs = [typed('1', 'league'), typed('2', 'class'), typed('3', 'tournament'), program('4')];
    expect(filterProgramsByPageConfig(programs, config).map((p) => p.id)).toEqual(['1', '3']);
  });

  it('combines with program ID exclusion', () => {
    const config = minimalConfig({
      features: {
        enableFilters: [],
        programFilterMode: 'exclude',
        excludedProgramIds: ['1'],
        programTypeScope: ['league'],
      },
    });
    const programs = [typed('1', 'league'), typed('2', 'league'), typed('3', 'class')];
    expect(filterProgramsByPageConfig(programs, config).map((p) => p.id)).toEqual(['2']);
  });

  it('filters events by programType, falling back to type', () => {
    const config = minimalConfig({ features: { enableFilters: [], programTypeScope: ['league'] } });
    const events = [
      { id: 'e1', programId: '1', programType: 'league' },
      { id: 'e2', programId: '2', type: 'league' },
      { id: 'e3', programId: '3', type: 'class' },
      { id: 'e4', programId: '4', type: 'drop_in' },
    ];
    expect(filterDiscoveryEventsByPageConfig(events, config).map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});
