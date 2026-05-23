import type { DiscoveryConfig } from '@/types';
import { HostPortalLayoutEnum } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import { PortalSessionSortEnum } from '@/types';
import { getSportLabel } from '@/lib/utils';

const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MIN_PORTAL_EVENT_HORIZON_MONTHS = 3;
const MAX_PORTAL_EVENT_HORIZON_MONTHS = 18;
const PORTAL_EVENT_HORIZON_BUFFER_MONTHS = 1;

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
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  cards.forEach((card) => {
    const ageMatch = card.ageRange?.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (ageMatch) {
      min = Math.min(min, parseFloat(ageMatch[1]));
      max = Math.max(max, parseFloat(ageMatch[2]));
      return;
    }
    const singleMatch = card.ageRange?.match(/([\d.]+)/);
    if (singleMatch) {
      const value = parseFloat(singleMatch[1]);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  });

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 18 };
  }
  return { min: Math.floor(min), max: Math.ceil(max) };
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
  sorted.sort((a, b) => {
    const startA = a.dateRange ?? a.name;
    const startB = b.dateRange ?? b.name;
    return startA.localeCompare(startB);
  });
  return sorted;
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
