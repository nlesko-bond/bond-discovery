import { describe, it, expect } from 'vitest';
import {
  buildPortalFilterOptions,
  extendPortalFilterOptionsWithFacilityEvents,
} from '@/lib/host-shell/portal-filter-options';

const BASE = buildPortalFilterOptions([]);

describe('extendPortalFilterOptionsWithFacilityEvents', () => {
  it('returns options unchanged (same reference) with no facility events', () => {
    expect(extendPortalFilterOptionsWithFacilityEvents(BASE, [])).toBe(BASE);
  });

  it('adds a rental type option and facility sports', () => {
    const extended = extendPortalFilterOptionsWithFacilityEvents(BASE, [
      { sport: 'hockey', type: 'rental' },
      { sport: 'hockey', type: 'rental' },
      { type: 'rental' },
    ]);
    expect(extended.programTypes).toEqual([{ id: 'rental', label: 'rental', count: 3 }]);
    expect(extended.sports).toEqual([{ id: 'hockey', label: 'hockey', count: 2 }]);
  });

  it('merges counts into existing sport options without duplicating', () => {
    const withProgramSport = {
      ...BASE,
      sports: [{ id: 'hockey', label: 'hockey', count: 5 }],
      programTypes: [{ id: 'rental', label: 'rental', count: 1 }],
    };
    const extended = extendPortalFilterOptionsWithFacilityEvents(withProgramSport, [
      { sport: 'hockey', type: 'rental' },
    ]);
    expect(extended.sports).toEqual([{ id: 'hockey', label: 'hockey', count: 6 }]);
    // Existing rental option is kept as-is, not duplicated
    expect(extended.programTypes).toEqual([{ id: 'rental', label: 'rental', count: 1 }]);
  });

  it('does not mutate the input options', () => {
    const input = { ...BASE, sports: [{ id: 'soccer', label: 'soccer', count: 1 }] };
    extendPortalFilterOptionsWithFacilityEvents(input, [{ sport: 'soccer', type: 'rental' }]);
    expect(input.sports).toEqual([{ id: 'soccer', label: 'soccer', count: 1 }]);
  });
});
