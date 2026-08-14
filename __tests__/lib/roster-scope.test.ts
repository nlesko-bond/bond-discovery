import { describe, expect, it } from 'vitest';
import {
  isProgramAllowed,
  isSessionInScope,
  isSessionInWindow,
  resolveRosterSessions,
  resolveSessionWindow,
  sortSessionRefs,
} from '@/lib/roster-scope';
import type { Program, Session } from '@/types';
import type { RosterPageConfig, RosterSessionRef } from '@/types/rosters';

const NOW = new Date('2026-08-14T12:00:00Z');

type ScopeConfig = Pick<RosterPageConfig, 'programFilter' | 'pinnedSessions' | 'sessionWindow'>;

const config = (over: Partial<ScopeConfig> = {}): ScopeConfig => ({
  programFilter: { mode: 'all', programIds: [] },
  pinnedSessions: [],
  sessionWindow: { pastDays: 90, futureDays: 180 },
  ...over,
});

const program = (id: number, name: string, over: Partial<Program> = {}): Program =>
  ({ id: String(id), name, sport: 'soccer', ...over }) as Program;

const session = (id: number, programId: number, name: string, over: Partial<Session> = {}): Session =>
  ({ id: String(id), programId: String(programId), name, ...over }) as Session;

describe('resolveSessionWindow', () => {
  it('spans the configured days either side of today', () => {
    const { from, to } = resolveSessionWindow(config({ sessionWindow: { pastDays: 10, futureDays: 20 } }), NOW);
    expect(from.toISOString().slice(0, 10)).toBe('2026-08-04');
    expect(to.toISOString().slice(0, 10)).toBe('2026-09-03');
  });

  it('treats negative day counts as zero', () => {
    const { from, to } = resolveSessionWindow(config({ sessionWindow: { pastDays: -5, futureDays: -5 } }), NOW);
    expect(from.toISOString().slice(0, 10)).toBe('2026-08-14');
    expect(to.toISOString().slice(0, 10)).toBe('2026-08-14');
  });
});

describe('isProgramAllowed', () => {
  it('allows everything in "all" mode', () => {
    expect(isProgramAllowed(1, { mode: 'all', programIds: [] })).toBe(true);
    expect(isProgramAllowed(1, { mode: 'all', programIds: [99] })).toBe(true);
  });

  it('honours include and exclude lists', () => {
    expect(isProgramAllowed(1, { mode: 'include', programIds: [1, 2] })).toBe(true);
    expect(isProgramAllowed(3, { mode: 'include', programIds: [1, 2] })).toBe(false);
    expect(isProgramAllowed(1, { mode: 'exclude', programIds: [1] })).toBe(false);
    expect(isProgramAllowed(3, { mode: 'exclude', programIds: [1] })).toBe(true);
  });
});

describe('isSessionInWindow', () => {
  const window = resolveSessionWindow(config({ sessionWindow: { pastDays: 30, futureDays: 30 } }), NOW);

  it('keeps a season already under way when the window opened', () => {
    expect(isSessionInWindow({ startDate: '2026-06-01', endDate: '2026-09-30' }, window)).toBe(true);
  });

  it('keeps a season entirely inside the window', () => {
    expect(isSessionInWindow({ startDate: '2026-08-01', endDate: '2026-08-20' }, window)).toBe(true);
  });

  it('drops seasons wholly before or after the window', () => {
    expect(isSessionInWindow({ startDate: '2026-01-01', endDate: '2026-02-01' }, window)).toBe(false);
    expect(isSessionInWindow({ startDate: '2027-01-01', endDate: '2027-02-01' }, window)).toBe(false);
  });

  it('keeps a session missing both dates rather than hiding a roster', () => {
    expect(isSessionInWindow({}, window)).toBe(true);
  });

  it('treats a single date as a point in time', () => {
    expect(isSessionInWindow({ startDate: '2026-08-10' }, window)).toBe(true);
    expect(isSessionInWindow({ endDate: '2020-01-01' }, window)).toBe(false);
  });

  it('ignores unparseable dates rather than throwing', () => {
    expect(isSessionInWindow({ startDate: 'nonsense', endDate: 'nonsense' }, window)).toBe(true);
  });
});

