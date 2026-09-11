import type {
  CardPriceSummaryMode,
  FeatureConfig,
  Product,
  ProgramCardPriceMode,
  SessionCardPriceMode,
} from '@/types';
import { formatPrice } from '@/lib/utils';

const SUMMARY_MODES: ReadonlySet<CardPriceSummaryMode> = new Set<CardPriceSummaryMode>([
  'range',
  'min',
  'max',
]);

/**
 * A price summary split into an optional word and the amount, so the program
 * card can style them separately ("FROM" small caps + "$160" large) while the
 * session card joins them ("From $160"). Both levels use the same words.
 */
export interface ICardPriceSummary {
  /** "From" (min) or "Up to" (max) when prices differ; absent for range / single price. */
  prefix?: 'From' | 'Up to';
  /** "$160" or "$50 – $120". */
  amount: string;
}

/**
 * Summarizes a list of price amounts with the shared program/session wording.
 * The prefix is only used when there is more than one distinct amount, so a
 * single-price session reads "$160" under every mode. Returns undefined when
 * there is nothing to summarize.
 */
export function summarizePriceAmounts(
  amounts: number[],
  mode: CardPriceSummaryMode,
): ICardPriceSummary | undefined {
  if (amounts.length === 0) {
    return undefined;
  }
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (min === max) {
    return { amount: formatPrice(min) };
  }
  if (mode === 'range') {
    return { amount: `${formatPrice(min)} – ${formatPrice(max)}` };
  }
  if (mode === 'max') {
    return { prefix: 'Up to', amount: formatPrice(max) };
  }
  return { prefix: 'From', amount: formatPrice(min) };
}

export function formatCardPriceSummary(summary: ICardPriceSummary): string {
  return summary.prefix ? `${summary.prefix} ${summary.amount}` : summary.amount;
}

/** Unknown or absent stored values fall back to 'default' (legacy behavior). */
export function resolveProgramCardPriceMode(raw: unknown): ProgramCardPriceMode {
  return raw === 'default' || SUMMARY_MODES.has(raw as CardPriceSummaryMode)
    ? (raw as ProgramCardPriceMode)
    : 'default';
}

export interface ISessionCardPriceSettings {
  mode: 'default' | 'hidden' | CardPriceSummaryMode;
  excludeFree: boolean;
}

/**
 * Effective session price settings. Unknown modes fall back to 'default'.
 * The legacy `*_excluding_free` modes map to their base mode with the
 * exclude flag forced on, so pages saved before the flag existed keep
 * rendering the same way.
 */
export function resolveSessionCardPriceSettings(
  features: Pick<FeatureConfig, 'sessionCardPriceMode' | 'sessionCardPriceExcludeFree'>,
): ISessionCardPriceSettings {
  const raw = features.sessionCardPriceMode as SessionCardPriceMode | undefined;
  const excludeFree = features.sessionCardPriceExcludeFree === true;
  if (raw === 'range_excluding_free') {
    return { mode: 'range', excludeFree: true };
  }
  if (raw === 'min_excluding_free') {
    return { mode: 'min', excludeFree: true };
  }
  if (raw === 'default' || raw === 'hidden' || SUMMARY_MODES.has(raw as CardPriceSummaryMode)) {
    return { mode: raw as ISessionCardPriceSettings['mode'], excludeFree };
  }
  return { mode: 'default', excludeFree };
}

/** @deprecated kept for older call sites; prefer resolveSessionCardPriceSettings. */
export function resolveSessionCardPriceMode(raw: unknown): ISessionCardPriceSettings['mode'] {
  return resolveSessionCardPriceSettings({ sessionCardPriceMode: raw as SessionCardPriceMode }).mode;
}

function priceAmounts(products: Product[], excludeFree: boolean): number[] {
  const amounts: number[] = [];
  for (const product of products) {
    for (const price of product.prices ?? []) {
      const value = price.price ?? price.amount;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (excludeFree && value <= 0) continue;
      amounts.push(value);
    }
  }
  return amounts;
}

/**
 * Inline price label for a session card.
 *
 * - 'default': legacy — the first price of the only product when the session
 *   has exactly one pricing option, nothing when it has several.
 * - 'hidden': never a label (the Pricing options toggle is unaffected).
 * - Summary modes read every price on the session's public (non-member)
 *   products, falling back to all products when none are public.
 *   `excludeFree` drops $0 prices first.
 *
 * Returns undefined when there is nothing to show. Callers must already have
 * filtered comped products and checked session pricing is on.
 */
export function resolveSessionCardPriceLabel(
  products: Product[],
  mode: SessionCardPriceMode,
  excludeFree = false,
): string | undefined {
  const settings = resolveSessionCardPriceSettings({
    sessionCardPriceMode: mode,
    sessionCardPriceExcludeFree: excludeFree,
  });

  if (settings.mode === 'hidden') {
    return undefined;
  }

  if (settings.mode === 'default') {
    if (products.length !== 1) {
      return undefined;
    }
    const first = products[0].prices?.[0];
    const amount = first?.price ?? first?.amount;
    if (amount === undefined) return undefined;
    if (settings.excludeFree && amount <= 0) return undefined;
    return formatPrice(amount);
  }

  const publicProducts = products.filter((product) => !product.isMemberProduct);
  const amounts = priceAmounts(
    publicProducts.length > 0 ? publicProducts : products,
    settings.excludeFree,
  );
  const summary = summarizePriceAmounts(amounts, settings.mode);
  return summary ? formatCardPriceSummary(summary) : undefined;
}
