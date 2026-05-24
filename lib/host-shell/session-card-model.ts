import type { DiscoveryConfig, Product, Program, Segment, Session } from '@/types';
import {
  buildRegistrationUrl,
  formatAgeRange,
  formatDateRange,
  formatPrice,
  getGenderLabel,
} from '@/lib/utils';
import { computeSessionWeekCount } from '@/lib/host-shell/portal-list-layout';

export interface IHostPortalProductRow {
  id: string;
  name: string;
  description?: string;
  priceAmount?: number;
  priceLabel?: string;
  registrationUrl?: string;
  registerDisabled: boolean;
}

export interface IHostPortalSegmentRow {
  id: string;
  name: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
}

export interface IHostPortalSessionCardModel {
  sessionId: string;
  programId: string;
  programName: string;
  name: string;
  description?: string;
  longDescription?: string;
  sport?: string;
  facilityName?: string;
  ageMin?: number;
  ageMax?: number;
  ageRange?: string;
  genderLabel?: string;
  dateRange?: string;
  availabilityStatus?: string;
  isClosed: boolean;
  isRegistrationOpen: boolean;
  registerUrl?: string;
  registerProductId?: string;
  hasMultipleRegisterOptions: boolean;
  startingPriceLabel?: string;
  isSegmented: boolean;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  weekCountLabel?: string;
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

export function mapSegmentRow(segment: Segment): IHostPortalSegmentRow {
  return {
    id: segment.id,
    name: segment.name?.trim() || 'Segment',
    startDate: segment.startDate,
    endDate: segment.endDate,
    dateRange:
      segment.startDate || segment.endDate
        ? formatDateRange(segment.startDate ?? '', segment.endDate ?? '')
        : undefined,
  };
}

export function mapSegmentRows(segments: Segment[]): IHostPortalSegmentRow[] {
  return segments.map(mapSegmentRow);
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

function resolveStartingPriceLabel(products: IHostPortalProductRow[]): string | undefined {
  const amounts = products
    .map((product) => product.priceAmount)
    .filter((amount): amount is number => amount !== undefined);
  if (amounts.length === 0) {
    return undefined;
  }
  const minimum = Math.min(...amounts);
  return formatPrice(minimum, 'USD', { minimumFractionDigits: 2 });
}

function resolveSessionRegisterAction(
  products: IHostPortalProductRow[],
  baseLink: string | undefined,
  registerDisabled: boolean,
  customRegistrationUrl?: string,
): Pick<
  IHostPortalSessionCardModel,
  'registerUrl' | 'registerProductId' | 'hasMultipleRegisterOptions'
> {
  const registrationOpen = !registerDisabled;
  const hasMultipleRegisterOptions = products.length > 1;

  if (customRegistrationUrl) {
    return {
      registerUrl: customRegistrationUrl,
      registerProductId: products[0]?.id,
      hasMultipleRegisterOptions,
    };
  }

  if (products.length === 0) {
    return {
      registerUrl: buildRegistrationUrl(baseLink, { isRegistrationOpen: registrationOpen }),
      hasMultipleRegisterOptions: false,
    };
  }

  if (hasMultipleRegisterOptions) {
    return {
      registerUrl: buildRegistrationUrl(baseLink, { isRegistrationOpen: registrationOpen }),
      hasMultipleRegisterOptions: true,
    };
  }

  const onlyProduct = products[0];
  return {
    registerUrl: onlyProduct.registrationUrl,
    registerProductId: onlyProduct.id,
    hasMultipleRegisterOptions: false,
  };
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
    priceAmount: lowest,
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
  const showPricing = config.features.showPricing !== false;
  const customRegistrationUrl = config.features.customRegistrationUrl;
  const cards: IHostPortalSessionCardModel[] = [];

  for (const program of programs) {
    const sessions = getSessionsFromProgram(program);
    for (const session of sessions) {
      const availabilityStatus = session.availabilityStatus;
      const isClosed = isSessionClosedByAvailabilityStatus(availabilityStatus);
      const registerDisabled = isClosed;
      const baseLink = session.linkSEO;
      const ageMin = session.minAge ?? session.ageMin ?? program.ageMin;
      const ageMax = session.maxAge ?? session.ageMax ?? program.ageMax;
      const gender = session.gender;

      const products = getProductsFromSession(session).map((product) =>
        mapProductRow(product, baseLink, registerDisabled, customRegistrationUrl),
      );
      const registerAction = resolveSessionRegisterAction(
        products,
        baseLink,
        registerDisabled,
        customRegistrationUrl,
      );

      const weekCount = computeSessionWeekCount(session.startDate, session.endDate);

      cards.push({
        sessionId: session.id,
        programId: program.id,
        programName: program.name,
        name: session.name ?? '',
        description: session.description,
        longDescription: session.longDescription,
        sport: session.sport,
        facilityName: session.facility?.name,
        ageMin,
        ageMax,
        ageRange: showAgeGender ? formatAgeRange(ageMin, ageMax) : undefined,
        genderLabel:
          showAgeGender && gender && gender !== 'all' && gender !== 'coed'
            ? getGenderLabel(gender)
            : undefined,
        dateRange:
          session.startDate || session.endDate
            ? formatDateRange(session.startDate ?? '', session.endDate ?? '')
            : undefined,
        startDate: session.startDate,
        endDate: session.endDate,
        weekCountLabel: weekCount ? `${weekCount} weeks` : undefined,
        availabilityStatus,
        isClosed,
        isRegistrationOpen: !registerDisabled,
        startingPriceLabel: showPricing ? resolveStartingPriceLabel(products) : undefined,
        isSegmented: Boolean(session.isSegmented),
        organizationId: program.organizationId,
        segments: mapSegmentRows(getSegmentsFromSession(session)),
        products,
        ...registerAction,
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
