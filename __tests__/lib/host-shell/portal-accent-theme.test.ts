import { describe, expect, it } from 'vitest';
import type { DiscoveryConfig } from '@/types';
import { HostPortalLayoutEnum, PortalAccentSourceEnum } from '@/types';
import {
  resolvePortalAccentSource,
  resolvePortalUiColors,
  resolvePortalVisualTheme,
} from '@/lib/host-shell/portal-accent-theme';
import { resolvePortalBrandingLogoUrl } from '@/lib/host-shell/portal-branding';

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

describe('resolvePortalAccentSource', () => {
  it('defaults to sport accents', () => {
    expect(resolvePortalAccentSource(buildConfig())).toBe(PortalAccentSourceEnum.SPORT);
  });

  it('uses branding when configured', () => {
    expect(
      resolvePortalAccentSource(
        buildConfig({ portalAccentSource: PortalAccentSourceEnum.BRANDING }),
      ),
    ).toBe(PortalAccentSourceEnum.BRANDING);
  });
});

describe('resolvePortalVisualTheme', () => {
  it('uses sport palette by default', () => {
    const theme = resolvePortalVisualTheme(buildConfig(), 'soccer');
    expect(theme.gradientFrom).toBe('#16a34a');
  });

  it('uses brand colors when branding accent source is selected', () => {
    const theme = resolvePortalVisualTheme(
      buildConfig({ portalAccentSource: PortalAccentSourceEnum.BRANDING }),
      'soccer',
    );
    expect(theme).toEqual({
      gradientFrom: '#112233',
      gradientTo: '#445566',
      iconBackground: '#AABBCC',
      iconColor: '#112233',
    });
  });
});

describe('resolvePortalBrandingLogoUrl', () => {
  it('returns trimmed logo url when set', () => {
    const config = buildConfig();
    config.branding.logo = '  https://example.com/logo.png  ';
    expect(resolvePortalBrandingLogoUrl(config)).toBe('https://example.com/logo.png');
  });
});

describe('resolvePortalUiColors', () => {
  it('exposes all three brand colors and derived panel colors', () => {
    const ui = resolvePortalUiColors(
      buildConfig({ portalAccentSource: PortalAccentSourceEnum.BRANDING }),
    );
    expect(ui.primaryColor).toBe('#112233');
    expect(ui.secondaryColor).toBe('#445566');
    expect(ui.headerBackgroundColor).toBe('#AABBCC');
    expect(ui.panelBorderColor).toMatch(/^#[0-9a-f]{8}$/i);
    expect(ui.chipAccentColor).toBe('#445566');
  });
});
