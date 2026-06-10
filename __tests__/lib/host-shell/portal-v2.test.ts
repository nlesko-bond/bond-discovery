import { describe, expect, it } from 'vitest';
import type { DiscoveryConfig, Program } from '@/types';
import type { IHostPortalProductRow } from '@/lib/host-shell/session-card-model';
import {
  applyPortalV2PreviewOverrides,
  buildV2GenderOptions,
  countSessionsPerAgeBucket,
  derivePortalCardTint,
  formatActivityLabel,
  isPortalTemplateV2,
  resolveMemberPricing,
  resolveMemberPricingStyle,
  resolvePortalCardMinWidth,
  resolvePortalTemplate,
  resolveV2Availability,
  V2_CARD_MIN_WIDTH_DEFAULT_CARDS_PX,
  V2_CARD_MIN_WIDTH_DEFAULT_LIST_PX,
} from '@/lib/host-shell/portal-v2';

function makeConfig(features: Record<string, unknown> = {}): DiscoveryConfig {
  return {
    id: 'test',
    name: 'Test',
    slug: 'test',
    organizationIds: [],
    facilityIds: [],
    branding: {
      primaryColor: '#1E2761',
      secondaryColor: '#6366F1',
      companyName: 'Test Org',
    },
    features: {
      showPricing: true,
      showAvailability: true,
      showMembershipBadges: true,
      showAgeGender: true,
      enableFilters: [],
      defaultView: 'programs',
      allowViewToggle: true,
      ...features,
    },
    allowedParams: [],
    defaultParams: {},
    cacheTtl: 300,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  } as DiscoveryConfig;
}

describe('resolvePortalTemplate', () => {
  it('activates only on the literal v2', () => {
    expect(resolvePortalTemplate('v2')).toBe('v2');
    expect(resolvePortalTemplate('current')).toBeUndefined();
    expect(resolvePortalTemplate('V2')).toBeUndefined();
    expect(resolvePortalTemplate(undefined)).toBeUndefined();
    expect(resolvePortalTemplate(2)).toBeUndefined();
    expect(resolvePortalTemplate('v3')).toBeUndefined();
  });

  it('isPortalTemplateV2 reads features.portalTemplate', () => {
    expect(isPortalTemplateV2(makeConfig({ portalTemplate: 'v2' }))).toBe(true);
    expect(isPortalTemplateV2(makeConfig({ portalTemplate: 'current' }))).toBe(false);
    expect(isPortalTemplateV2(makeConfig())).toBe(false);
  });
});

describe('resolveMemberPricingStyle', () => {
  it('defaults to inline and accepts known styles', () => {
    expect(resolveMemberPricingStyle(undefined)).toBe('inline');
    expect(resolveMemberPricingStyle('garbage')).toBe('inline');
    expect(resolveMemberPricingStyle('inline')).toBe('inline');
    expect(resolveMemberPricingStyle('badge')).toBe('badge');
    expect(resolveMemberPricingStyle('stacked')).toBe('stacked');
  });
});

describe('resolvePortalCardMinWidth', () => {
  it('defaults per layout mode', () => {
    expect(resolvePortalCardMinWidth(undefined, 'cards')).toBe(
      V2_CARD_MIN_WIDTH_DEFAULT_CARDS_PX,
    );
    expect(resolvePortalCardMinWidth(undefined, 'list')).toBe(
      V2_CARD_MIN_WIDTH_DEFAULT_LIST_PX,
    );
    expect(V2_CARD_MIN_WIDTH_DEFAULT_LIST_PX).toBeLessThan(
      V2_CARD_MIN_WIDTH_DEFAULT_CARDS_PX,
    );
  });

  it('accepts numbers and numeric strings, clamping to a sane range', () => {
    expect(resolvePortalCardMinWidth(280, 'cards')).toBe(280);
    expect(resolvePortalCardMinWidth('280', 'cards')).toBe(280);
    expect(resolvePortalCardMinWidth(280.6, 'cards')).toBe(281);
    expect(resolvePortalCardMinWidth(10, 'cards')).toBe(160);
    expect(resolvePortalCardMinWidth(9999, 'cards')).toBe(480);
  });

  it('falls back on garbage values', () => {
    expect(resolvePortalCardMinWidth('wide', 'cards')).toBe(
      V2_CARD_MIN_WIDTH_DEFAULT_CARDS_PX,
    );
    expect(resolvePortalCardMinWidth(Number.NaN, 'list')).toBe(
      V2_CARD_MIN_WIDTH_DEFAULT_LIST_PX,
    );
    expect(resolvePortalCardMinWidth('', 'cards')).toBe(
      V2_CARD_MIN_WIDTH_DEFAULT_CARDS_PX,
    );
  });
});

