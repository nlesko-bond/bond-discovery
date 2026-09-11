import { describe, expect, it } from 'vitest';
import type { Product } from '@/types';
import {
  resolveSessionCardPriceLabel,
  resolveSessionCardPriceMode,
} from '@/lib/session-card-price';

function product(id: string, amounts: number[], isMemberProduct = false): Product {
  return {
    id,
    name: `Product ${id}`,
    isMemberProduct,
    prices: amounts.map((amount, index) => ({
      id: `${id}-${index}`,
      price: amount,
      currency: 'USD',
    })),
  } as Product;
}

const single = [product('a', [99.99])];
const several = [product('a', [50, 75]), product('b', [120]), product('c', [0])];
const withMember = [product('a', [100]), product('m', [60], true)];

describe('resolveSessionCardPriceMode', () => {
  it('accepts known modes and falls back to default', () => {
    expect(resolveSessionCardPriceMode('range_excluding_free')).toBe('range_excluding_free');
    expect(resolveSessionCardPriceMode(undefined)).toBe('default');
    expect(resolveSessionCardPriceMode('nope')).toBe('default');
  });
});

describe('resolveSessionCardPriceLabel', () => {
  describe('default (legacy)', () => {
    it('shows the first price of the only product', () => {
      expect(resolveSessionCardPriceLabel(single, 'default')).toBe('$99.99');
    });

    it('shows nothing when the session has several pricing options', () => {
      expect(resolveSessionCardPriceLabel(several, 'default')).toBeUndefined();
    });

    it('shows nothing without products', () => {
      expect(resolveSessionCardPriceLabel([], 'default')).toBeUndefined();
    });
  });

  it('hidden never returns a label', () => {
    expect(resolveSessionCardPriceLabel(single, 'hidden')).toBeUndefined();
    expect(resolveSessionCardPriceLabel(several, 'hidden')).toBeUndefined();
  });

  describe('range', () => {
    it('spans the lowest to highest price across every public option', () => {
      expect(resolveSessionCardPriceLabel(several, 'range')).toBe('FREE – $120');
    });

    it('collapses to a single amount when all prices match', () => {
      expect(resolveSessionCardPriceLabel(single, 'range')).toBe('$99.99');
    });

    it('excludes $0 options in the excluding-free variant', () => {
      expect(resolveSessionCardPriceLabel(several, 'range_excluding_free')).toBe('$50 – $120');
    });

    it('returns nothing when every option is free and free is excluded', () => {
      expect(
        resolveSessionCardPriceLabel([product('f', [0])], 'range_excluding_free'),
      ).toBeUndefined();
    });
  });

  describe('min / max', () => {
    it('prefixes From when there are several distinct prices', () => {
      expect(resolveSessionCardPriceLabel(several, 'min')).toBe('From FREE');
      expect(resolveSessionCardPriceLabel(several, 'min_excluding_free')).toBe('From $50');
    });

    it('prefixes Up to for the maximum', () => {
      expect(resolveSessionCardPriceLabel(several, 'max')).toBe('Up to $120');
    });

    it('drops the prefix when there is only one price', () => {
      expect(resolveSessionCardPriceLabel(single, 'min')).toBe('$99.99');
      expect(resolveSessionCardPriceLabel(single, 'max')).toBe('$99.99');
    });
  });

  it('summaries ignore member products when public ones exist', () => {
    expect(resolveSessionCardPriceLabel(withMember, 'min')).toBe('$100');
    expect(resolveSessionCardPriceLabel(withMember, 'range')).toBe('$100');
  });

  it('summaries fall back to member products when nothing is public', () => {
    expect(resolveSessionCardPriceLabel([product('m', [60], true)], 'range')).toBe('$60');
  });

  it('summaries skip products without usable prices', () => {
    const products = [{ id: 'x', name: 'No prices', prices: [] } as unknown as Product];
    expect(resolveSessionCardPriceLabel(products, 'range')).toBeUndefined();
  });
});
