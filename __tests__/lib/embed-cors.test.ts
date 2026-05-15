import { describe, expect, it } from 'vitest';
import {
  embedKitCorsHeaders,
  isEmbedKitBrowserRequestAllowed,
} from '@/lib/embed-cors';
import type { DiscoveryConfig } from '@/types';

function cfg(allowed?: string[]): DiscoveryConfig {
  return {
    id: '1',
    name: 'Test',
    slug: 'test',
    organizationIds: ['1'],
    facilityIds: [],
    branding: {
      primaryColor: '#000',
      secondaryColor: '#111',
      companyName: 'Test',
    },
    features: {
      showPricing: true,
      showAvailability: true,
      showMembershipBadges: false,
      showAgeGender: false,
      enableFilters: ['search'],
      defaultView: 'programs',
      allowViewToggle: true,
      embedAllowedOrigins: allowed,
    },
    allowedParams: [],
    defaultParams: {},
    cacheTtl: 300,
    createdAt: '',
    updatedAt: '',
  };
}

describe('embed-cors', () => {
  it('allows any origin when embedAllowedOrigins is unset', () => {
    const request = new Request('https://api.example.com/x', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(isEmbedKitBrowserRequestAllowed(request, cfg(undefined))).toBe(true);
    expect(embedKitCorsHeaders(request, cfg(undefined))['Access-Control-Allow-Origin']).toBe('*');
  });

  it('allows missing Origin when allowlist is set', () => {
    const request = new Request('https://api.example.com/x');
    expect(isEmbedKitBrowserRequestAllowed(request, cfg(['https://a.com']))).toBe(true);
  });

  it('allows listed Origin', () => {
    const request = new Request('https://api.example.com/x', {
      headers: { Origin: 'https://webflow.io' },
    });
    const c = cfg(['https://webflow.io']);
    expect(isEmbedKitBrowserRequestAllowed(request, c)).toBe(true);
    expect(embedKitCorsHeaders(request, c)['Access-Control-Allow-Origin']).toBe('https://webflow.io');
  });

  it('denies unlisted Origin', () => {
    const request = new Request('https://api.example.com/x', {
      headers: { Origin: 'https://evil.example' },
    });
    const c = cfg(['https://webflow.io']);
    expect(isEmbedKitBrowserRequestAllowed(request, c)).toBe(false);
    expect(embedKitCorsHeaders(request, c)['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
