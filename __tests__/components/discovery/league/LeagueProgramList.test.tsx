import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { LeagueProgramList } from '@/components/discovery/league/LeagueProgramList';
import type { DiscoveryConfig, Program, Session } from '@/types';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';

vi.mock('@/components/analytics/GoogleTagManager', () => ({
  gtmEvent: { clickRegister: vi.fn() },
}));
vi.mock('@/lib/analytics', () => ({
  bondAnalytics: { clickRegister: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/the-yard',
}));

const SEASON_BASE = 'https://bondsports.co/activity/programs/CO_ED-adult-SOCCER/15087/season';

function season(id: string, over: Partial<Session> = {}): Session {
  return {
    id,
    programId: '15087',
    name: `Season ${id}`,
    linkSEO: `${SEASON_BASE}/Season%20${id}/${id}`,
    products: [
      { id: 'team', name: 'Team', prices: [{ price: 895 }] },
      { id: 'fa', name: 'Free agent', prices: [{ price: 95 }] },
    ],
    ...over,
  } as unknown as Session;
}

const program: Program = {
  id: '15087',
  name: 'Adult Soccer',
  type: 'league',
  sport: 'soccer',
  description: '7v7 indoor soccer.',
  sessions: [
    season('122775', { name: 'Wednesday Session 2', startDate: '2026-08-26', endDate: '2026-10-15', registrationWindowStatus: 'closed' }),
    season('140804', {
      name: 'Wednesday Session 3',
      startDate: '2026-10-21',
      endDate: '2026-12-16',
      registrationWindowStatus: 'open',
      registrationEndDate: '2026-10-20',
    }),
    season('122762', { name: 'Wednesday Session 1', startDate: '2026-06-24', endDate: '2026-08-20', registrationWindowStatus: 'closed' }),
  ],
};

function config(features: Partial<DiscoveryConfig['features']> = {}): DiscoveryConfig {
  return {
    slug: 'the-yard',
    branding: { companyName: 'The Yard', primaryColor: '#111111', secondaryColor: '#2255ff' },
    features: {
      showPricing: true,
      showAgeGender: true,
      enableFilters: [],
      programCardLayout: 'league',
      ...features,
    },
  } as unknown as DiscoveryConfig;
}

function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest('[data-testid="league-season-row"]') as HTMLElement;
}

describe('LeagueProgramList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date('2026-09-23T15:00:00Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('orders seasons in season → registering → final and badges each phase', () => {
    render(<LeagueProgramList programs={[program]} config={config()} />);
    const rows = screen.getAllByTestId('league-season-row');
    expect(rows.map((row) => row.getAttribute('data-phase'))).toEqual([
      'in_season',
      'registering',
      'completed',
    ]);
    expect(within(rows[0]).getByTestId('league-season-badge')).toHaveTextContent('Week 5 of 8');
    expect(within(rows[1]).getByTestId('league-season-badge')).toHaveTextContent('Registration open');
    expect(within(rows[2]).getByTestId('league-season-badge')).toHaveTextContent('Final');
  });

  it('shows Register only while registration is open, with a price summary', () => {
    render(<LeagueProgramList programs={[program]} config={config()} />);
    expect(within(rowFor('Wednesday Session 2')).queryByText('Register')).not.toBeInTheDocument();
    const open = rowFor('Wednesday Session 3');
    const register = within(open).getByText('Register').closest('a')!;
    expect(register.getAttribute('href')).toContain('skipToProducts=true');
    expect(register.getAttribute('data-bond-session-id')).toBe('140804');
    expect(within(open).getByText('From $95')).toBeInTheDocument();
    expect(within(open).getByText('Register by Oct 20')).toBeInTheDocument();
  });

  it('links in-season and final seasons to Bond standings and schedule & scores as passthrough links', () => {
    render(<LeagueProgramList programs={[program]} config={config()} />);
    const live = rowFor('Wednesday Session 2');
    const standings = within(live).getByText('Standings').closest('a')!;
    expect(standings.getAttribute('href')).toBe(
      `${SEASON_BASE}/Season%20122775/122775/competition?tab=standings`,
    );
    expect(standings.getAttribute('data-bond-passthrough')).toBe('true');
    expect(within(live).getByText('Schedule & Scores').closest('a')!.getAttribute('href')).toBe(
      `${SEASON_BASE}/Season%20122775/122775/competition?tab=schedule`,
    );
    expect(within(rowFor('Wednesday Session 1')).getByText('Standings')).toBeInTheDocument();
  });

  it('gives a registering season the in-page schedule instead of Bond links', () => {
    render(<LeagueProgramList programs={[program]} config={config()} />);
    const open = rowFor('Wednesday Session 3');
    expect(within(open).queryByText('Standings')).not.toBeInTheDocument();
    expect(within(open).getByText('Schedule').closest('a')!.getAttribute('href')).toBe(
      '/the-yard?viewMode=schedule&scheduleView=list&programIds=15087&sessionIds=140804',
    );
  });

  it('shows Bond links for an upcoming season once its games are published', () => {
    render(
      <LeagueProgramList
        programs={[program]}
        config={config()}
        events={[{ sessionId: '140804', title: 'ATB vs Europa FC', startDate: '2026-10-22T01:00:00Z', timezone: 'America/Chicago' }]}
      />,
    );
    const open = rowFor('Wednesday Session 3');
    expect(within(open).getByText('Standings')).toBeInTheDocument();
    expect(within(open).getByText('Wednesdays')).toBeInTheDocument();
  });

  it('honors leagueLinksMode never', () => {
    render(<LeagueProgramList programs={[program]} config={config({ leagueLinksMode: 'never' })} />);
    expect(screen.queryByText('Standings')).not.toBeInTheDocument();
  });

  it('adds a Teams link only when a roster page is configured', () => {
    const { unmount } = render(<LeagueProgramList programs={[program]} config={config()} />);
    expect(screen.queryByText('Teams')).not.toBeInTheDocument();
    unmount();
    render(
      <LeagueProgramList
        programs={[program]}
        config={config({ showRostersLink: true, rostersPageSlug: 'the-yard-rosters' })}
      />,
    );
    expect(within(rowFor('Wednesday Session 2')).getByText('Teams').closest('a')!.getAttribute('href')).toBe(
      'http://localhost:3000/rosters/the-yard-rosters?session=122775',
    );
  });

  it('tracks register clicks only when asked', () => {
    const { unmount } = render(<LeagueProgramList programs={[program]} config={config()} />);
    fireEvent.click(within(rowFor('Wednesday Session 3')).getByText('Register'));
    expect(gtmEvent.clickRegister).toHaveBeenCalledTimes(1);
    expect(bondAnalytics.clickRegister).toHaveBeenCalledWith('the-yard', expect.objectContaining({ sessionId: '140804' }));
    unmount();
    vi.clearAllMocks();
    render(<LeagueProgramList programs={[program]} config={config()} trackRegisterClicks={false} />);
    fireEvent.click(within(rowFor('Wednesday Session 3')).getByText('Register'));
    expect(gtmEvent.clickRegister).not.toHaveBeenCalled();
  });

  it('uses the portal schedule callback when given', () => {
    const onOpenSchedule = vi.fn();
    render(<LeagueProgramList programs={[program]} config={config()} onOpenSchedule={onOpenSchedule} />);
    fireEvent.click(within(rowFor('Wednesday Session 3')).getByText('Schedule'));
    expect(onOpenSchedule).toHaveBeenCalledWith('15087', '140804');
  });
});
