import { describe, expect, it } from 'vitest';
import {
  filterProgramsByPageConfig,
  filterProgramsWithActiveSessions,
  getDiscoveryExcludedProgramIds,
  getDiscoveryIncludedProgramIds,
  sessionEndDateOnOrAfterToday,
  shouldSkipProgramByPageConfig,
} from '@/lib/discovery-program-scope';
import type { DiscoveryConfig, Program } from '@/types';

type ConfigOverrides = Omit<Partial<DiscoveryConfig>, 'features'> & {
  features?: Partial<DiscoveryConfig['features']>;
};

function minimalConfig(overrides: ConfigOverrides = {}): DiscoveryConfig {
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
