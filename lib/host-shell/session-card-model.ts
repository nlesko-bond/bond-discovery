import type { PortalSegmentAvailabilityKindEnum } from '@/lib/host-shell/portal-segment-availability';
import type { DiscoveryConfig, Product, Program, Segment, Session } from '@/types';
import {
  buildRegistrationUrl,
  formatAgeRange,
  formatDateRange,
  formatPrice,
  getGenderLabel,
} from '@/lib/utils';
import { computeSessionWeekCount } from '@/lib/host-shell/portal-list-layout';
import { resolveSessionTieredPricingLabel } from '@/lib/host-shell/portal-tiered-pricing';

export interface IHostPortalProductRow {
  id: string;
  name: string;
  description?: string;
  priceAmount?: number;
  priceLabel?: string;
  registrationUrl?: string;
  registerDisabled: boolean;
  /** Visual-only (v2 member pricing hook): product flagged as member pricing. */
  isMemberProduct?: boolean;
}

export interface IHostPortalSegmentRow {
  id: string;
  name: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  scheduleLabel?: string;
  facilityName?: string;
  spaceName?: string;
  spotsRemaining?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  isWaitlistEnabled?: boolean;
  availabilityKind?: PortalSegmentAvailabilityKindEnum;
  availabilityLabel?: string;
  priceLabel?: string;
  registrationWindowStatus?: string;
}

export interface IHostPortalSessionCardModel {
  sessionId: string;
  programId: string;
  programName: string;
  name: string;
  description?: string;
  longDescription?: string;
  sport?: string;
  programType?: string;
  facilityId?: string;
  facilityName?: string;
  ageMin?: number;
  ageMax?: number;
  ageRange?: string;
  genderLabel?: string;
  dateRange?: string;
  availabilityStatus?: string;
  isClosed: boolean;
  isRegistrationOpen: boolean;
  registrationWindowStatus?: string;
  waitlistEnabled?: boolean;
  registerUrl?: string;
  registerProductId?: string;
  hasMultipleRegisterOptions: boolean;
  startingPriceLabel?: string;
  /** Display-only early-bird / late-fee copy when showTieredSessionPricing is enabled. */
  tieredPricingLabel?: string;
  isSegmented: boolean;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  weekCountLabel?: string;
  segments: IHostPortalSegmentRow[];
  products: IHostPortalProductRow[];
  /** Visual-only (v2): program-level photo when present (sessions have none). */
  imageUrl?: string;
  /** Visual-only (v2): availability pill inputs from SessionDto capacity. */
  spotsRemaining?: number;
  isFull?: boolean;
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

export function mapSegmentRow(
  segment: Segment,
  displayContext?: Pick<IHostPortalSessionCardModel, 'name' | 'programName'>,
): IHostPortalSegmentRow {
  const segmentName = segment.name?.trim() || 'Segment';
  return {
    id: segment.id,
    name: segmentName,
    scheduleLabel: displayContext
      ? trimSegmentDisplayName(segmentName, displayContext)
      : segmentName,
    startDate: segment.startDate,
    endDate: segment.endDate,
    dateRange:
      segment.startDate || segment.endDate
        ? formatDateRange(segment.startDate ?? '', segment.endDate ?? '')
        : undefined,
  };
}

export function mapSegmentRows(
  segments: Segment[],
  displayContext?: Pick<IHostPortalSessionCardModel, 'name' | 'programName'>,
): IHostPortalSegmentRow[] {
  return segments.map((segment) => mapSegmentRow(segment, displayContext));
}

/** Lowercase alphanumerics only, so "FALL@ Sports" matches "FALL @ Sports". */
function normalizeNamePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Bond segment names repeat their program + session names as prefixes
 * ("Coppermine Soccer Classes - ALL AGES FALL @ Sports Center - Tue 09:30 am").
 * Drops leading " - " parts that duplicate the card's program/session name so
 * the panel shows only the distinguishing part ("Tue 09:30 am"). Falls back to
 * the full name when nothing distinguishing remains.
 */
export function trimSegmentDisplayName(
  segmentName: string,
  context: Pick<IHostPortalSessionCardModel, 'name' | 'programName'>,
): string {
  const knownPrefixes = [context.programName, context.name]
    .map((value) => normalizeNamePart(value || ''))
    .filter(Boolean);
  if (knownPrefixes.length === 0) {
    return segmentName;
  }
  const parts = segmentName.split(/\s+[-–—]\s+/);
  let firstKept = 0;
  while (firstKept < parts.length - 1) {
    const normalized = normalizeNamePart(parts[firstKept]);
    const isRedundant =
      normalized.length > 0 &&
      knownPrefixes.some(
        (prefix) => prefix === normalized || prefix.includes(normalized),
      );
    if (!isRedundant) {
      break;
    }
    firstKept += 1;
  }
  const trimmed = parts.slice(firstKept).join(' - ').trim();
  return trimmed || segmentName;
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
    ...(product.isMemberProduct !== undefined && {
      isMemberProduct: product.isMemberProduct,
    }),
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
  const showTieredSessionPricing = config.features.showTieredSessionPricing === true;
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

      const sessionProducts = getProductsFromSession(session);
      const products = sessionProducts.map((product) =>
        mapProductRow(product, baseLink, registerDisabled, customRegistrationUrl),
      );
      const tieredPricingLabel =
        showPricing && showTieredSessionPricing
          ? resolveSessionTieredPricingLabel(sessionProducts)
          : undefined;
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
        programType: program.type,
        facilityId: session.facility?.id !== undefined && session.facility.id !== null
          ? String(session.facility.id)
          : program.facilityId !== undefined && program.facilityId !== null
            ? String(program.facilityId)
            : undefined,
        facilityName: session.facility?.name ?? program.facilityName,
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
        registrationWindowStatus:
          session.registrationWindowStatus ??
          (registerDisabled ? 'closed' : 'open'),
        waitlistEnabled: session.waitlistEnabled ?? session.isWaitlistEnabled,
        startingPriceLabel: showPricing ? resolveStartingPriceLabel(products) : undefined,
        tieredPricingLabel,
        isSegmented: Boolean(session.isSegmented),
        organizationId: program.organizationId,
        segments: mapSegmentRows(getSegmentsFromSession(session), {
          name: session.name ?? '',
          programName: program.name,
        }),
        products,
        imageUrl: program.mainMedia?.url || program.imageUrl || undefined,
        spotsRemaining: session.spotsRemaining,
        isFull: session.isFull,
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
