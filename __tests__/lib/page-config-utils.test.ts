import { describe, expect, it } from 'vitest';
import {
  buildNextTableColumns,
  formatRelativeTime,
  getActiveTableColumns,
  parseCommaSeparatedIds,
  parseOriginsList,
} from '@/app/admin/pages/[slug]/page-config-utils';
import type { IPageConfig } from '@/app/admin/pages/[slug]/page-config-types';

function makeConfig(features: Partial<IPageConfig['features']> = {}): IPageConfig {
  return {
    id: 'test',
    name: 'Test',
    slug: 'test',
    branding: { companyName: 'Test', primaryColor: '#000', secondaryColor: '#111' },
    organizationIds: ['1'],
    features: {
      showPricing: true,
      showAvailability: true,
      showMembershipBadges: false,
      showAgeGender: false,
      enableFilters: [],
      defaultView: 'programs',
      allowViewToggle: true,
      ...features,
    },
  };
}

describe('parseCommaSeparatedIds', () => {
  it('splits, trims, and drops empties', () => {
    expect(parseCommaSeparatedIds(' 1, 2 ,, 3 ')).toEqual(['1', '2', '3']);
    expect(parseCommaSeparatedIds('')).toEqual([]);
  });
});

describe('parseOriginsList', () => {
  it('accepts newline and comma separators and dedupes', () => {
    expect(
      parseOriginsList('https://a.com\nhttps://b.com, https://a.com\n'),
    ).toEqual(['https://a.com', 'https://b.com']);
    expect(parseOriginsList('')).toEqual([]);
  });
});

describe('table column helpers', () => {
  it('falls back to all columns when none are configured', () => {
    expect(getActiveTableColumns(makeConfig())).toEqual([
      'date',
      'time',
      'event',
      'program',
      'location',
      'space',
      'spots',
      'action',
    ]);
  });

  it('preserves canonical column order regardless of toggle order', () => {
    const next = buildNextTableColumns(makeConfig(), ['action', 'date', 'time']);
    expect(next.features.tableColumns).toEqual(['date', 'time', 'action']);
  });

  it('returns configured columns when present', () => {
    const config = makeConfig({ tableColumns: ['date', 'event'] });
    expect(getActiveTableColumns(config)).toEqual(['date', 'event']);
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-06-10T12:00:00Z');

  it('returns null for missing or invalid input', () => {
    expect(formatRelativeTime(null, now)).toBeNull();
    expect(formatRelativeTime(undefined, now)).toBeNull();
    expect(formatRelativeTime('', now)).toBeNull();
    expect(formatRelativeTime('not-a-date', now)).toBeNull();
  });

  it('formats minutes, hours, and days', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 60_000, now)).toBe('1 minute ago');
    expect(formatRelativeTime(now - 14 * 60_000, now)).toBe('14 minutes ago');
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe('2 hours ago');
    expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe('3 days ago');
  });

  it('accepts ISO strings (cron lastRun.at) and clamps future timestamps', () => {
    expect(formatRelativeTime('2026-06-10T11:45:00Z', now)).toBe('15 minutes ago');
    expect(formatRelativeTime(now + 60_000, now)).toBe('just now');
  });
});
