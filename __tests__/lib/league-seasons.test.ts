import { describe, expect, it } from 'vitest';
import {
  getSeasonPhase,
  getSeasonWeek,
  getSessionIdsWithMatchups,
  mergeCompletedSeasons,
  resolveCompletedSeasonDays,
  shouldShowLeagueLinks,
  sortSeasonsForLeagueCard,
} from '@/lib/league-seasons';
import type { DiscoveryConfig, Program, Session } from '@/types';

const TODAY = '2026-09-23';

const season = (over: Partial<Session> = {}): Session =>
  ({ id: 's1', programId: 'p1', name: 'Season', ...over }) as Session;

describe('getSeasonPhase', () => {
  it('classifies by calendar day', () => {
    expect(getSeasonPhase(season({ startDate: '2026-06-24', endDate: '2026-08-20' }), TODAY)).toBe('completed');
    expect(getSeasonPhase(season({ startDate: '2026-08-26', endDate: '2026-10-15' }), TODAY)).toBe('in_season');
    // Ends today → still in season.
    expect(getSeasonPhase(season({ startDate: '2026-08-26', endDate: '2026-09-23T00:00:00Z' }), TODAY)).toBe('in_season');
    expect(
      getSeasonPhase(
        season({ startDate: '2026-10-21', endDate: '2026-12-16', registrationWindowStatus: 'open' }),
        TODAY,
      ),
    ).toBe('registering');
    expect(
      getSeasonPhase(
        season({ startDate: '2026-11-29', registrationWindowStatus: 'not_opened_yet' }),
        TODAY,
      ),
    ).toBe('upcoming');
    expect(
      getSeasonPhase(season({ startDate: '2026-10-01', registrationWindowStatus: 'closed' }), TODAY),
    ).toBe('upcoming');
  });
});

describe('getSeasonWeek', () => {
  it('counts weeks from the start date', () => {
    // Aug 26 → Oct 15 is 51 days = 8 weeks; Sep 23 is day 28 → week 5.
    expect(getSeasonWeek(season({ startDate: '2026-08-26', endDate: '2026-10-15' }), TODAY)).toEqual({
      current: 5,
      total: 8,
    });
    expect(getSeasonWeek(season({ startDate: '2026-09-23', endDate: '2026-09-23' }), TODAY)).toEqual({
      current: 1,
      total: 1,
    });
  });

  it('is undefined outside the season or without dates', () => {
    expect(getSeasonWeek(season({ startDate: '2026-10-21', endDate: '2026-12-16' }), TODAY)).toBeUndefined();
    expect(getSeasonWeek(season({ startDate: '2026-08-26' }), TODAY)).toBeUndefined();
  });
});

describe('sortSeasonsForLeagueCard', () => {
  it('orders in season, registering, upcoming, then most recent completed', () => {
    const sorted = sortSeasonsForLeagueCard(
      [
        season({ id: 'old', startDate: '2026-04-01', endDate: '2026-06-01' }),
        season({ id: 'up', startDate: '2026-11-29', registrationWindowStatus: 'not_opened_yet' }),
        season({ id: 'reg', startDate: '2026-10-21', registrationWindowStatus: 'open' }),
        season({ id: 'recent', startDate: '2026-06-24', endDate: '2026-08-20' }),
        season({ id: 'live', startDate: '2026-08-26', endDate: '2026-10-15' }),
      ],
      TODAY,
    );
    expect(sorted.map((s) => s.id)).toEqual(['live', 'reg', 'up', 'recent', 'old']);
  });
});

describe('getSessionIdsWithMatchups', () => {
  it('collects sessions whose events are "A vs B" games', () => {
    const ids = getSessionIdsWithMatchups([
      { sessionId: 122775, title: 'Archer FC vs Black Rayos FC' },
      { sessionId: '140804', title: 'Wednesday Session 3' },
      { title: 'A vs B' },
    ]);
    expect(Array.from(ids)).toEqual(['122775']);
  });
});

describe('shouldShowLeagueLinks', () => {
  it('auto shows once started or once games are published', () => {
    expect(shouldShowLeagueLinks('in_season', false, undefined)).toBe(true);
    expect(shouldShowLeagueLinks('completed', false, 'auto')).toBe(true);
    expect(shouldShowLeagueLinks('registering', false, 'auto')).toBe(false);
    expect(shouldShowLeagueLinks('upcoming', true, 'auto')).toBe(true);
  });

  it('honors always / never', () => {
    expect(shouldShowLeagueLinks('registering', false, 'always')).toBe(true);
    expect(shouldShowLeagueLinks('in_season', true, 'never')).toBe(false);
  });
});

describe('resolveCompletedSeasonDays', () => {
  const config = (features: Record<string, unknown>) =>
    ({ features }) as unknown as DiscoveryConfig;

  it('is 0 unless the league layout is on', () => {
    expect(resolveCompletedSeasonDays(config({ completedSeasonDays: 14 }))).toBe(0);
    expect(resolveCompletedSeasonDays(config({ programCardLayout: 'league' }))).toBe(0);
  });

  it('clamps to 0–60', () => {
    expect(resolveCompletedSeasonDays(config({ programCardLayout: 'league', completedSeasonDays: 14 }))).toBe(14);
    expect(resolveCompletedSeasonDays(config({ programCardLayout: 'league', completedSeasonDays: 500 }))).toBe(60);
    expect(resolveCompletedSeasonDays(config({ programCardLayout: 'league', completedSeasonDays: -3 }))).toBe(0);
  });
});

describe('mergeCompletedSeasons', () => {
  const prog = (id: string, sessions: Session[]): Program =>
    ({ id, name: `P${id}`, type: 'league', sessions }) as Program;

  it('returns the input untouched when disabled', () => {
    const programs = [prog('1', [])];
    expect(mergeCompletedSeasons(programs, [prog('1', [season({ endDate: '2026-09-20' })])], TODAY, 0)).toBe(
      programs,
    );
  });

  it('adds only seasons that ended inside the window', () => {
    const live = season({ id: 'live', endDate: '2026-10-15' });
    const merged = mergeCompletedSeasons(
      [prog('1', [live])],
      [
        prog('1', [
          season({ id: 'live', endDate: '2026-10-15' }),
          season({ id: 'recent', endDate: '2026-09-10' }),
          season({ id: 'old', endDate: '2026-08-01' }),
        ]),
        prog('2', [season({ id: 'p2-recent', endDate: '2026-09-22' })]),
        prog('3', [season({ id: 'p3-old', endDate: '2026-01-01' })]),
      ],
      TODAY,
      21,
    );
    expect(merged.map((p) => [p.id, (p.sessions || []).map((s) => s.id)])).toEqual([
      ['1', ['live', 'recent']],
      ['2', ['p2-recent']],
    ]);
  });
});
