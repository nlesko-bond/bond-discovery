import { describe, expect, it } from 'vitest';
import type { DiscoveryFilters, Program } from '@/types';
import {
  applyFacetSelection,
  buildActiveFilterChips,
  computeFacetCounts,
  countActiveSecondaryFilters,
  countFilteredSessions,
  getFacetSelection,
  removeFilterChip,
  toggleSelection,
} from '@/components/host-shell/v2/ui/filter-core';

const baseFilters: DiscoveryFilters = {
  search: '',
  programIds: [],
  sessionIds: [],
  facilityIds: [],
  programTypes: [],
  sports: [],
  dateRange: {},
  ageRange: {},
  gender: 'all',
  availability: 'all',
  membershipRequired: null,
};

function makePrograms(): Program[] {
  return [
    {
      id: 'prog-1',
      name: 'Soccer Stars',
      sport: 'soccer',
      type: 'class',
      sessions: [
        {
          id: 's1',
          programId: 'prog-1',
          sport: 'soccer',
          gender: 'male',
          minAge: 6,
          maxAge: 8,
          facility: { id: 10, name: 'North Arena' },
        },
        {
          id: 's2',
          programId: 'prog-1',
          sport: 'soccer',
          gender: 'female',
          minAge: 9,
          maxAge: 12,
          facility: { id: 20, name: 'South Arena' },
        },
      ],
    },
    {
      id: 'prog-2',
      name: 'Hockey Heroes',
      sport: 'hockey',
      type: 'camp',
      sessions: [
        {
          id: 's3',
          programId: 'prog-2',
          sport: 'hockey',
          gender: 'male',
          minAge: 6,
          maxAge: 8,
          facility: { id: 10, name: 'North Arena' },
        },
      ],
    },
  ] as unknown as Program[];
}

const chipContext = {
  facilityNames: new Map([
    ['10', 'North Arena'],
    ['20', 'South Arena'],
  ]),
  programTypeLabel: (id: string) => `Label:${id}`,
};

describe('toggleSelection', () => {
  it('adds an absent id and removes a present one, immutably', () => {
    const initial = ['a'];
    const added = toggleSelection(initial, 'b');
    expect(added).toEqual(['a', 'b']);
    const removed = toggleSelection(added, 'a');
    expect(removed).toEqual(['b']);
    expect(initial).toEqual(['a']);
  });
});

describe('applyFacetSelection', () => {
  it('clears legacy single-value gender when setting multi genders', () => {
    const next = applyFacetSelection(
      { ...baseFilters, gender: 'male' },
      'genders',
      ['female'],
    );
    expect(next.genders).toEqual(['female']);
    expect(next.gender).toBe('all');
  });

  it('clears legacy ageRange when setting age buckets and normalizes empty to undefined', () => {
    const withBucket = applyFacetSelection(
      { ...baseFilters, ageRange: { min: 4, max: 9 } },
      'ageBucketIds',
      ['6-8'],
    );
    expect(withBucket.ageBucketIds).toEqual(['6-8']);
    expect(withBucket.ageRange).toEqual({});
    const cleared = applyFacetSelection(withBucket, 'ageBucketIds', []);
    expect(cleared.ageBucketIds).toBeUndefined();
  });
});

describe('getFacetSelection', () => {
  it('returns the array when present and [] otherwise', () => {
    expect(getFacetSelection({ ...baseFilters, facilityIds: ['10'] }, 'facilityIds')).toEqual([
      '10',
    ]);
    expect(getFacetSelection(baseFilters, 'genders')).toEqual([]);
  });
});

