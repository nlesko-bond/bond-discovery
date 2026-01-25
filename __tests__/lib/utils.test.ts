import { describe, it, expect } from 'vitest';
import {
  cn,
  formatPrice,
  formatDate,
  formatTime,
  formatDateRange,
  formatAgeRange,
  getProgramTypeLabel,
  getSportLabel,
  getGenderLabel,
  getAvailabilityInfo,
  getSportGradient,
  parseOrgIds,
  buildUrl,
  truncate,
  buildRegistrationUrl,
} from '@/lib/utils';

describe('cn (classnames utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });
});

describe('formatPrice', () => {
  it('formats zero as FREE', () => {
    expect(formatPrice(0)).toBe('FREE');
  });

  it('formats whole numbers without decimals', () => {
    expect(formatPrice(100)).toBe('$100');
    expect(formatPrice(1000)).toBe('$1,000');
  });

  it('formats decimal amounts', () => {
    expect(formatPrice(99.99)).toBe('$99.99');
    // Note: minimumFractionDigits: 0 means trailing zeros aren't added
    expect(formatPrice(10.5)).toBe('$10.5');
  });

  it('uses USD by default', () => {
    expect(formatPrice(50)).toContain('$');
  });
});

describe('formatDate', () => {
  it('formats ISO date strings', () => {
    expect(formatDate('2026-01-15')).toBe('Jan 15, 2026');
    expect(formatDate('2026-12-25')).toBe('Dec 25, 2026');
  });

  it('uses custom format string', () => {
    expect(formatDate('2026-01-15', 'yyyy-MM-dd')).toBe('2026-01-15');
    expect(formatDate('2026-01-15', 'MMMM d')).toBe('January 15');
  });

  it('returns original string for invalid dates', () => {
    expect(formatDate('invalid')).toBe('invalid');
  });
});

describe('formatTime', () => {
  it('formats ISO datetime with timezone conversion', () => {
    // 15:00 UTC = 9:00 AM Central (America/Chicago is UTC-6 in winter)
    const result = formatTime('2026-01-25T15:00:00.000Z', 'America/Chicago');
    expect(result).toBe('9:00 AM');
  });

  it('formats ISO datetime in Eastern timezone', () => {
    // 15:00 UTC = 10:00 AM Eastern (America/New_York is UTC-5 in winter)
    const result = formatTime('2026-01-25T15:00:00.000Z', 'America/New_York');
    expect(result).toBe('10:00 AM');
  });

  it('formats ISO datetime strings without timezone (fallback)', () => {
    // Without timezone, falls back to local timezone
    const result = formatTime('2026-01-15T14:30:00.000Z');
    expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/); // Just verify format
  });

  it('formats HH:mm:ss format', () => {
    expect(formatTime('14:30:00')).toBe('2:30 PM');
    expect(formatTime('09:00:00')).toBe('9:00 AM');
  });

  it('formats HH:mm format', () => {
    expect(formatTime('14:30')).toBe('2:30 PM');
    expect(formatTime('09:00')).toBe('9:00 AM');
  });

  it('returns empty string for undefined', () => {
    expect(formatTime(undefined)).toBe('');
  });
});

describe('formatDateRange', () => {
  it('formats same day as single date', () => {
    expect(formatDateRange('2026-01-15', '2026-01-15')).toBe('Jan 15, 2026');
  });

  it('formats same year with abbreviated format', () => {
    expect(formatDateRange('2026-01-15', '2026-03-20')).toBe('Jan 15 - Mar 20, 2026');
  });

  it('formats different years with full format', () => {
    expect(formatDateRange('2025-12-15', '2026-01-15')).toBe('Dec 15, 2025 - Jan 15, 2026');
  });
});

describe('formatAgeRange', () => {
  it('formats min and max', () => {
    expect(formatAgeRange(5, 12)).toBe('Ages 5-12');
  });

  it('formats min only (no max)', () => {
    expect(formatAgeRange(18, undefined)).toBe('Ages 18+');
  });

  it('formats max only (no min)', () => {
    expect(formatAgeRange(undefined, 17)).toBe('Ages up to 17');
  });

  it('returns empty string for no range', () => {
    expect(formatAgeRange(undefined, undefined)).toBe('');
  });

  it('treats high max ages as unlimited', () => {
    expect(formatAgeRange(5, 100)).toBe('Ages 5+');
    expect(formatAgeRange(5, 999)).toBe('Ages 5+');
  });
});

describe('getProgramTypeLabel', () => {
  it('returns correct labels for program types', () => {
    expect(getProgramTypeLabel('class')).toBe('Class');
    expect(getProgramTypeLabel('clinic')).toBe('Clinic');
    expect(getProgramTypeLabel('camp')).toBe('Camp');
    expect(getProgramTypeLabel('lesson')).toBe('Lesson');
    expect(getProgramTypeLabel('league')).toBe('League');
    expect(getProgramTypeLabel('tournament')).toBe('Tournament');
    expect(getProgramTypeLabel('club_team')).toBe('Club Team');
    expect(getProgramTypeLabel('drop_in')).toBe('Drop-In');
    expect(getProgramTypeLabel('rental')).toBe('Rental');
  });

  it('returns original value for unknown types', () => {
    expect(getProgramTypeLabel('unknown')).toBe('unknown');
  });

  it('returns Program for undefined', () => {
    expect(getProgramTypeLabel(undefined)).toBe('Program');
  });
});

