import type { Product, SessionCardPriceMode } from '@/types';
import { formatPrice } from '@/lib/utils';

const SESSION_CARD_PRICE_MODES: ReadonlySet<SessionCardPriceMode> = new Set<SessionCardPriceMode>([
  'default',
  'hidden',
  'range',
  'max',
  'min',
  'range_excluding_free',
  'min_excluding_free',
]);

/** Unknown or absent stored values fall back to 'default' (legacy behavior). */
export function resolveSessionCardPriceMode(raw: unknown): SessionCardPriceMode {
  return SESSION_CARD_PRICE_MODES.has(raw as SessionCardPriceMode)
    ? (raw as SessionCardPriceMode)
    : 'default';
}

function priceAmounts(products: Product[]): number[] {
  const amounts: number[] = [];
  for (const product of products) {
    for (const price of product.prices ?? []) {
      const value = price.price ?? price.amount;
      if (typeof value === 'number' && Number.isFinite(value)) {
        amounts.push(value);
      }
    }
  }
  return amounts;
}

/**
 * Inline price label for a session card, per `features.sessionCardPriceMode`.
 *
 * - 'default': legacy — the first price of the only product when the session
 *   has exactly one pricing option; nothing when it has several.
 * - 'hidden': never a label (the Pricing options toggle is unaffected).
 * - Summary modes read every price on the session's public (non-member)
 *   products, falling back to all products when none are public. The
 *   `_excluding_free` variants drop $0 prices first.
 *
 * Returns undefined when there is nothing to show. Callers must already have
 * filtered comped products and checked `showPricing`.
 */
export function resolveSessionCardPriceLabel(
  products: Product[],
  mode: SessionCardPriceMode,
): string | undefined {
  if (mode === 'hidden') {
    return undefined;
  }

  if (mode === 'default') {
    if (products.length !== 1) {
      return undefined;
    }
    const first = products[0].prices?.[0];
    const amount = first?.price ?? first?.amount;
    return amount === undefined ? undefined : formatPrice(amount);
  }

  const publicProducts = products.filter((product) => !product.isMemberProduct);
  let amounts = priceAmounts(publicProducts.length > 0 ? publicProducts : products);
  if (mode === 'range_excluding_free' || mode === 'min_excluding_free') {
    amounts = amounts.filter((amount) => amount > 0);
  }
  if (amounts.length === 0) {
    return undefined;
  }

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const single = min === max;

  if (mode === 'range' || mode === 'range_excluding_free') {
    return single ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
  }
  if (mode === 'max') {
    return single ? formatPrice(max) : `Up to ${formatPrice(max)}`;
  }
  // 'min' | 'min_excluding_free'
  return single ? formatPrice(min) : `From ${formatPrice(min)}`;
}