describe('derivePortalCardTint', () => {
  it('uses the per-sport hue family for known sports', () => {
    const tint = derivePortalCardTint('#ff0000', 'soccer');
    expect(tint.panelBackground).toBe('#dcfce7');
    expect(tint.glyphColor).toBe('#15803d');
  });

  it('derives a soft tint from the accent for unknown sports', () => {
    const tint = derivePortalCardTint('#2563eb', 'quidditch');
    expect(tint.panelBackground).toMatch(/^#[0-9a-f]{6}$/);
    expect(tint.glyphColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(tint.accentColor).toBe('#2563eb');
    // Background must be light (panel), glyph dark (contrast).
    const lightness = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
    };
    expect(lightness(tint.panelBackground)).toBeGreaterThan(0.85);
    expect(lightness(tint.glyphColor)).toBeLessThan(0.45);
  });

  it('falls back to a neutral indigo family for invalid or gray accents', () => {
    expect(derivePortalCardTint('not-a-color').panelBackground).toBe('#eef2ff');
    expect(derivePortalCardTint('#808080').panelBackground).toBe('#eef2ff');
    expect(derivePortalCardTint('').glyphColor).toBe('#4338ca');
  });
});

describe('resolveMemberPricing', () => {
  const product = (
    overrides: Partial<IHostPortalProductRow>,
  ): IHostPortalProductRow => ({
    id: 'p1',
    name: 'Product',
    registerDisabled: false,
    ...overrides,
  });

  it('returns the lowest member price when below the public price', () => {
    const result = resolveMemberPricing([
      product({ id: 'pub', priceAmount: 30 }),
      product({ id: 'mem', priceAmount: 24, isMemberProduct: true }),
      product({ id: 'mem2', priceAmount: 26, isMemberProduct: true }),
    ]);
    expect(result.memberPriceLabel).toBe('$24.00');
  });

  it('returns nothing without member products (row shows From $X alone)', () => {
    expect(resolveMemberPricing([product({ priceAmount: 30 })])).toEqual({});
    expect(resolveMemberPricing([])).toEqual({});
  });

  it('returns nothing when the member price is not actually lower', () => {
    expect(
      resolveMemberPricing([
        product({ id: 'pub', priceAmount: 20 }),
        product({ id: 'mem', priceAmount: 25, isMemberProduct: true }),
      ]),
    ).toEqual({});
  });
});

describe('resolveV2Availability', () => {
  it('maps card state to the pill kinds', () => {
    expect(resolveV2Availability({ isClosed: true })).toEqual({
      kind: 'closed',
      label: 'Closed',
    });
    expect(resolveV2Availability({ isClosed: false, isFull: true }).kind).toBe('full');
    expect(
      resolveV2Availability({ isClosed: false, spotsRemaining: 3 }),
    ).toEqual({ kind: 'almost_full', label: '3 spots left' });
    expect(
      resolveV2Availability({ isClosed: false, spotsRemaining: 1 }).label,
    ).toBe('1 spot left');
    expect(resolveV2Availability({ isClosed: false, spotsRemaining: 40 }).kind).toBe(
      'open',
    );
    expect(resolveV2Availability({ isClosed: false }).kind).toBe('open');
  });
});

describe('countSessionsPerAgeBucket', () => {
  const programs = [
    {
      id: 'prog-1',
      name: 'Youth Soccer',
      ageMin: 6,
      ageMax: 8,
      sessions: [
        { id: 's1', programId: 'prog-1' },
        { id: 's2', programId: 'prog-1', minAge: 18, maxAge: 40 },
      ],
    },
  ] as unknown as Program[];

  it('counts sessions per bucket using session ages with program fallback', () => {
    const buckets = countSessionsPerAgeBucket(programs);
    const byId = Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket.count]));
    expect(byId['6-8']).toBe(1);
    expect(byId['18-plus']).toBe(1);
    expect(byId['0-5']).toBe(0);
  });
});

describe('buildV2GenderOptions', () => {
  it('offers only genders that exist in the data', () => {
    const programs = [
      {
        id: 'prog-1',
        name: 'P',
        sessions: [
          { id: 's1', programId: 'prog-1', gender: 'male' },
          { id: 's2', programId: 'prog-1', gender: 'coed' },
        ],
      },
    ] as unknown as Program[];
    expect(buildV2GenderOptions(programs)).toEqual([{ id: 'male', label: 'Boys' }]);
    expect(buildV2GenderOptions([])).toEqual([]);
  });
});

describe('formatActivityLabel', () => {
  it('humanizes sport ids', () => {
    expect(formatActivityLabel('ice_skating')).toBe('Ice Skating');
    expect(formatActivityLabel('soccer')).toBe('Soccer');
    expect(formatActivityLabel('martial-arts')).toBe('Martial Arts');
    expect(formatActivityLabel('FLAG FOOTBALL')).toBe('Flag Football');
  });
});

describe('applyPortalV2PreviewOverrides', () => {
  it('returns the same config object when no preview params are present', () => {
    const config = makeConfig();
    expect(applyPortalV2PreviewOverrides(config, {})).toBe(config);
    expect(applyPortalV2PreviewOverrides(config, { viewMode: 'schedule' })).toBe(config);
    expect(applyPortalV2PreviewOverrides(config, { portalTemplate: 'v3' })).toBe(config);
  });

  it('applies recognized preview params without mutating the original', () => {
    const config = makeConfig();
    const next = applyPortalV2PreviewOverrides(config, {
      portalTemplate: 'v2',
      memberPricingStyle: 'badge',
      portalCardMinWidth: '280',
    });
    expect(next).not.toBe(config);
    expect(next.features.portalTemplate).toBe('v2');
    expect(next.features.memberPricingStyle).toBe('badge');
    expect(next.features.portalCardMinWidth).toBe(280);
    expect(config.features.portalTemplate).toBeUndefined();
  });

  it('takes the first value for array params and ignores bad widths', () => {
    const config = makeConfig();
    const next = applyPortalV2PreviewOverrides(config, {
      portalTemplate: ['v2', 'current'],
      portalCardMinWidth: 'wide',
    });
    expect(next.features.portalTemplate).toBe('v2');
    expect(next.features.portalCardMinWidth).toBeUndefined();
  });
});
