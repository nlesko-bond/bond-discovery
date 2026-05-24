import { describe, expect, it } from 'vitest';
import {
  isHostPortalSessionLayoutValue,
  normalizePortalFeatureFields,
} from '@/lib/host-shell/portal-feature-config';
import { HostPortalLayoutEnum, PortalAccentSourceEnum, PortalSessionLayoutEnum } from '@/types';

describe('normalizePortalFeatureFields', () => {
  it('reads snake_case portal feature keys', () => {
    expect(
      normalizePortalFeatureFields({
        host_portal_layout: 'sessions_list',
        portal_accent_source: 'branding',
        portal_hero_enabled: false,
        portal_hero_title: '  Soccer.  ',
        portal_hero_subtitle: ' Subcopy ',
      }),
    ).toEqual({
      hostPortalLayout: HostPortalLayoutEnum.SESSIONS_LIST,
      portalAccentSource: PortalAccentSourceEnum.BRANDING,
      portalHeroEnabled: false,
      portalHeroTitle: 'Soccer.',
      portalHeroSubtitle: 'Subcopy',
    });
  });

  it('reads session layout toggle fields', () => {
    expect(
      normalizePortalFeatureFields({
        host_portal_layout: 'sessions_first',
        portal_session_layout_default: 'grid',
        allow_portal_session_layout_toggle: true,
      }),
    ).toEqual({
      hostPortalLayout: HostPortalLayoutEnum.SESSIONS_FIRST,
      portalSessionLayoutDefault: PortalSessionLayoutEnum.GRID,
      allowPortalSessionLayoutToggle: true,
    });
  });

  it('returns empty object when portal keys are absent', () => {
    expect(normalizePortalFeatureFields({ showPricing: true })).toEqual({});
  });
});

describe('isHostPortalSessionLayoutValue', () => {
  it('is true for session-first portal layouts', () => {
    expect(isHostPortalSessionLayoutValue(HostPortalLayoutEnum.SESSIONS_LIST)).toBe(true);
    expect(isHostPortalSessionLayoutValue(HostPortalLayoutEnum.SESSIONS_FIRST)).toBe(true);
    expect(isHostPortalSessionLayoutValue(HostPortalLayoutEnum.LEGACY_PROGRAMS)).toBe(false);
  });
});
