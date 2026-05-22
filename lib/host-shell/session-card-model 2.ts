import type { DiscoveryConfig, Product, Program, Segment, Session } from '@/types';
import {
  buildRegistrationUrl,
  formatAgeRange,
  formatDateRange,
  formatPrice,
  getGenderLabel,
} from '@/lib/utils';

export interface IHostPortalProductRow {
  id: string;
  name: string;
  description?: string;
  priceLabel?: string;
  registrationUrl?: string;
  registerDisabled: boolean;
}

export interface IHostPortalSegmentRow {
  id: string;
  name: string;
  dateRange?: string;
}

export interface IHostPortalSessionCardModel {
  sessionId: string;
  programId: string;
  programName: string;
  name: string;
  description?: string;
  sport?: string;
  facilityName?: string;
  ageRange?: string;
  genderLabel?: string;
  dateRange?: string;
  availabilityStatus?: string;
  isClosed: boolean;
  isRegistrationOpen: boolean;
  segments: IHostPortalSegmentRow[];
  products: IHostPortalProductRow[];
}

/**
 * Maps SessionDto.availabilityStatus to portal closed UI.
 * Confirm with product which enum values disable registration.
 */
export function isSessionClosedByAvailabilityStatus(
  availabilityStatus: string | undefined,
): boolean {
  return (
    availabilityStatus === 'unavailable' ||
    availabilityStatus === 'expired'
  );
}

function getProductsFromSession(session: Session): Product[] {
  const products = session.products;
  if (!products) {
    return [];
  }
  if (Array.isArray(products)) {
    return products;
  }
  if (typeof products === 'object' && 'data' in products) {
    const nested = products as { data?: Product[] };
    return nested.data ?? [];
  }
  return [];
}

function getSegmentsFromSession(session: Session): Segment[] {
  const segments = session.segments;
  if (!segments) {
    return [];
  }
  if (Array.isArray(segments)) {
    return segments;
  }
  if (typeof segments === 'object' && 'data' in segments) {
    const nested = segments as { data?: Segment[] };
    return nested.data ?? [];
  }
  return [];
}

function getSessionsFromProgram(program: Program): Session[] {
  const sessions = program.sessions;
  if (!sessions) {
    return [];
  }
  if (Array.isArray(sessions)) {
    return sessions;
  }
  if (typeof sessions === 'object' && 'data' in sessions) {
    const nested = sessions as { data?: Session[] };
    return nested.data ?? [];
  }
  return [];
}

function mapSegmentRow(segment: Segment): IHostPortalSegmentRow {
  return {
    id: segment.id,
    name: segment.name?.trim() || 'Segment',
    dateRange:
      segment.startDate || segment.endDate
        ? formatDateRange(segment.startDate ?? '', segment.endDate ?? '')
        : undefined,
  };
}

function lowestProductPrice(product: Product): number | undefined {
  if (!product.prices?.length) {
    return undefined;
  }
  return product.prices.reduce((min, priceRow) => {
    const value = priceRow.price ?? priceRow.amount ?? 0;
    return value < min ? value : min;
  }, product.prices[0]?.price ?? product.prices[0]?.amount ?? 0);
}

function mapProductRow(
  product: Product,
  baseLink: string | undefined,
  registerDisabled: boolean,
  customRegistrationUrl?: string,
): IHostPortalProductRow {
  const registrationOpen = !registerDisabled;
  const builtUrl = buildRegistrationUrl(baseLink, {
    productId: product.id,
    isRegistrationOpen: registrationOpen,
  });
  const registrationUrl = customRegistrationUrl ?? builtUrl;
  const lowest = lowestProductPrice(product);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceLabel:
      lowest !== undefined ? formatPrice(lowest, 'USD', { minimumFractionDigits: 2 }) : undefined,
    registrationUrl: registerDisabled ? builtUrl : registrationUrl,
    registerDisabled,
  };
}

/**
 * Flattens programs into session-first card view models using SessionDto fields only.
 */
export function buildHostPortalSessionCards(
  programs: Program[],
  config: DiscoveryConfig,
): IHostPortalSessionCardModel[] {
  const showAgeGender = config.features.showAgeGender !== false;
  const customRegistrationUrl = config.features.customRegistrationUrl;
  const cards: IHostPortalSessionCardModel[] = [];

  for (const program of programs) {
    const sessions = getSessionsFromProgram(program);
    for (const session of sessions) {
      const availabilityStatus = session.availabilityStatus;
      const isClosed = isSessionClosedByAvailabilityStatus(availabilityStatus);
      const registerDisabled = isClosed;
      const baseLink = session.linkSEO;
      const ageMin = session.minAge ?? session.ageMin;
      const ageMax = session.maxAge ?? session.ageMax;
      const gender = session.gender;

      cards.push({
        sessionId: session.id,
        programId: program.id,
        programName: program.name,
        name: session.name ?? '',
        description: session.description,
        sport: session.sport,
        facilityName: session.facility?.name,
        ageRange: showAgeGender ? formatAgeRange(ageMin, ageMax) : undefined,
        genderLabel:
          showAgeGender && gender && gender !== 'all' && gender !== 'coed'
            ? getGenderLabel(gender)
            : undefined,
        dateRange:
          session.startDate || session.endDate
            ? formatDateRange(session.startDate ?? '', session.endDate ?? '')
            : undefined,
        availabilityStatus,
        isClosed,
        isRegistrationOpen: !registerDisabled,
        segments: getSegmentsFromSession(session).map(mapSegmentRow),
        products: getProductsFromSession(session).map((product) =>
          mapProductRow(product, baseLink, registerDisabled, customRegistrationUrl),
        ),
      });
    }
  }

  return cards;
}

export function buildProductRegistrationHref(
  baseLink: string | undefined,
  productId: string,
  isRegistrationOpen: boolean,
  customRegistrationUrl?: string,
): string | undefined {
  if (customRegistrationUrl) {
    return customRegistrationUrl;
  }
  return buildRegistrationUrl(baseLink, { productId, isRegistrationOpen });
}
