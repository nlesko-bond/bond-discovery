import { describe, expect, it } from 'vitest';
import type { Product } from '@/types';
import {
  formatCardPriceSummary,
  resolveProgramCardPriceMode,
  resolveSessionCardPriceLabel,
  resolveSessionCardPriceMode,
  resolveSessionCardPriceSettings,
  summarizePriceAmounts,
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

describe('summarizePriceAmounts (shared program/session wording)', () => {
  it('returns nothing for no amounts', () => {
    expect(summarizePriceAmounts([], 'range')).toBeUndefined();
  });

  it('drops the prefix when every price is the same, in every mode', () => {
    expect(summarizePriceAmounts([160, 160], 'range')).toEqual({ amount: '$160' });
    expect(summarizePriceAmounts([160], 'min')).toEqual({ amount: '$160' });
    expect(summarizePriceAmounts([160], 'max')).toEqual({ amount: '$160' });
  });

  it('uses range / From / Up to when prices differ', () => {
    expect(summarizePriceAmounts([50, 120], 'range')).toEqual({ amount: '$50 – $120' });
    expect(summarizePriceAmounts([50, 120], 'min')).toEqual({ prefix: 'From', amount: '$50' });
    expect(summarizePriceAmounts([50, 120], 'max')).toEqual({ prefix: 'Up to', amount: '$120' });
  });

  it('formats prefix + amount as one label', () => {
    expect(formatCardPriceSummary({ prefix: 'From', amount: '$50' })).toBe('From $50');
    expect(formatCardPriceSummary({ amount: '$50 – $120' })).toBe('$50 – $120');
  });
});

describe('resolveProgramCardPriceMode', () => {
  it('accepts summary modes and falls back to default', () => {
    expect(resolveProgramCardPriceMode('range')).toBe('range');
    expect(resolveProgramCardPriceMode('max')).toBe('max');
    expect(resolveProgramCardPriceMode(undefined)).toBe('default');
    expect(resolveProgramCardPriceMode('hidden')).toBe('default');
  });
});

describe('resolveSessionCardPriceSettings', () => {
  it('reads mode and exclude flag, falling back to default', () => {
    expect(resolveSessionCardPriceSettings({})).toEqual({ mode: 'default', excludeFree: false });
    expect(
      resolveSessionCardPriceSettings({ sessionCardPriceMode: 'max', sessionCardPriceExcludeFree: true }),
    ).toEqual({ mode: 'max', excludeFree: true });
    expect(resolveSessionCardPriceSettings({ sessionCardPriceMode: 'nope' as never })).toEqual({
      mode: 'default',
      excludeFree: false,
    });
  });

  it('maps the legacy excluding-free modes onto mode + flag', () => {
    expect(resolveSessionCardPriceSettings({ sessionCardPriceMode: 'range_excluding_free' })).toEqual({
      mode: 'range',
      excludeFree: true,
    });
    expect(resolveSessionCardPriceSettings({ sessionCardPriceMode: 'min_excluding_free' })).toEqual({
      mode: 'min',
      excludeFree: true,
    });
    expect(resolveSessionCardPriceMode('min_excluding_free')).toBe('min');
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

    it('hides a lone $0 price when free is excluded', () => {
      expect(resolveSessionCardPriceLabel([product('f', [0])], 'default')).toBe('FREE');
      expect(resolveSessionCardPriceLabel([product('f', [0])], 'default', true)).toBeUndefined();
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

    it('excludes $0 options with the flag or the legacy mode', () => {
      expect(resolveSessionCardPriceLabel(several, 'range', true)).toBe('$50 – $120');
      expect(resolveSessionCardPriceLabel(several, 'range_excluding_free')).toBe('$50 – $120');
    });

    it('returns nothing when every option is free and free is excluded', () => {
      expect(resolveSessionCardPriceLabel([product('f', [0])], 'range', true)).toBeUndefined();
    });
  });

  describe('min / max', () => {
    it('prefixes From when there are several distinct prices', () => {
      expect(resolveSessionCardPriceLabel(several, 'min')).toBe('From FREE');
      expect(resolveSessionCardPriceLabel(several, 'min', true)).toBe('From $50');
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
