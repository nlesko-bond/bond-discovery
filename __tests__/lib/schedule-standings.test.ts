import { describe, it, expect } from 'vitest';
import { eventShowsStandingsLink, getLeagueStandingsUrl } from '@/lib/schedule-standings';
import type { CalendarEvent, DiscoveryConfig } from '@/types';

const SEASON_LINK =
  'https://bondsports.co/activity/programs/CO_ED-adult-SOCCER/11537/season/Wednesday%202026-05/129092';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    programId: '11537',
    programName: 'CO_ED adult SOCCER',
    sessionId: '129092',
    sessionName: 'Wednesday 2026-05',
    date: '2026-05-06',
    startTime: '2026-05-06T22:00:00Z',
    endTime: '2026-05-06T23:00:00Z',
    facilityId: 'f1',
    facilityName: 'Main Facility',
    color: '',
    programType: 'league',
    linkSEO: SEASON_LINK,
    ...overrides,
  };
}

function makeConfig(showLeagueStandingsLink: boolean | undefined): DiscoveryConfig {
  return {
    features: { showLeagueStandingsLink },
  } as unknown as DiscoveryConfig;
}

describe('getLeagueStandingsUrl', () => {
  it('appends the competition standings tab to a season linkSEO', () => {
    expect(getLeagueStandingsUrl(SEASON_LINK)).toBe(
      `${SEASON_LINK}/competition?tab=standings`,
    );
  });

  it('resolves relative season paths against bondsports.co', () => {
    expect(
      getLeagueStandingsUrl('/activity/programs/CO_ED-adult-SOCCER/11537/season/Wednesday%202026-05/129092'),
    ).toBe(`${SEASON_LINK}/competition?tab=standings`);
  });

  it('tolerates a trailing slash', () => {
    expect(getLeagueStandingsUrl(`${SEASON_LINK}/`)).toBe(
      `${SEASON_LINK}/competition?tab=standings`,
    );
  });

  it('returns undefined for non-season links', () => {
    expect(getLeagueStandingsUrl('https://bondsports.co/programs/youth-soccer')).toBeUndefined();
    expect(getLeagueStandingsUrl('/programs/youth-soccer/spring-2026')).toBeUndefined();
  });

  it('returns undefined when linkSEO is missing', () => {
    expect(getLeagueStandingsUrl(undefined)).toBeUndefined();
    expect(getLeagueStandingsUrl('')).toBeUndefined();
  });
});

describe('eventShowsStandingsLink', () => {
  it('shows for league events when the feature is on', () => {
    expect(eventShowsStandingsLink(makeEvent(), makeConfig(true))).toBe(true);
  });

  it('hides when the feature is off or unset', () => {
    expect(eventShowsStandingsLink(makeEvent(), makeConfig(false))).toBe(false);
    expect(eventShowsStandingsLink(makeEvent(), makeConfig(undefined))).toBe(false);
  });

  it('hides for non-league events', () => {
    const event = makeEvent({ programType: undefined, type: 'drop_in' });
    expect(eventShowsStandingsLink(event, makeConfig(true))).toBe(false);
  });

  it('falls back to event.type when programType is absent', () => {
    const event = makeEvent({ programType: undefined, type: 'league' });
    expect(eventShowsStandingsLink(event, makeConfig(true))).toBe(true);
  });

  it('hides when the standings URL cannot be derived', () => {
    const event = makeEvent({ linkSEO: '/programs/youth-soccer' });
    expect(eventShowsStandingsLink(event, makeConfig(true))).toBe(false);
  });
});
