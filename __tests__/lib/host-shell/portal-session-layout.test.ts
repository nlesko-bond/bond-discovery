import { describe, expect, it } from 'vitest';
import { HostPortalLayoutEnum, PortalSessionLayoutEnum } from '@/types';
import type { DiscoveryConfig } from '@/types';
import {
  isPortalSessionLayoutToggleAllowed,
  parsePortalSessionLayoutParam,
  resolvePortalSessionLayout,
  resolvePortalSessionLayoutDefault,
  shouldShowPortalSessionHero,
} from '@/lib/host-shell/portal-session-layout';

function buildConfig(
  features: Partial<DiscoveryConfig['features']> = {},
): DiscoveryConfig {
  return {
    id: 'page-1',
    name: 'Test',
    slug: 'test',
    organizationIds: [],
    branding: {
      companyName: 'Test Org',
      primaryColor: '#111111',
      secondaryColor: '#222222',
    },
    features: {
      showPricing: true,
      showAvailability: true,
      showMembershipBadges: false,
      showAgeGender: true,
      enableFilters: [],
      defaultView: 'programs',
      allowViewToggle: true,
      ...features,
    },
    allowedParams: [],
    defaultParams: {},
    cacheTtl: 300,
    isActive: true,
  };
}

describe('resolvePortalSessionLayoutDefault', () => {
  it('maps sessions_list to list when unset', () => {
    expect(
      resolvePortalSessionLayoutDefault(
        buildConfig({ hostPortalLayout: HostPortalLayoutEnum.SESSIONS_LIST }),
      ),
    ).toBe(PortalSessionLayoutEnum.LIST);
  });

  it('maps sessions_first to grid when unset', () => {
    expect(
      resolvePortalSessionLayoutDefault(
        buildConfig({ hostPortalLayout: HostPortalLayoutEnum.SESSIONS_FIRST }),
      ),
    ).toBe(PortalSessionLayoutEnum.GRID);
  });

  it('respects explicit admin default', () => {
    expect(
      resolvePortalSessionLayoutDefault(
        buildConfig({
          hostPortalLayout: HostPortalLayoutEnum.SESSIONS_LIST,
          portalSessionLayoutDefault: PortalSessionLayoutEnum.GRID,
        }),
      ),
    ).toBe(PortalSessionLayoutEnum.GRID);
  });
});

describe('resolvePortalSessionLayout', () => {
  it('ignores URL param when toggle disabled', () => {
    expect(
      resolvePortalSessionLayout(
        buildConfig({ hostPortalLayout: HostPortalLayoutEnum.SESSIONS_LIST }),
        PortalSessionLayoutEnum.GRID,
      ),
    ).toBe(PortalSessionLayoutEnum.LIST);
  });

  it('uses URL param when toggle enabled', () => {
    expect(
      resolvePortalSessionLayout(
        buildConfig({
          hostPortalLayout: HostPortalLayoutEnum.SESSIONS_LIST,
          allowPortalSessionLayoutToggle: true,
        }),
        'grid',
      ),
    ).toBe(PortalSessionLayoutEnum.GRID);
  });
});

describe('parsePortalSessionLayoutParam', () => {
  it('parses list and grid', () => {
    expect(parsePortalSessionLayoutParam('list')).toBe(PortalSessionLayoutEnum.LIST);
    expect(parsePortalSessionLayoutParam('grid')).toBe(PortalSessionLayoutEnum.GRID);
    expect(parsePortalSessionLayoutParam('invalid')).toBeUndefined();
  });
});

describe('isPortalSessionLayoutToggleAllowed', () => {
  it('requires session shell layout and admin flag', () => {
    expect(
      isPortalSessionLayoutToggleAllowed(
        buildConfig({ hostPortalLayout: HostPortalLayoutEnum.LEGACY_PROGRAMS }),
      ),
    ).toBe(false);
    expect(
      isPortalSessionLayoutToggleAllowed(
        buildConfig({
          hostPortalLayout: HostPortalLayoutEnum.SESSIONS_LIST,
          allowPortalSessionLayoutToggle: true,
        }),
      ),
    ).toBe(true);
  });
});

describe('shouldShowPortalSessionHero', () => {
  it('shows hero only in list layout', () => {
    const config = buildConfig({ hostPortalLayout: HostPortalLayoutEnum.SESSIONS_LIST });
    expect(shouldShowPortalSessionHero(config, PortalSessionLayoutEnum.LIST)).toBe(true);
    expect(shouldShowPortalSessionHero(config, PortalSessionLayoutEnum.GRID)).toBe(false);
  });
});