describe('countFilteredSessions / computeFacetCounts', () => {
  it('counts one result per surviving session', () => {
    expect(countFilteredSessions(makePrograms(), baseFilters)).toBe(3);
    expect(
      countFilteredSessions(makePrograms(), { ...baseFilters, facilityIds: ['20'] }),
    ).toBe(1);
  });

  it('computes faceted counts: each option vs. the OTHER active filters', () => {
    // Active: hockey only. Facility counts should reflect the hockey narrowing,
    // not the dimension's own (absent) selection.
    const filters = { ...baseFilters, sports: ['hockey'] };
    const counts = computeFacetCounts(makePrograms(), filters, 'facilityIds', ['10', '20']);
    expect(counts).toEqual({ '10': 1, '20': 0 });
  });

  it('ignores the dimension own current selection when counting its options', () => {
    // Facility 20 selected; counts for facility options must answer "what if I
    // picked this one instead", so facility 10 still shows its 2 sessions.
    const filters = { ...baseFilters, facilityIds: ['20'] };
    const counts = computeFacetCounts(makePrograms(), filters, 'facilityIds', ['10', '20']);
    expect(counts).toEqual({ '10': 2, '20': 1 });
  });
});

describe('countActiveSecondaryFilters', () => {
  it('sums facet selections and counts an active date range once', () => {
    expect(countActiveSecondaryFilters(baseFilters)).toBe(0);
    expect(
      countActiveSecondaryFilters({
        ...baseFilters,
        ageBucketIds: ['6-8', '9-12'],
        genders: ['male'],
        dateRange: { start: '2026-06-01' },
      }),
    ).toBe(4);
  });

  it('does not count search or sports (they live outside the sheet)', () => {
    expect(
      countActiveSecondaryFilters({ ...baseFilters, search: 'soccer', sports: ['soccer'] }),
    ).toBe(0);
  });
});

describe('buildActiveFilterChips / removeFilterChip', () => {
  it('builds labeled chips for search, facets and the date range', () => {
    const filters: DiscoveryFilters = {
      ...baseFilters,
      search: 'goal',
      ageBucketIds: ['6-8'],
      genders: ['female'],
      facilityIds: ['10'],
      programTypes: ['camp'] as DiscoveryFilters['programTypes'],
      dateRange: { start: '2026-06-01', end: '2026-06-30' },
    };
    const chips = buildActiveFilterChips(filters, chipContext);
    expect(chips.map((chip) => chip.label)).toEqual([
      '“goal”',
      'Ages 6–8',
      'Girls',
      'North Arena',
      'Label:camp',
      'Jun 1 – Jun 30',
    ]);
  });

  it('labels open-ended date ranges with From / Until', () => {
    expect(
      buildActiveFilterChips(
        { ...baseFilters, dateRange: { start: '2026-06-01' } },
        chipContext,
      )[0].label,
    ).toBe('From Jun 1');
    expect(
      buildActiveFilterChips(
        { ...baseFilters, dateRange: { end: '2026-06-30' } },
        chipContext,
      )[0].label,
    ).toBe('Until Jun 30');
  });

  it('excludes sports (hero chips) and returns no chips for empty filters', () => {
    expect(buildActiveFilterChips({ ...baseFilters, sports: ['soccer'] }, chipContext)).toEqual(
      [],
    );
  });

  it('removeFilterChip removes exactly the chip it targets', () => {
    const filters: DiscoveryFilters = {
      ...baseFilters,
      search: 'goal',
      ageBucketIds: ['6-8', '9-12'],
      dateRange: { start: '2026-06-01' },
    };
    const chips = buildActiveFilterChips(filters, chipContext);

    const withoutSearch = removeFilterChip(filters, chips[0]);
    expect(withoutSearch.search).toBe('');
    expect(withoutSearch.ageBucketIds).toEqual(['6-8', '9-12']);

    const ageChip = chips.find((chip) => chip.key === 'age:6-8')!;
    const withoutAge = removeFilterChip(filters, ageChip);
    expect(withoutAge.ageBucketIds).toEqual(['9-12']);

    const dateChip = chips.find((chip) => chip.key === 'dateRange')!;
    const withoutDates = removeFilterChip(filters, dateChip);
    expect(withoutDates.dateRange).toEqual({});
  });
});
