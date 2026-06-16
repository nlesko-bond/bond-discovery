import { describe, expect, it } from 'vitest';
import type { Product } from '@/types';
import { resolveProductTieredPricingLabel, resolveSessionTieredPricingLabel } from '@/lib/host-shell/portal-tiered-pricing';

const REFERENCE_DATE = new Date('2026-06-15T12:00:00.000Z');

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Full session',
    prices: [{ id: 'price-1', price: 120, currency: 'USD', name: 'Standard' }],
    ...overrides,
  };
}

describe('resolveProductTieredPricingLabel', () => {
  it('returns early bird copy when earlyBirdEndDate is in the future', () => {
    const product = makeProduct({
      earlyBirdEndDate: '2026-09-15',
      prices: [
        { id: 'eb', price: 99, currency: 'USD', name: 'Early bird' },
        { id: 'std', price: 120, currency: 'USD', name: 'Standard' },
      ],
    });
    expect(resolveProductTieredPricingLabel(product, REFERENCE_DATE)).toBe(
      'Early bird $99 until Sep 15, 2026',
    );
  });

  it('returns late fee copy for a future dated late-fee price tier', () => {
    const product = makeProduct({
      prices: [
        { id: 'std', price: 120, currency: 'USD', name: 'Standard', startDate: '2026-01-01' },
        {
          id: 'late',
          price: 140,
          currency: 'USD',
          name: 'Late fee',
          startDate: '2026-08-01',
        },
      ],
    });
    expect(resolveProductTieredPricingLabel(product, REFERENCE_DATE)).toBe(
      'Late fee $140 from Aug 1',
    );
  });

  it('returns undefined when no tier applies', () => {
    const product = makeProduct({
      earlyBirdEndDate: '2026-01-01',
      prices: [{ id: 'std', price: 120, currency: 'USD', name: 'Standard' }],
    });
    expect(resolveProductTieredPricingLabel(product, REFERENCE_DATE)).toBeUndefined();
  });
});

describe('resolveSessionTieredPricingLabel', () => {
  it('skips member products and uses the first public tier label', () => {
    const products: Product[] = [
      makeProduct({ isMemberProduct: true, earlyBirdEndDate: '2026-12-01', prices: [{ id: 'm', price: 80, currency: 'USD' }] }),
      makeProduct({
        earlyBirdEndDate: '2026-09-15',
        prices: [{ id: 'eb', price: 99, currency: 'USD', name: 'Early bird' }],
      }),
    ];
    expect(resolveSessionTieredPricingLabel(products, REFERENCE_DATE)).toBe(
      'Early bird $99 until Sep 15, 2026',
    );
  });
});