describe('resolveRosterSessions', () => {
  const programs = [program(1, 'Adult Soccer'), program(2, 'Youth Basketball')];
  const sessions = new Map<number, Session[]>([
    [1, [
      session(10, 1, 'Fall Coed', { startDate: '2026-09-01', endDate: '2026-11-15' }),
      session(11, 1, 'Spring Coed', { startDate: '2026-03-01', endDate: '2026-05-15' }),
    ]],
    [2, [session(20, 2, 'Fall Youth', { startDate: '2026-09-05', endDate: '2026-11-20' })]],
  ]);

  it('returns in-window sessions across every allowed program', () => {
    const refs = resolveRosterSessions(config(), programs, sessions, NOW);
    expect(refs.map((r) => r.sessionId)).toEqual([20, 10]);
  });

  it('excludes programs outside the filter', () => {
    const refs = resolveRosterSessions(
      config({ programFilter: { mode: 'include', programIds: [1] } }),
      programs,
      sessions,
      NOW
    );
    expect(refs.every((r) => r.programId === 1)).toBe(true);
  });

  it('drops out-of-window seasons', () => {
    const refs = resolveRosterSessions(
      config({ sessionWindow: { pastDays: 7, futureDays: 7 } }),
      programs,
      sessions,
      NOW
    );
    expect(refs).toEqual([]);
  });

  it('uses pins verbatim, ignoring the window', () => {
    const refs = resolveRosterSessions(
      config({ pinnedSessions: [{ programId: 1, sessionId: 11 }], sessionWindow: { pastDays: 1, futureDays: 1 } }),
      programs,
      sessions,
      NOW
    );
    expect(refs.map((r) => r.sessionId)).toEqual([11]);
  });

  it('still bounds pins by the program filter, so a stale pin cannot escape', () => {
    const refs = resolveRosterSessions(
      config({
        pinnedSessions: [{ programId: 2, sessionId: 20 }],
        programFilter: { mode: 'exclude', programIds: [2] },
      }),
      programs,
      sessions,
      NOW
    );
    expect(refs).toEqual([]);
  });

  it('carries the fields the standings deep-link needs', () => {
    const withLink = new Map<number, Session[]>([
      [1, [session(10, 1, 'Fall Coed', {
        startDate: '2026-09-01',
        linkSEO: '/activity/programs/SOCCER/1/season/Fall%20Coed/10',
      })]],
    ]);
    const [ref] = resolveRosterSessions(config(), [programs[0]], withLink, NOW);
    expect(ref.linkSEO).toBe('/activity/programs/SOCCER/1/season/Fall%20Coed/10');
    expect(ref.programName).toBe('Adult Soccer');
    expect(ref.sport).toBe('soccer');
  });

  it('ignores programs with no sessions loaded', () => {
    expect(resolveRosterSessions(config(), programs, new Map(), NOW)).toEqual([]);
  });
});

describe('sortSessionRefs', () => {
  it('orders newest first and sorts undated sessions last', () => {
    const refs = [
      { sessionId: 1, sessionName: 'Old', startDate: '2026-01-01' },
      { sessionId: 2, sessionName: 'Undated' },
      { sessionId: 3, sessionName: 'New', startDate: '2026-09-01' },
    ] as RosterSessionRef[];
    expect(sortSessionRefs(refs).map((r) => r.sessionName)).toEqual(['New', 'Old', 'Undated']);
  });
});

describe('isSessionInScope', () => {
  const refs = [{ programId: 1, sessionId: 10 }] as RosterSessionRef[];

  it('accepts a session inside the resolved scope', () => {
    expect(isSessionInScope(refs, 1, 10)).toBe(true);
  });

  it('rejects a session the page was never scoped to', () => {
    expect(isSessionInScope(refs, 1, 999)).toBe(false);
    expect(isSessionInScope(refs, 2, 10)).toBe(false);
  });
});
