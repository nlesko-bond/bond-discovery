import { describe, expect, it } from 'vitest';
import type { DiscoveryFilters, Program } from '@/types';
import { filterProgramsForPortalSessions } from '@/lib/host-shell/portal-session-filters';

/**
 * Plan 009 filter audit fixes: availability and dateRange must narrow to the
 * matching sessions, not keep whole programs (which left full / out-of-range
 * session cards visible after filtering).
 */

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
      name: 'Soccer',
      sessions: [
        { id: 'open', programId: 'prog-1', isFull: false, spotsRemaining: 20 },
        { id: 'full', programId: 'prog-1', isFull: true, spotsRemaining: 0 },
        { id: 'almost', programId: 'prog-1', isFull: false, spotsRemaining: 2 },
      ],
    },
    {
      id: 'prog-2',
      name: 'Hockey',
      sessions: [{ id: 'all-full', programId: 'prog-2', isFull: true, spotsRemaining: 0 }],
    },
  ] as unknown as Program[];
}

describe('availability filter narrows sessions', () => {
  it('drops full sessions (and fully-booked programs) for available mode', () => {
    const result = filterProgramsForPortalSessions(makePrograms(), {
      ...baseFilters,
      availabilityModes: ['available'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('prog-1');
    expect((result[0].sessions as { id: string }[]).map((s) => s.id)).toEqual([
      'open',
      'almost',
    ]);
  });

  it('keeps only low-spot sessions for almost_full mode', () => {
    const result = filterProgramsForPortalSessions(makePrograms(), {
      ...baseFilters,
      availabilityModes: ['almost_full'],
    });
    expect(result).toHaveLength(1);
    expect((result[0].sessions as { id: string }[]).map((s) => s.id)).toEqual(['almost']);
  });

  it('applies the legacy single-select availability the same way', () => {
    const result = filterProgramsForPortalSessions(makePrograms(), {
      ...baseFilters,
      availability: 'available',
    });
    expect(result).toHaveLength(1);
    expect((result[0].sessions as { id: string }[]).map((s) => s.id)).toEqual([
      'open',
      'almost',
    ]);
  });

  it('does not mutate the input programs', () => {
    const programs = makePrograms();
    filterProgramsForPortalSessions(programs, {
      ...baseFilters,
      availabilityModes: ['available'],
    });
    expect((programs[0].sessions as unknown[]).length).toBe(3);
  });
});

describe('dateRange filter narrows sessions', () => {
  const programs = [
    {
      id: 'prog-1',
      name: 'Soccer',
      sessions: [
        {
          id: 'spring',
          programId: 'prog-1',
          startDate: '2026-03-01',
          endDate: '2026-05-30',
        },
        {
          id: 'fall',
          programId: 'prog-1',
          startDate: '2026-09-01',
          endDate: '2026-11-30',
        },
      ],
    },
    {
      id: 'prog-no-sessions',
      name: 'Placeholder',
      sessions: [],
    },
  ] as unknown as Program[];

  it('keeps only sessions overlapping the selected range', () => {
    const result = filterProgramsForPortalSessions(programs, {
      ...baseFilters,
      dateRange: { start: '2026-08-01', end: '2026-12-31' },
    });
    const withSessions = result.find((program) => program.id === 'prog-1');
    expect(withSessions).toBeDefined();
    expect((withSessions!.sessions as { id: string }[]).map((s) => s.id)).toEqual([
      'fall',
    ]);
  });

  it('drops programs whose sessions are all out of range', () => {
    const result = filterProgramsForPortalSessions(programs, {
      ...baseFilters,
      dateRange: { start: '2027-01-01' },
    });
    expect(result.find((program) => program.id === 'prog-1')).toBeUndefined();
  });

  it('keeps session-less programs (no date evidence either way)', () => {
    const result = filterProgramsForPortalSessions(programs, {
      ...baseFilters,
      dateRange: { start: '2026-08-01' },
    });
    expect(result.find((program) => program.id === 'prog-no-sessions')).toBeDefined();
  });
});
