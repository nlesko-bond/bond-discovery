import { describe, expect, it } from 'vitest';
import type { Program } from '@/types';
import {
  DEFAULT_PROGRAM_TYPE_ORDER,
  resolveProgramSortMode,
  resolveProgramStartDateMs,
  resolveProgramTypeOrder,
  sortProgramsForDisplay,
} from '@/lib/program-sort';

const NOW = new Date('2026-09-11T12:00:00Z');

function program(
  id: string,
  name: string,
  overrides: Partial<Program> = {},
): Program {
  return { id, name, ...overrides };
}

const names = (programs: Program[]) => programs.map((p) => p.name);

// Bond order for these fixtures is alphabetical, like the live API.
const BOND_ORDER: Program[] = [
  program('1', 'Adult Drop In', {
    type: 'drop_in',
    sessions: [{ id: 's1', programId: '1', startDate: '2026-10-01', endDate: '2026-12-01' }],
  }),
  program('2', 'School Days Off Camps', {
    type: 'camp',
    sessions: [
      // Already ended — must not count as the program's start.
      { id: 's2a', programId: '2', startDate: '2026-01-05', endDate: '2026-01-06' },
      { id: 's2b', programId: '2', startDate: '2026-11-20', endDate: '2026-11-21' },
    ],
  }),
  program('3', 'Youth Basketball Classes', {
    type: 'class',
    sessions: [{ id: 's3', programId: '3', startDate: '2026-09-15', endDate: '2026-11-15' }],
  }),
  program('4', 'Youth Basketball Leagues', {
    type: 'league',
    sessions: [{ id: 's4', programId: '4' }], // no dates
  }),
  program('5', 'i-Brain Sessions', {
    // no type
    sessions: [{ id: 's5', programId: '5', startDate: '2026-09-09', endDate: '2026-10-29' }],
  }),
];

describe('resolveProgramSortMode', () => {
  it('accepts every known mode and falls back to default otherwise', () => {
    expect(resolveProgramSortMode('name_desc')).toBe('name_desc');
    expect(resolveProgramSortMode('program_type')).toBe('program_type');
    expect(resolveProgramSortMode(undefined)).toBe('default');
    expect(resolveProgramSortMode('bogus')).toBe('default');
  });
});

describe('resolveProgramTypeOrder', () => {
  it('returns the default order when nothing is configured', () => {
    expect(resolveProgramTypeOrder(undefined)).toEqual(DEFAULT_PROGRAM_TYPE_ORDER);
  });

  it('keeps the configured prefix, drops unknowns and duplicates, appends the rest', () => {
    const order = resolveProgramTypeOrder(['league', 'nonsense', 'camp', 'league']);
    expect(order.slice(0, 2)).toEqual(['league', 'camp']);
    expect(order).toHaveLength(DEFAULT_PROGRAM_TYPE_ORDER.length);
    expect(new Set(order).size).toBe(DEFAULT_PROGRAM_TYPE_ORDER.length);
  });
});

describe('resolveProgramStartDateMs', () => {
  it('uses the earliest session that has not ended', () => {
    const ms = resolveProgramStartDateMs(BOND_ORDER[1], NOW);
    expect(ms).toBe(new Date('2026-11-20').getTime());
  });

  it('falls back to the earliest session of any date when all have ended', () => {
    const past = program('p', 'Past', {
      sessions: [
        { id: 'a', programId: 'p', startDate: '2025-03-01', endDate: '2025-04-01' },
        { id: 'b', programId: 'p', startDate: '2025-01-01', endDate: '2025-02-01' },
      ],
    });
    expect(resolveProgramStartDateMs(past, NOW)).toBe(new Date('2025-01-01').getTime());
  });

  it('is undefined without any session start dates', () => {
    expect(resolveProgramStartDateMs(BOND_ORDER[3], NOW)).toBeUndefined();
    expect(resolveProgramStartDateMs(program('x', 'Empty'), NOW)).toBeUndefined();
  });
});

describe('sortProgramsForDisplay', () => {
  it('returns the same array untouched for default / unset', () => {
    expect(sortProgramsForDisplay(BOND_ORDER, {}, NOW)).toBe(BOND_ORDER);
    expect(sortProgramsForDisplay(BOND_ORDER, { programSort: 'default' }, NOW)).toBe(BOND_ORDER);
  });

  it('never mutates the input', () => {
    const copy = [...BOND_ORDER];
    sortProgramsForDisplay(BOND_ORDER, { programSort: 'name_desc' }, NOW);
    expect(BOND_ORDER).toEqual(copy);
  });

  it('sorts by name case-insensitively in both directions', () => {
    expect(names(sortProgramsForDisplay(BOND_ORDER, { programSort: 'name_asc' }, NOW))).toEqual([
      'Adult Drop In',
      'i-Brain Sessions',
      'School Days Off Camps',
      'Youth Basketball Classes',
      'Youth Basketball Leagues',
    ]);
    expect(names(sortProgramsForDisplay(BOND_ORDER, { programSort: 'name_desc' }, NOW))).toEqual([
      'Youth Basketball Leagues',
      'Youth Basketball Classes',
      'School Days Off Camps',
      'i-Brain Sessions',
      'Adult Drop In',
    ]);
  });

  it('sorts by start date ascending with undated programs last', () => {
    expect(
      names(sortProgramsForDisplay(BOND_ORDER, { programSort: 'start_date_asc' }, NOW)),
    ).toEqual([
      'i-Brain Sessions', // Sep 9
      'Youth Basketball Classes', // Sep 15
      'Adult Drop In', // Oct 1
      'School Days Off Camps', // Nov 20 (Jan session ended)
      'Youth Basketball Leagues', // no dates
    ]);
  });

  it('sorts by start date descending, still keeping undated programs last', () => {
    expect(
      names(sortProgramsForDisplay(BOND_ORDER, { programSort: 'start_date_desc' }, NOW)),
    ).toEqual([
      'School Days Off Camps',
      'Adult Drop In',
      'Youth Basketball Classes',
      'i-Brain Sessions',
      'Youth Basketball Leagues',
    ]);
  });

  it('groups by configured program type order, untyped last, Bond order within a type', () => {
    const withSecondClass = [
      ...BOND_ORDER,
      program('6', 'Aardvark Class', { type: 'class' }), // after Youth Basketball Classes in Bond order
    ];
    expect(
      names(
        sortProgramsForDisplay(
          withSecondClass,
          { programSort: 'program_type', programTypeOrder: ['league', 'camp', 'class'] },
          NOW,
        ),
      ),
    ).toEqual([
      'Youth Basketball Leagues',
      'School Days Off Camps',
      'Youth Basketball Classes',
      'Aardvark Class',
      'Adult Drop In', // drop_in: not listed, appended in default order
      'i-Brain Sessions', // no type: last
    ]);
  });

  it('uses the default type order when none is configured', () => {
    expect(names(sortProgramsForDisplay(BOND_ORDER, { programSort: 'program_type' }, NOW))).toEqual([
      'Youth Basketball Classes', // class
      'School Days Off Camps', // camp
      'Youth Basketball Leagues', // league
      'Adult Drop In', // drop_in
      'i-Brain Sessions', // untyped
    ]);
  });
});
