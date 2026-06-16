import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DiscoveryConfig } from '@/types';

const mockGetConfigBySlug = vi.fn();

vi.mock('@/lib/config', () => ({
  getConfigBySlug: (...args: unknown[]) => mockGetConfigBySlug(...args),
}));

vi.mock('@/lib/discovery-precomputed-events', () => ({
  getPrecomputedDiscoveryEvents: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/discovery-events', () => ({
  getDiscoveryEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  filterEventsForResponse: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/availability-cache', () => ({
  getAvailabilityPayload: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/discovery-zero-events-alert', () => ({
  maybeAlertZeroDiscoveryEvents: vi.fn(),
}));

vi.mock('@/lib/bond-client', () => ({
  getBondApiStats: vi.fn().mockResolvedValue({}),
}));

import { GET, OPTIONS } from '@/app/api/events/route';

function makeConfig(allowedOrigins?: string[]): DiscoveryConfig {
  return {
    id: '1',
    name: 'Coppermine',
    slug: 'coppermine',
    organizationIds: ['1'],
    facilityIds: [],
    branding: {
      primaryColor: '#000',
      secondaryColor: '#111',
      companyName: 'Coppermine',
    },
    features: {
      showPricing: true,
      showAvailability: true,
      showMembershipBadges: false,
      showAgeGender: false,
      enableFilters: ['search'],
      defaultView: 'programs',
      allowViewToggle: true,
      embedAllowedOrigins: allowedOrigins,
    },
    allowedParams: [],
    defaultParams: {},
    cacheTtl: 300,
    createdAt: '',
    updatedAt: '',
  };
}

describe('/api/events CORS after embed-kit removal', () => {
  beforeEach(() => {
    mockGetConfigBySlug.mockReset();
  });

  it('OPTIONS echoes allowed partner Origin via embedAllowedOrigins', async () => {
    mockGetConfigBySlug.mockResolvedValue(makeConfig(['https://partner.example']));
    const response = await OPTIONS(
      new NextRequest('http://localhost/api/events?slug=coppermine', {
        headers: { Origin: 'https://partner.example' },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://partner.example');
  });

  it('GET returns 403 for a disallowed browser Origin when allowlist is set', async () => {
    mockGetConfigBySlug.mockResolvedValue(makeConfig(['https://partner.example']));
    const response = await GET(
      new NextRequest('http://localhost/api/events?slug=coppermine', {
        headers: { Origin: 'https://evil.example' },
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://evil.example');
  });

  it('GET allows a listed Origin to proceed past the CORS gate', async () => {
    mockGetConfigBySlug.mockResolvedValue(makeConfig(['https://partner.example']));
    const response = await GET(
      new NextRequest('http://localhost/api/events?slug=coppermine', {
        headers: { Origin: 'https://partner.example' },
      }),
    );
    expect(response.status).not.toBe(403);
  });
});
