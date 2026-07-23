import type { DiscoveryConfig } from '@/types';
import { HostPortalLayoutEnum } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import { PortalSessionSortEnum } from '@/types';
import { getSportLabel } from '@/lib/utils';

const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MIN_PORTAL_EVENT_HORIZON_MONTHS = 3;
const MAX_PORTAL_EVENT_HORIZON_MONTHS = 18;
const PORTAL_EVENT_HORIZON_BUFFER_MONTHS = 1;
const PORTAL_AGE_SLIDER_MIN = 0;
const PORTAL_AGE_SLIDER_DEFAULT_MAX = 18;

export interface IPortalHeroMetadata {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function computeSessionWeekCount(
  startDate: string | undefined,
  endDate: string | undefined,
): number | undefined {
  if (!startDate || !endDate) {
    return undefined;
  }
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return undefined;
  }
  return Math.max(1, Math.ceil((endMs - startMs) / MILLISECONDS_PER_WEEK));
}

export function derivePortalAgeBounds(cards: IHostPortalSessionCardModel[]): {
  min: number;
  max: number;
} {
  let dataMax = Number.NEGATIVE_INFINITY;

  cards.forEach((card) => {
    if (card.ageMax !== undefined) {
      dataMax = Math.max(dataMax, card.ageMax);
    }
  });

  if (!Number.isFinite(dataMax)) {
    return { min: PORTAL_AGE_SLIDER_MIN, max: PORTAL_AGE_SLIDER_DEFAULT_MAX };
  }

  return {
    min: PORTAL_AGE_SLIDER_MIN,
    max: Math.ceil(dataMax),
  };
}

/**
 * Extends the events API horizon so portal list rows include class times for
 * sessions that start beyond the default 3-month discovery window.
 */
export function derivePortalEventHorizonMonths(
  cards: IHostPortalSessionCardModel[],
): number {
  const now = new Date();
  let latestEndMs = now.getTime();

  cards.forEach((card) => {
    if (!card.endDate) {
      return;
    }
    const endMs = new Date(card.endDate).getTime();
    if (!Number.isNaN(endMs) && endMs > latestEndMs) {
      latestEndMs = endMs;
    }
  });

  const latestEnd = new Date(latestEndMs);
  const monthSpan =
    (latestEnd.getFullYear() - now.getFullYear()) * 12 +
    (latestEnd.getMonth() - now.getMonth()) +
    PORTAL_EVENT_HORIZON_BUFFER_MONTHS;

  return Math.min(
    MAX_PORTAL_EVENT_HORIZON_MONTHS,
    Math.max(MIN_PORTAL_EVENT_HORIZON_MONTHS, monthSpan),
  );
}

function formatHeroMonthRange(cards: IHostPortalSessionCardModel[]): string | undefined {
  const starts: number[] = [];
  const ends: number[] = [];
  cards.forEach((card) => {
    const match = card.dateRange?.match(/([A-Za-z]{3})\s+\d+/g);
    if (!match || match.length === 0) {
      return;
    }
    const firstToken = match[0];
    const lastToken = match[match.length - 1];
    const yearMatch = card.dateRange?.match(/\d{4}/g);
    const year = yearMatch?.[yearMatch.length - 1] ?? '';
    if (firstToken && lastToken) {
      starts.push(Date.parse(`${firstToken} 1, ${year || '2026'}`));
      ends.push(Date.parse(`${lastToken} 28, ${year || '2026'}`));
    }
  });
  if (starts.length === 0) {
    return undefined;
  }
  const minDate = new Date(Math.min(...starts));
  const maxDate = new Date(Math.max(...ends));
  const fmt = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const year = maxDate.getFullYear();
  return `${fmt(minDate)}–${fmt(maxDate)} ${year}`;
}

export function buildPortalHeroMetadata(
  config: DiscoveryConfig,
  cards: IHostPortalSessionCardModel[],
): IPortalHeroMetadata {
  const sportKey = cards.find((card) => card.sport)?.sport;
  const sportLabel = sportKey ? getSportLabel(sportKey) : undefined;
  const dateRangeLabel = formatHeroMonthRange(cards);
  const sessionCount = cards.length;

  const eyebrowParts: string[] = [];
  if (sessionCount > 0) {
    eyebrowParts.push(`${sessionCount} SESSION${sessionCount === 1 ? '' : 'S'}`);
  }
  if (dateRangeLabel) {
    eyebrowParts.push(dateRangeLabel);
  }

  const defaultTitle = sportLabel ? `${sportLabel}.` : `${config.branding.companyName}.`;
  const defaultSubtitle = sportLabel
    ? `All ${sportLabel.toLowerCase()} programs at ${config.branding.companyName}. Filter by facility or age to find the right fit.`
    : `Browse programs at ${config.branding.companyName}. Filter by facility or age to find the right fit.`;

  return {
    eyebrow: eyebrowParts.join(' · '),
    title: config.features.portalHeroTitle?.trim() || defaultTitle,
    subtitle: config.features.portalHeroSubtitle?.trim() || defaultSubtitle,
  };
}

export function sortPortalSessionCards(
  cards: IHostPortalSessionCardModel[],
  sort: PortalSessionSortEnum,
): IHostPortalSessionCardModel[] {
  const sorted = [...cards];
  if (sort === PortalSessionSortEnum.NAME) {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }
  if (sort === PortalSessionSortEnum.PRICE) {
    sorted.sort((a, b) => {
      const priceA = a.products[0]?.priceAmount ?? Number.POSITIVE_INFINITY;
      const priceB = b.products[0]?.priceAmount ?? Number.POSITIVE_INFINITY;
      return priceA - priceB;
    });
    return sorted;
  }
  if (sort === PortalSessionSortEnum.MIN_AGE) {
    sorted.sort((a, b) => {
      const ageA = a.ageMin ?? Number.POSITIVE_INFINITY;
      const ageB = b.ageMin ?? Number.POSITIVE_INFINITY;
      if (ageA !== ageB) {
        return ageA - ageB;
      }
      // Stable tiebreak so equal-age sessions keep a predictable order.
      const startA = a.startDate ?? a.dateRange ?? a.name;
      const startB = b.startDate ?? b.dateRange ?? b.name;
      return startA.localeCompare(startB);
    });
    return sorted;
  }
  sorted.sort((a, b) => {
    const startA = a.dateRange ?? a.name;
    const startB = b.dateRange ?? b.name;
    return startA.localeCompare(startB);
  });
  return sorted;
}

/**
 * Applies the page's configured session ordering (`features.portalSessionSort`).
 * When unset, returns the cards untouched so pages keep Bond's source order
 * (the existing v2 behavior). Opt-in per page via admin.
 */
export function orderPortalSessionCards(
  cards: IHostPortalSessionCardModel[],
  config: DiscoveryConfig,
): IHostPortalSessionCardModel[] {
  const sort = config.features.portalSessionSort;
  if (!sort) {
    return cards;
  }
  return sortPortalSessionCards(cards, sort);
}

export function isPortalHeroEnabled(config: DiscoveryConfig): boolean {
  if (config.features.portalHeroEnabled === false) {
    return false;
  }
  if (config.features.portalHeroEnabled === true) {
    return true;
  }
  return config.features.hostPortalLayout === HostPortalLayoutEnum.SESSIONS_LIST;
}
