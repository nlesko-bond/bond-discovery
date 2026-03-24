import { describe, it, expect } from 'vitest';
import { getPunchPassRedeemUrl } from '@/lib/punch-pass';
import type { DiscoveryConfig } from '@/types';

const baseConfig = (features: Partial<DiscoveryConfig['features']>): DiscoveryConfig =>
  ({
    id: 't',
    name: 't',
    slug: 't',
    organizationIds: [],
    facilityIds: [],
    branding: { primaryColor: '#000', secondaryColor: '#000', companyName: 't' },
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
    createdAt: '',
    updatedAt: '',
  }) as DiscoveryConfig;

describe('getPunchPassRedeemUrl', () => {
  it('defaults to My Passes URL', () => {
    expect(getPunchPassRedeemUrl(baseConfig({}))).toBe('https://bondsports.co/user/passes');
  });

  it('uses admin override when set', () => {
    expect(
      getPunchPassRedeemUrl(baseConfig({ punchPassRedeemUrl: 'https://example.com/redeem' })),
    ).toBe('https://example.com/redeem');
  });

  it('adds https when scheme omitted', () => {
    expect(getPunchPassRedeemUrl(baseConfig({ punchPassRedeemUrl: 'example.com/p' }))).toBe(
      'https://example.com/p',
    );
  });
});
