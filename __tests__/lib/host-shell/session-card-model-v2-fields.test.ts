import { describe, expect, it } from 'vitest';
import type { DiscoveryConfig, Program } from '@/types';
import { buildHostPortalSessionCards } from '@/lib/host-shell/session-card-model';
import { normalizePortalFeatureFields } from '@/lib/host-shell/portal-feature-config';

/**
 * Additive visual-only fields for the v2 template (plan 009). Existing card
 * fields are pinned by session-card-model.test.ts and stay untouched.
 */

const config = {
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
  },
  allowedParams: [],
  defaultParams: {},
  cacheTtl: 300,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} as unknown as DiscoveryConfig;

describe('v2 additive card-model fields', () => {
  it('maps program-level image, capacity, and member-product flags', () => {
    const programs = [
      {
        id: 'prog-1',
        name: 'Soccer',
        imageUrl: 'https://cdn.example.com/fallback.jpg',
        mainMedia: { id: 1, url: 'https://cdn.example.com/main.jpg' },
        sessions: [
          {
            id: 's1',
            programId: 'prog-1',
            linkSEO: 'https://bondsports.co/programs/prog-1/session/s1',
            spotsRemaining: 4,
            isFull: false,
            products: [
              {
                id: 'p-pub',
                name: 'Standard',
                prices: [{ id: 'pr1', price: 30, currency: 'USD' }],
              },
              {
                id: 'p-mem',
                name: 'Member rate',
                isMemberProduct: true,
                prices: [{ id: 'pr2', price: 24, currency: 'USD' }],
              },
            ],
          },
        ],
      },
    ] as unknown as Program[];

    const [card] = buildHostPortalSessionCards(programs, config);
    expect(card.imageUrl).toBe('https://cdn.example.com/main.jpg');
    expect(card.spotsRemaining).toBe(4);
    expect(card.isFull).toBe(false);
    expect(card.products.find((p) => p.id === 'p-mem')?.isMemberProduct).toBe(true);
    expect(card.products.find((p) => p.id === 'p-pub')?.isMemberProduct).toBeUndefined();
  });

  it('falls back to program.imageUrl and leaves fields undefined when absent', () => {
    const programs = [
      {
        id: 'prog-1',
        name: 'Soccer',
        imageUrl: 'https://cdn.example.com/fallback.jpg',
        sessions: [{ id: 's1', programId: 'prog-1' }],
      },
      {
        id: 'prog-2',
        name: 'Hockey',
        sessions: [{ id: 's2', programId: 'prog-2' }],
      },
    ] as unknown as Program[];

    const cards = buildHostPortalSessionCards(programs, config);
    expect(cards[0].imageUrl).toBe('https://cdn.example.com/fallback.jpg');
    expect(cards[1].imageUrl).toBeUndefined();
    expect(cards[1].spotsRemaining).toBeUndefined();
    expect(cards[1].isFull).toBeUndefined();
  });
});

describe('normalizePortalFeatureFields — v2 flags', () => {
  it('reads camelCase and snake_case v2 keys', () => {
    expect(
      normalizePortalFeatureFields({
        portal_template: 'v2',
        portal_card_min_width: '260',
        member_pricing_style: 'badge',
      }),
    ).toEqual({
      portalTemplate: 'v2',
      portalCardMinWidth: 260,
      memberPricingStyle: 'badge',
    });
    expect(
      normalizePortalFeatureFields({
        portalTemplate: 'current',
        portalCardMinWidth: 240,
        memberPricingStyle: 'inline',
      }),
    ).toEqual({
      portalTemplate: 'current',
      portalCardMinWidth: 240,
      memberPricingStyle: 'inline',
    });
  });

  it('drops unknown or invalid v2 values', () => {
    expect(
      normalizePortalFeatureFields({
        portalTemplate: 'v3',
        portalCardMinWidth: -10,
        memberPricingStyle: 'rainbow',
      }),
    ).toEqual({});
  });
});
