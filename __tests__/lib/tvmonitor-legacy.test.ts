import { describe, it, expect } from 'vitest';
import { legacyWeatherIconSvg, pickRotatingAsset, toLegacyImageUrl, zonedWallClockDate } from '@/lib/tvmonitor-legacy';
import type { TvMonitorAdAsset } from '@/types/tvmonitor';

function asset(overrides: Partial<TvMonitorAdAsset>): TvMonitorAdAsset {
  return { id: 'a', type: 'image', src: 'https://example.com/a.png', durationSeconds: 10, fit: 'cover', ...overrides };
}

describe('toLegacyImageUrl', () => {
  it('forces PNG delivery for our Cloudinary uploads', () => {
    const url = 'https://res.cloudinary.com/rcenter/image/upload/v1700000000/tvmonitor/org-1/logo.avif';
    expect(toLegacyImageUrl(url)).toBe(
      'https://res.cloudinary.com/rcenter/image/upload/f_png/v1700000000/tvmonitor/org-1/logo.avif',
    );
  });

  it('does not double up the transformation if already present', () => {
    const url = 'https://res.cloudinary.com/rcenter/image/upload/f_png/v1/tvmonitor/logo.avif';
    expect(toLegacyImageUrl(url)).toBe(url);
  });

  it('passes through non-Cloudinary URLs unchanged', () => {
    const url = 'https://partner-site.com/uploads/logo.avif';
    expect(toLegacyImageUrl(url)).toBe(url);
  });

  it('passes through null/empty unchanged', () => {
    expect(toLegacyImageUrl(null)).toBeNull();
    expect(toLegacyImageUrl(undefined)).toBeNull();
    expect(toLegacyImageUrl('')).toBeNull();
  });

  it('is resilient to a malformed URL', () => {
    expect(toLegacyImageUrl('not a url')).toBe('not a url');
  });
});

describe('pickRotatingAsset', () => {
  it('returns null for an empty pool and the only asset for a pool of one', () => {
    expect(pickRotatingAsset([], new Date(0))).toBeNull();
    const only = asset({ id: 'only' });
    expect(pickRotatingAsset([only], new Date(12345))).toBe(only);
  });

  it('picks a duration-weighted slot based on wall-clock time, cycling deterministically', () => {
    const a = asset({ id: 'a', durationSeconds: 10 });
    const b = asset({ id: 'b', durationSeconds: 10 });
    const pool = [a, b];
    // Cycle length is 20s; second 5 falls in a's slot, second 15 in b's.
    expect(pickRotatingAsset(pool, new Date(5_000))).toBe(a);
    expect(pickRotatingAsset(pool, new Date(15_000))).toBe(b);
    // Same time-of-cycle should always resolve to the same asset.
    expect(pickRotatingAsset(pool, new Date(25_000))).toBe(a);
  });
});

describe('zonedWallClockDate', () => {
  it('produces the facility wall-clock time as naive local components', () => {
    const instant = new Date('2026-01-15T23:00:00Z'); // 23:00 UTC, mid-January (MST, UTC-7, no DST)
    const result = zonedWallClockDate(instant, 'America/Denver');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(16); // 23:00 UTC - 7h
    expect(result.getMinutes()).toBe(0);
  });

  it('is directly comparable to a naively-parsed slot time the same way isSlotHappeningNow compares them', () => {
    const slotStart = new Date('2026-01-15T16:00:00');
    const slotEnd = new Date('2026-01-15T17:00:00');
    const instantInsideSlot = new Date('2026-01-15T23:30:00Z'); // 16:30 in Denver
    const zoned = zonedWallClockDate(instantInsideSlot, 'America/Denver');
    expect(zoned >= slotStart && zoned < slotEnd).toBe(true);
  });

  it('falls back to the raw instant for an invalid timezone identifier', () => {
    const instant = new Date('2026-01-15T23:00:00Z');
    expect(zonedWallClockDate(instant, 'Not/ARealZone')).toBe(instant);
  });
});

describe('legacyWeatherIconSvg', () => {
  it('returns a static SVG string (no emoji, no external font dependency) for a range of codes', () => {
    for (const code of [0, 1, 3, 45, 61, 71, 95, 999]) {
      const svg = legacyWeatherIconSvg(code);
      expect(svg).toContain('<svg');
      expect(svg).toMatch(/<\/svg>$/);
      expect(svg).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u);
    }
  });
});