describe('getSportLabel', () => {
  it('capitalizes sport names', () => {
    expect(getSportLabel('soccer')).toBe('Soccer');
    expect(getSportLabel('BASKETBALL')).toBe('Basketball');
    expect(getSportLabel('Tennis')).toBe('Tennis');
  });

  it('returns empty string for undefined', () => {
    expect(getSportLabel(undefined)).toBe('');
  });
});

describe('getGenderLabel', () => {
  it('returns correct labels', () => {
    expect(getGenderLabel('male')).toBe('Boys/Men');
    expect(getGenderLabel('female')).toBe('Girls/Women');
    expect(getGenderLabel('coed')).toBe('Coed');
    expect(getGenderLabel('all')).toBe('All Genders');
  });

  it('returns All Genders for undefined', () => {
    expect(getGenderLabel(undefined)).toBe('All Genders');
  });
});

describe('getAvailabilityInfo', () => {
  it('returns Full when no spots remaining', () => {
    const result = getAvailabilityInfo(0, 20);
    expect(result.label).toBe('Full');
    expect(result.color).toBe('red');
  });

  it('returns red when >90% full', () => {
    const result = getAvailabilityInfo(2, 20);
    expect(result.label).toBe('2 spots left');
    expect(result.color).toBe('red');
  });

  it('returns yellow when 70-90% full', () => {
    const result = getAvailabilityInfo(5, 20);
    expect(result.label).toBe('5 spots left');
    expect(result.color).toBe('yellow');
  });

  it('returns Available when plenty of spots', () => {
    const result = getAvailabilityInfo(15, 20);
    expect(result.label).toBe('Available');
    expect(result.color).toBe('green');
  });

  it('handles 1 spot singular', () => {
    const result = getAvailabilityInfo(1, 20);
    expect(result.label).toBe('1 spot left');
  });

  it('returns empty for undefined values', () => {
    expect(getAvailabilityInfo(undefined, undefined)).toEqual({ label: '', color: 'gray' });
  });
});

describe('getSportGradient', () => {
  it('returns correct gradient classes', () => {
    expect(getSportGradient('soccer')).toBe('gradient-soccer');
    expect(getSportGradient('basketball')).toBe('gradient-basketball');
  });

  it('returns default gradient for unknown sports', () => {
    expect(getSportGradient('curling')).toBe('gradient-default');
    expect(getSportGradient(undefined)).toBe('gradient-default');
  });

  it('handles case insensitive matching', () => {
    expect(getSportGradient('SOCCER')).toBe('gradient-soccer');
  });
});

describe('parseOrgIds', () => {
  it('parses underscore-separated IDs', () => {
    expect(parseOrgIds('1_2_3')).toEqual(['1', '2', '3']);
  });

  it('parses comma-separated IDs', () => {
    expect(parseOrgIds('1,2,3')).toEqual(['1', '2', '3']);
  });

  it('handles mixed separators', () => {
    expect(parseOrgIds('1_2,3_4')).toEqual(['1', '2', '3', '4']);
  });

  it('returns empty array for undefined', () => {
    expect(parseOrgIds(undefined)).toEqual([]);
  });
});

describe('buildUrl', () => {
  it('adds params to URL', () => {
    const result = buildUrl('/test', { foo: 'bar' });
    expect(result).toBe('/test?foo=bar');
  });

  it('handles array params with underscore separator', () => {
    const result = buildUrl('/test', { ids: ['1', '2', '3'] });
    expect(result).toBe('/test?ids=1_2_3');
  });

  it('skips undefined and null values', () => {
    const result = buildUrl('/test', { foo: 'bar', baz: undefined, qux: null });
    expect(result).toBe('/test?foo=bar');
  });

  it('skips empty arrays', () => {
    const result = buildUrl('/test', { foo: 'bar', ids: [] });
    expect(result).toBe('/test?foo=bar');
  });
});

describe('truncate', () => {
  it('truncates long text with ellipsis', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
  });

  it('returns original text if short enough', () => {
    expect(truncate('Hi', 10)).toBe('Hi');
    expect(truncate('Hello', 5)).toBe('Hello');
  });
});

describe('buildRegistrationUrl', () => {
  it('adds skipToProducts param by default', () => {
    const result = buildRegistrationUrl('https://example.com/register');
    expect(result).toContain('skipToProducts=true');
  });

  it('adds productId when provided', () => {
    const result = buildRegistrationUrl('https://example.com/register', { productId: '123' });
    expect(result).toContain('productId=123');
    expect(result).toContain('skipToProducts=true');
  });

  it('handles URLs with existing params', () => {
    const result = buildRegistrationUrl('https://example.com/register?foo=bar');
    expect(result).toContain('skipToProducts=true');
    expect(result).toContain('foo=bar');
  });

  it('returns undefined for undefined input', () => {
    expect(buildRegistrationUrl(undefined)).toBeUndefined();
  });

  it('returns plain URL when registration is closed', () => {
    const result = buildRegistrationUrl('https://example.com/register', { isRegistrationOpen: false });
    expect(result).toBe('https://example.com/register');
    expect(result).not.toContain('skipToProducts');
  });

  it('returns plain URL without productId when registration is closed', () => {
    const result = buildRegistrationUrl('https://example.com/register', { productId: '123', isRegistrationOpen: false });
    expect(result).toBe('https://example.com/register');
    expect(result).not.toContain('productId');
    expect(result).not.toContain('skipToProducts');
  });

  it('adds params when registration is explicitly open', () => {
    const result = buildRegistrationUrl('https://example.com/register', { isRegistrationOpen: true });
    expect(result).toContain('skipToProducts=true');
  });
});
