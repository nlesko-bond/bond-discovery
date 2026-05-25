import { describe, expect, it } from 'vitest';
import type { DiscoveryConfig, DiscoveryFilters } from '@/types';
import { HostPortalLayoutEnum, PortalAccentSourceEnum } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import {
  buildPortalCardAccentContext,
  PortalCardAccentModeEnum,
  resolvePortalCardAccentMode,
} from '@/lib/host-shell/portal-card-accent';
import { getSportVisualTheme } from '@/lib/host-shell/sport-visuals';

function buildConfig(
  features: Partial<DiscoveryConfig['features']> = {},
): DiscoveryConfig {
  return {
    slug: 'test',
    name: 'Test',
    organizationIds: ['1'],
    branding: {
      companyName: 'Test Org',
      primaryColor: '#112233',
      secondaryColor: '#445566',
      headerBackgroundColor: '#AABBCC',
    },
    features: {
      showPricing: true,
      showAvailability: true,
      showMembershipBadges: false,
      showAgeGender: true,
      enableFilters: [],
      defaultView: 'programs',
      allowViewToggle: false,
      hostPortalLayout: HostPortalLayoutEnum.SESSIONS_LIST,
      ...features,
    },
  } as DiscoveryConfig;
}

const EMPTY_FILTERS: DiscoveryFilters = {
  search: '',
  programIds: [],
  sessionIds: [],
  programTypes: [],
  sports: [],
  dateRange: {},
  ageRange: {},
  gender: 'all',
  availability: 'all',
  membershipRequired: null,
};

function makeCard(
  overrides: Partial<IHostPortalSessionCardModel> = {},
): IHostPortalSessionCardModel {
  return {
    sessionId: 's1',
    programId: 'p1',
    programName: 'Program',
    name: 'Session',
    isClosed: false,
    isRegistrationOpen: true,
    hasMultipleRegisterOptions: false,
    isSegmented: false,
    segments: [],
    products: [],
    sport: 'soccer',
    facilityId: '639',
    facilityName: 'Sports Center',
    ...overrides,
  };
}

describe('resolvePortalCardAccentMode', () => {
  it('uses facility accents for a single sport across multiple facilities', () => {
    const cards = [
      makeCard({ sessionId: 's1', facilityId: '639', facilityName: 'Sports Center' }),
      makeCard({ sessionId: 's2', facilityId: '645', facilityName: 'Du Burns Arena' }),
    ];

    expect(resolvePortalCardAccentMode(cards, EMPTY_FILTERS)).toBe(
      PortalCardAccentModeEnum.FACILITY,
    );
  });

  it('uses sport accents when multiple sports are visible', () => {
    const cards = [
      makeCard({ sessionId: 's1', sport: 'soccer' }),
      makeCard({ sessionId: 's2', sport: 'basketball', facilityId: '645', facilityName: 'Du Burns' }),
    ];

    expect(resolvePortalCardAccentMode(cards, EMPTY_FILTERS)).toBe(
      PortalCardAccentModeEnum.SPORT,
    );
  });

  it('uses sport accents when a sport filter is active even with many facilities', () => {
    const cards = [
      makeCard({ sessionId: 's1', sport: 'soccer' }),
      makeCard({ sessionId: 's2', sport: 'basketball', facilityId: '645', facilityName: 'Du Burns' }),
    ];

    expect(
      resolvePortalCardAccentMode(cards, { ...EMPTY_FILTERS, sports: ['soccer', 'basketball'] }),
    ).toBe(PortalCardAccentModeEnum.SPORT);
  });
});

describe('buildPortalCardAccentContext', () => {
  it('returns distinct sport palettes per card in multi-sport mode', () => {
    const cards = [
      makeCard({ sessionId: 's1', sport: 'soccer' }),
      makeCard({ sessionId: 's2', sport: 'basketball', facilityId: '645', facilityName: 'Du Burns' }),
    ];
    const context = buildPortalCardAccentContext(buildConfig(), cards, EMPTY_FILTERS);

    expect(context.mode).toBe(PortalCardAccentModeEnum.SPORT);
    expect(context.getCardVisualTheme(cards[0]).gradientFrom).toBe(
      getSportVisualTheme('soccer').gradientFrom,
    );
    expect(context.getCardVisualTheme(cards[1]).gradientFrom).toBe(
      getSportVisualTheme('basketball').gradientFrom,
    );
  });

  it('returns hue-shifted facility palettes anchored to the sport in single-sport mode', () => {
    const cards = [
      makeCard({ sessionId: 's1', sport: 'soccer', facilityId: '639', facilityName: 'Sports Center' }),
      makeCard({ sessionId: 's2', sport: 'soccer', facilityId: '645', facilityName: 'Du Burns Arena' }),
    ];
    const context = buildPortalCardAccentContext(buildConfig(), cards, EMPTY_FILTERS);
    const sportsCenterTheme = context.getCardVisualTheme(cards[0]);
    const duBurnsTheme = context.getCardVisualTheme(cards[1]);
    const soccerTheme = getSportVisualTheme('soccer');

    expect(context.mode).toBe(PortalCardAccentModeEnum.FACILITY);
    expect(duBurnsTheme.gradientFrom).toBe(soccerTheme.gradientFrom);
    expect(sportsCenterTheme.gradientFrom).not.toBe(duBurnsTheme.gradientFrom);
  });

  it('uses org branding for all cards when branding accent source is selected', () => {
    const cards = [
      makeCard({ sessionId: 's1', sport: 'soccer' }),
      makeCard({ sessionId: 's2', sport: 'basketball', facilityId: '645', facilityName: 'Du Burns' }),
    ];
    const context = buildPortalCardAccentContext(
      buildConfig({ portalAccentSource: PortalAccentSourceEnum.BRANDING }),
      cards,
      EMPTY_FILTERS,
    );

    expect(context.getCardVisualTheme(cards[0]).gradientFrom).toBe('#112233');
    expect(context.getCardVisualTheme(cards[1]).gradientFrom).toBe('#112233');
  });
});
