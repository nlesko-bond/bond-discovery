import type { Price, Product } from '@/types';
import { formatPrice } from '@/lib/utils';

const EARLY_BIRD_NAME_PATTERN = /early\s*bird/i;
const LATE_FEE_NAME_PATTERN = /late\s*fee|late\s*registration/i;

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? `${value.trim()}T12:00:00.000Z`
    : value.trim();
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatTierDeadline(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTierStart(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function priceAmount(price: Price): number | undefined {
  const value = price.price ?? price.amount;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isPriceActive(price: Price, referenceDate: Date): boolean {
  const start = parseIsoDate(price.startDate ?? price.validFrom);
  const end = parseIsoDate(price.endDate ?? price.validUntil);
  if (start && referenceDate < start) {
    return false;
  }
  if (end && referenceDate > end) {
    return false;
  }
  return true;
}

function pickLowestAmount(prices: Price[]): number | undefined {
  const amounts = prices
    .map(priceAmount)
    .filter((amount): amount is number => amount !== undefined);
  if (amounts.length === 0) {
    return undefined;
  }
  return Math.min(...amounts);
}

function formatTierAmount(amount: number): string {
  return formatPrice(amount, 'USD', { minimumFractionDigits: 0 });
}

function resolveEarlyBirdLabel(product: Product, referenceDate: Date): string | undefined {
  const earlyBirdEnd = parseIsoDate(product.earlyBirdEndDate);
  if (!earlyBirdEnd || referenceDate >= earlyBirdEnd) {
    return undefined;
  }

  const earlyPrices = product.prices.filter(
    (price) => isPriceActive(price, referenceDate) && EARLY_BIRD_NAME_PATTERN.test(price.name ?? ''),
  );
  const activePrices = product.prices.filter((price) => isPriceActive(price, referenceDate));
  const amount =
    pickLowestAmount(earlyPrices.length > 0 ? earlyPrices : activePrices) ??
    pickLowestAmount(product.prices);

  if (amount === undefined) {
    return undefined;
  }

  return `Early bird ${formatTierAmount(amount)} until ${formatTierDeadline(earlyBirdEnd)}`;
}

function resolveLateFeeLabel(product: Product, referenceDate: Date): string | undefined {
  const futurePrices = product.prices.filter((price) => {
    const start = parseIsoDate(price.startDate ?? price.validFrom);
    if (!start || start <= referenceDate) {
      return false;
    }
    return (
      LATE_FEE_NAME_PATTERN.test(price.name ?? '') ||
      LATE_FEE_NAME_PATTERN.test(price.description ?? '')
    );
  });

  const latePrice = futurePrices.sort((left, right) => {
    const leftStart = parseIsoDate(left.startDate ?? left.validFrom)?.getTime() ?? 0;
    const rightStart = parseIsoDate(right.startDate ?? right.validFrom)?.getTime() ?? 0;
    return leftStart - rightStart;
  })[0];

  if (!latePrice) {
    return undefined;
  }

  const amount = priceAmount(latePrice);
  const start = parseIsoDate(latePrice.startDate ?? latePrice.validFrom);
  if (amount === undefined || !start) {
    return undefined;
  }

  return `Late fee ${formatTierAmount(amount)} from ${formatTierStart(start)}`;
}

/**
 * Returns a human-readable early-bird or upcoming late-fee label for session pricing.
 */
export function resolveProductTieredPricingLabel(
  product: Product,
  referenceDate: Date = new Date(),
): string | undefined {
  return (
    resolveEarlyBirdLabel(product, referenceDate) ??
    resolveLateFeeLabel(product, referenceDate)
  );
}

/**
 * Picks the first tiered-pricing label from a session's public (non-member) products.
 */
export function resolveSessionTieredPricingLabel(
  products: Product[],
  referenceDate: Date = new Date(),
): string | undefined {
  for (const product of products) {
    if (product.isMemberProduct) {
      continue;
    }
    const label = resolveProductTieredPricingLabel(product, referenceDate);
    if (label) {
      return label;
    }
  }
  return undefined;
}
