import { describe, expect, it } from 'vitest';
import type { DiscoveryConfig, ScheduleTableColumn } from '@/types';
import {
  applyPortalV2PreviewOverrides,
  resolveEffectivePortalDisplayMode,
  resolvePortalCardStyle,
  resolvePortalDisplayMode,
  resolvePortalV2SessionRowColumns,
} from '@/lib/host-shell/portal-v2';
import { normalizePortalFeatureFields } from '@/lib/host-shell/portal-feature-config';

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

describe('resolvePortalCardStyle', () => {
  it('defaults to classic and accepts the three known styles', () => {
    expect(resolvePortalCardStyle(undefined)).toBe('classic');
    expect(resolvePortalCardStyle('garbage')).toBe('classic');
    expect(resolvePortalCardStyle(2)).toBe('classic');
    expect(resolvePortalCardStyle('classic')).toBe('classic');
    expect(resolvePortalCardStyle('stacked')).toBe('stacked');
    expect(resolvePortalCardStyle('rows')).toBe('rows');
  });
});

describe('resolvePortalDisplayMode / resolveEffectivePortalDisplayMode', () => {
  it('defaults to auto on unknown values', () => {
    expect(resolvePortalDisplayMode(undefined)).toBe('auto');
    expect(resolvePortalDisplayMode('nope')).toBe('auto');
    expect(resolvePortalDisplayMode('programs')).toBe('programs');
    expect(resolvePortalDisplayMode('sessions')).toBe('sessions');
  });

  it('auto resolves to sessions when the page scope has exactly ONE program (coppermine case)', () => {
    expect(resolveEffectivePortalDisplayMode('auto', 1)).toBe('sessions');
  });

  it('auto resolves to programs view for multi-program (and zero-program) pages', () => {
    expect(resolveEffectivePortalDisplayMode('auto', 3)).toBe('programs');
    expect(resolveEffectivePortalDisplayMode('auto', 0)).toBe('programs');
  });

  it('explicit values force either view regardless of program count', () => {
    expect(resolveEffectivePortalDisplayMode('sessions', 5)).toBe('sessions');
    expect(resolveEffectivePortalDisplayMode('programs', 1)).toBe('programs');
  });
});

describe('applyPortalV2PreviewOverrides — ?portalCardStyle=', () => {
  it('overrides the card style from the URL param without mutating the original', () => {
    const config = makeConfig({ portalTemplate: 'v2' });
    const next = applyPortalV2PreviewOverrides(config, { portalCardStyle: 'stacked' });
    expect(next.features.portalCardStyle).toBe('stacked');
    expect(config.features.portalCardStyle).toBeUndefined();
  });

  it('takes the first value for array params and combines with portalTemplate', () => {
    const next = applyPortalV2PreviewOverrides(makeConfig(), {
      portalTemplate: 'v2',
      portalCardStyle: ['rows', 'stacked'],
    });
    expect(next.features.portalTemplate).toBe('v2');
    expect(next.features.portalCardStyle).toBe('rows');
  });

  it('ignores unknown card styles and returns the same object without params', () => {
    const config = makeConfig({ portalCardStyle: 'stacked' });
    expect(applyPortalV2PreviewOverrides(config, {})).toBe(config);
    const next = applyPortalV2PreviewOverrides(config, { portalCardStyle: 'bogus' });
    expect(next.features.portalCardStyle).toBe('stacked');
  });
});

describe('normalizePortalFeatureFields — portalCardStyle / portalDisplayMode persistence', () => {
  it('round-trips camelCase and snake_case values, dropping unknowns', () => {
    expect(
      normalizePortalFeatureFields({ portalCardStyle: 'rows', portalDisplayMode: 'sessions' }),
    ).toMatchObject({ portalCardStyle: 'rows', portalDisplayMode: 'sessions' });
    expect(
      normalizePortalFeatureFields({
        portal_card_style: 'stacked',
        portal_display_mode: 'programs',
      }),
    ).toMatchObject({ portalCardStyle: 'stacked', portalDisplayMode: 'programs' });
    const normalized = normalizePortalFeatureFields({
      portalCardStyle: 'weird',
      portalDisplayMode: 42,
    });
    expect(normalized).not.toHaveProperty('portalCardStyle');
    expect(normalized).not.toHaveProperty('portalDisplayMode');
  });
});

describe('resolvePortalV2SessionRowColumns', () => {
  const coppermineColumns: ScheduleTableColumn[] = [
    'date',
    'time',
    'event',
    'program',
    'location',
    'spots',
    'action',
  ];

  it("keeps the page's configured ordering, dropping event-level columns (time/space) — never fabricated at session level", () => {
    const config = makeConfig({ tableColumns: coppermineColumns });
    expect(resolvePortalV2SessionRowColumns(config)).toEqual([
      'date',
      'event',
      'program',
      'location',
      'spots',
      'action',
    ]);
  });

  it('respects a custom ordering', () => {
    const config = makeConfig({
      tableColumns: ['event', 'spots', 'date', 'action'] as ScheduleTableColumn[],
    });
    expect(resolvePortalV2SessionRowColumns(config)).toEqual([
      'event',
      'spots',
      'date',
      'action',
    ]);
  });

  it('drops spots when showAvailability is off', () => {
    const config = makeConfig({ tableColumns: coppermineColumns, showAvailability: false });
    expect(resolvePortalV2SessionRowColumns(config)).not.toContain('spots');
  });

  it('drops the action column only when registration links are hidden AND pricing is off', () => {
    const hiddenLinks = makeConfig({
      tableColumns: coppermineColumns,
      hideRegistrationLinks: true,
    });
    expect(resolvePortalV2SessionRowColumns(hiddenLinks)).toContain('action');

    const hiddenBoth = makeConfig({
      tableColumns: coppermineColumns,
      hideRegistrationLinks: true,
      showPricing: false,
    });
    expect(resolvePortalV2SessionRowColumns(hiddenBoth)).not.toContain('action');
  });

  it('always includes the session name (event) column', () => {
    const config = makeConfig({ tableColumns: ['date', 'action'] as ScheduleTableColumn[] });
    expect(resolvePortalV2SessionRowColumns(config)[0]).toBe('event');
  });

  it('falls back to the default column set when tableColumns is unset', () => {
    expect(resolvePortalV2SessionRowColumns(makeConfig())).toEqual([
      'date',
      'event',
      'program',
      'location',
      'spots',
      'action',
    ]);
  });

  it('drops program when portalDisplayMode is sessions', () => {
    const config = makeConfig({
      tableColumns: coppermineColumns,
      portalDisplayMode: 'sessions',
    });
    expect(resolvePortalV2SessionRowColumns(config)).toEqual([
      'date',
      'event',
      'location',
      'spots',
      'action',
    ]);
  });
});
