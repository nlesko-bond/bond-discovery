import type {
  DiscoveryConfig,
  MemberPricingStyle,
  PortalCardStyle,
  PortalDisplayMode,
  PortalRowColumn,
  PortalTemplate,
  Program,
  ScheduleTableColumn,
  Session,
} from '@/types';
import { formatPrice } from '@/lib/utils';
import { getSportVisualTheme } from '@/lib/host-shell/sport-visuals';
import {
  PORTAL_AGE_BUCKETS,
  type IPortalAgeBucket,
} from '@/lib/host-shell/portal-age-buckets';
import type {
  IHostPortalProductRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';

export const PORTAL_TEMPLATE_V2: PortalTemplate = 'v2';

/** v2 grid defaults per direction doc: program/session cards vs denser list-mode rows. */
export const V2_CARD_MIN_WIDTH_DEFAULT_CARDS_PX = 240;
export const V2_CARD_MIN_WIDTH_DEFAULT_LIST_PX = 200;
const V2_CARD_MIN_WIDTH_MIN_PX = 160;
const V2_CARD_MIN_WIDTH_MAX_PX = 480;

const ALMOST_FULL_SPOTS_THRESHOLD = 5;

export type PortalV2LayoutMode = 'cards' | 'list';

/**
 * Strict resolver for `features.portalTemplate`: only the literal 'v2'
 * activates the redesigned template. Anything else → undefined (existing rendering).
 */
export function resolvePortalTemplate(raw: unknown): 'v2' | undefined {
  return raw === 'v2' ? 'v2' : undefined;
}

export function isPortalTemplateV2(config: DiscoveryConfig): boolean {
  return resolvePortalTemplate(config.features.portalTemplate) === 'v2';
}

/**
 * Member price row style on v2 cards (temporary comparison flag). Default 'inline'.
 */
export function resolveMemberPricingStyle(raw: unknown): MemberPricingStyle {
  if (raw === 'badge' || raw === 'stacked' || raw === 'inline') {
    return raw;
  }
  return 'inline';
}

/**
 * Session-card style on the v2 sessions path. Only known literals activate a
 * variant; anything else falls back to 'classic' (the existing session card).
 */
export function resolvePortalCardStyle(raw: unknown): PortalCardStyle {
  if (raw === 'classic' || raw === 'stacked' || raw === 'rows' || raw === 'list') {
    return raw;
  }
  return 'classic';
}

/**
 * Stored admin value for the v2 programs-vs-sessions display mode.
 * Unknown/absent values → 'auto' (preserves default behavior).
 */
export function resolvePortalDisplayMode(raw: unknown): PortalDisplayMode {
  if (raw === 'programs' || raw === 'sessions' || raw === 'auto') {
    return raw;
  }
  return 'auto';
}

/**
 * Effective display mode for the v2 path. 'auto' → sessions view when the page
 * scope resolves to exactly ONE program (e.g. coppermine: include-mode with a
 * single program), programs-grouped view otherwise. Explicit values force either.
 */
export function resolveEffectivePortalDisplayMode(
  mode: PortalDisplayMode,
  programCount: number,
): 'programs' | 'sessions' {
  if (mode === 'programs' || mode === 'sessions') {
    return mode;
  }
  return programCount === 1 ? 'sessions' : 'programs';
}

// ---------------------------------------------------------------------------
// 'rows' card style — session-level columns
// ---------------------------------------------------------------------------

/**
 * Columns the 'rows' card style can honor. Only columns that map to
 * SESSION-LEVEL data qualify: 'time' and 'space' are event-level (a session may
 * span multiple segments / variable schedules) and are intentionally dropped.
 *
 * Mirrors PortalRowColumn from types/index.ts — kept as a local alias for
 * backwards compatibility with call sites that reference PortalV2SessionRowColumn.
 */
export type PortalV2SessionRowColumn = PortalRowColumn;

const DEFAULT_ROW_COLUMNS: PortalRowColumn[] = [
  'date',
  'event',
  'program',
  'location',
  'spots',
  'action',
];

function isSessionLevelRowColumn(
  column: ScheduleTableColumn,
): column is Extract<PortalRowColumn, ScheduleTableColumn> {
  return (
    column === 'date' ||
    column === 'event' ||
    column === 'program' ||
    column === 'location' ||
    column === 'spots' ||
    column === 'action'
  );
}

/**
 * Resolves the columns the 'rows' card style renders.
 *
 * Priority:
 * 1. `features.portalRowColumns` — dedicated rows column config set via admin Rows panel.
 * 2. `features.tableColumns` filtered to session-level — legacy fallback so existing
 *    pages that were configured via the schedule table columns keep working unchanged.
 * 3. DEFAULT_ROW_COLUMNS — all session-level columns when nothing is configured.
 *
 * Always forces 'event' (session name) to be present so no row is anonymous.
 * Respects showAvailability (spots) and hideRegistrationLinks/showPricing (action).
 */
export function resolvePortalV2SessionRowColumns(
  config: DiscoveryConfig,
): PortalV2SessionRowColumn[] {
  const portalRowColumns = config.features.portalRowColumns;
  const configured: PortalV2SessionRowColumn[] = portalRowColumns?.length
    ? portalRowColumns
    : (config.features.tableColumns?.length
        ? config.features.tableColumns.filter(isSessionLevelRowColumn)
        : DEFAULT_ROW_COLUMNS);

  const showAvailability = config.features.showAvailability !== false;
  const showPricing = config.features.showPricing !== false;
  const hideRegistrationLinks = config.features.hideRegistrationLinks === true;

  const columns = configured.filter((column) => {
    if (column === 'spots') {
      return showAvailability;
    }
    if (column === 'action') {
      return !hideRegistrationLinks || showPricing;
    }
    return true;
  });

  let deduped = columns.filter(
    (column, index) => columns.indexOf(column) === index,
  );

  const displayMode = resolvePortalDisplayMode(config.features.portalDisplayMode);
  if (displayMode === 'sessions') {
    deduped = deduped.filter((column) => column !== 'program');
  }

  return deduped.includes('event') ? deduped : ['event', ...deduped];
}

/**
 * Min card width (px) for the v2 auto-fill grid. Accepts numbers or numeric
 * strings; clamps to a sane range; defaults per layout mode.
 */
export function resolvePortalCardMinWidth(
  raw: unknown,
  layoutMode: PortalV2LayoutMode = 'cards',
): number {
  const fallback =
    layoutMode === 'list'
      ? V2_CARD_MIN_WIDTH_DEFAULT_LIST_PX
      : V2_CARD_MIN_WIDTH_DEFAULT_CARDS_PX;
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(
    V2_CARD_MIN_WIDTH_MAX_PX,
    Math.max(V2_CARD_MIN_WIDTH_MIN_PX, Math.round(value)),
  );
}

// ---------------------------------------------------------------------------
// Tinted sport-glyph panel (primary card visual)
// ---------------------------------------------------------------------------

export interface IPortalV2Tint {
  /** Flat tinted panel background behind the sport glyph. */
  panelBackground: string;
  /** Glyph / icon color on the panel. */
  glyphColor: string;
  /** Saturated companion color (chips, hairline) matching the panel family. */
  accentColor: string;
}

interface IRgb {
  r: number;
  g: number;
  b: number;
}

interface IHsl {
  h: number;
  s: number;
  l: number;
}

function parseHex(hex: string): IRgb | null {
  const normalized = hex.replace('#', '').trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}/.test(expanded)) {
    return null;
  }
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: IRgb): IHsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) {
      h = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
    } else if (max === green) {
      h = ((blue - red) / delta + 2) / 6;
    } else {
      h = ((red - green) / delta + 4) / 6;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: IHsl): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const light = Math.min(100, Math.max(0, l)) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let rgb: [number, number, number];
  if (huePrime < 1) rgb = [chroma, x, 0];
  else if (huePrime < 2) rgb = [x, chroma, 0];
  else if (huePrime < 3) rgb = [0, chroma, x];
  else if (huePrime < 4) rgb = [0, x, chroma];
  else if (huePrime < 5) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  const m = light - chroma / 2;
  const toChannel = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toChannel(rgb[0])}${toChannel(rgb[1])}${toChannel(rgb[2])}`;
}

const NEUTRAL_TINT: IPortalV2Tint = {
  panelBackground: '#eef2ff',
  glyphColor: '#4338ca',
  accentColor: '#4f46e5',
};

/**
 * Tint for the v2 card glyph panel. Known sports use their per-sport hue family;
 * unknown sports derive a soft tint from the page accent color so panels always
 * look intentional (never a gray fallback box).
 */
export function derivePortalCardTint(
  accentHex: string,
  sport?: string,
): IPortalV2Tint {
  if (sport?.trim()) {
    const theme = getSportVisualTheme(sport);
    // getSportVisualTheme falls back to a default (indigo) theme for unknown
    // sports; only use the sport family when the sport actually resolved to one.
    const isKnownSport = theme.iconBackground !== NEUTRAL_TINT.panelBackground;
    if (isKnownSport) {
      return {
        panelBackground: theme.iconBackground,
        glyphColor: theme.iconColor,
        accentColor: theme.gradientFrom,
      };
    }
  }

  const rgb = parseHex(accentHex || '');
  if (!rgb) {
    return NEUTRAL_TINT;
  }
  const hsl = rgbToHsl(rgb);
  // Near-gray accents would tint to a dirty gray; keep the neutral indigo family.
  if (hsl.s < 8) {
    return NEUTRAL_TINT;
  }
  return {
    panelBackground: hslToHex({ h: hsl.h, s: Math.min(hsl.s, 65), l: 93 }),
    glyphColor: hslToHex({ h: hsl.h, s: Math.min(hsl.s, 70), l: 32 }),
    accentColor: accentHex,
  };
}

// ---------------------------------------------------------------------------
// Member pricing (inline hook on the price row)
// ---------------------------------------------------------------------------

export interface IPortalV2MemberPricing {
  /** e.g. "$24" — lowest member-product price, only when below the public price. */
  memberPriceLabel?: string;
}

/**
 * Lowest member-product price for the card's price-row hook. Returns nothing
 * when the session has no member product (row renders "From $X" alone, no gap)
 * or when the member price is not actually lower than the public price.
 */
export function resolveMemberPricing(
  products: IHostPortalProductRow[],
): IPortalV2MemberPricing {
  const memberAmounts = products
    .filter((product) => product.isMemberProduct && product.priceAmount !== undefined)
    .map((product) => product.priceAmount as number);
  if (memberAmounts.length === 0) {
    return {};
  }
  const publicAmounts = products
    .filter((product) => !product.isMemberProduct && product.priceAmount !== undefined)
    .map((product) => product.priceAmount as number);
  const memberMin = Math.min(...memberAmounts);
  if (publicAmounts.length > 0 && memberMin >= Math.min(...publicAmounts)) {
    return {};
  }
  return {
    memberPriceLabel: formatPrice(memberMin, 'USD', { minimumFractionDigits: 2 }),
  };
}

// ---------------------------------------------------------------------------
// Availability pill
// ---------------------------------------------------------------------------

export type PortalV2AvailabilityKind = 'open' | 'almost_full' | 'full' | 'closed';

export interface IPortalV2Availability {
  kind: PortalV2AvailabilityKind;
  label: string;
}

/**
 * Availability pill shown on the card glyph panel:
 * green=open, amber=almost full, gray=full/waitlist or closed registration.
 */
export function resolveV2Availability(
  card: Pick<IHostPortalSessionCardModel, 'isClosed' | 'isFull' | 'spotsRemaining'>,
): IPortalV2Availability {
  if (card.isClosed) {
    return { kind: 'closed', label: 'Closed' };
  }
  if (card.isFull) {
    return { kind: 'full', label: 'Full' };
  }
  if (
    card.spotsRemaining !== undefined &&
    card.spotsRemaining > 0 &&
    card.spotsRemaining <= ALMOST_FULL_SPOTS_THRESHOLD
  ) {
    return {
      kind: 'almost_full',
      label:
        card.spotsRemaining === 1 ? '1 spot left' : `${card.spotsRemaining} spots left`,
    };
  }
  return { kind: 'open', label: 'Open' };
}

// ---------------------------------------------------------------------------
// Filter helpers (v2 bar shows only options that match loaded data)
// ---------------------------------------------------------------------------

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

export interface IPortalV2AgeBucketOption extends IPortalAgeBucket {
  count: number;
}

/**
 * Session counts per static age bucket so the v2 filter only offers buckets
 * that match the loaded data (fixes options-vs-data drift of the static list).
 */
export function countSessionsPerAgeBucket(
  programs: Program[],
): IPortalV2AgeBucketOption[] {
  return PORTAL_AGE_BUCKETS.map((bucket) => {
    let count = 0;
    for (const program of programs) {
      for (const session of getSessionsFromProgram(program)) {
        const ageMin = session.minAge ?? session.ageMin ?? program.ageMin;
        const ageMax = session.maxAge ?? session.ageMax ?? program.ageMax;
        const belowBucket = ageMax !== undefined && ageMax < bucket.min;
        const aboveBucket = ageMin !== undefined && ageMin > bucket.max;
        if (!belowBucket && !aboveBucket) {
          count += 1;
        }
      }
    }
    return { ...bucket, count };
  });
}

/**
 * Gender filter options that exist in the loaded data. Pages with only co-ed
 * sessions get no gender filter at all (every option would be a no-op).
 */
export function buildV2GenderOptions(
  programs: Program[],
): { id: 'male' | 'female'; label: string }[] {
  let hasMale = false;
  let hasFemale = false;
  for (const program of programs) {
    for (const session of getSessionsFromProgram(program)) {
      const gender = session.gender ?? program.gender;
      if (gender === 'male') hasMale = true;
      if (gender === 'female') hasFemale = true;
    }
  }
  const options: { id: 'male' | 'female'; label: string }[] = [];
  if (hasMale) options.push({ id: 'male', label: 'Boys' });
  if (hasFemale) options.push({ id: 'female', label: 'Girls' });
  return options;
}

/**
 * Activity chip label: 'ice_skating' → 'Ice Skating'. (The shared getSportLabel
 * keeps underscores; v2 chips need clean human labels without changing it.)
 */
export function formatActivityLabel(sportId: string): string {
  return sportId
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ---------------------------------------------------------------------------
// Preview URL overrides (operator comparison; defaults unchanged without params)
// ---------------------------------------------------------------------------

type SearchParamValue = string | string[] | undefined;

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lets the operator preview the v2 template and its variants on any page via
 * URL params (?portalTemplate=v2&memberPricingStyle=badge&portalCardMinWidth=280
 * &portalCardStyle=stacked) without flipping the stored config. Returns the
 * config unchanged when no recognized preview params are present.
 */
export function applyPortalV2PreviewOverrides(
  config: DiscoveryConfig,
  searchParams: { [key: string]: SearchParamValue },
): DiscoveryConfig {
  const templateParam = resolvePortalTemplate(firstParam(searchParams.portalTemplate));
  const styleParamRaw = firstParam(searchParams.memberPricingStyle);
  const styleParam =
    styleParamRaw === 'inline' || styleParamRaw === 'badge' || styleParamRaw === 'stacked'
      ? styleParamRaw
      : undefined;
  const minWidthRaw = firstParam(searchParams.portalCardMinWidth);
  const minWidthParam =
    minWidthRaw !== undefined && Number.isFinite(Number(minWidthRaw))
      ? Number(minWidthRaw)
      : undefined;
  const cardStyleRaw = firstParam(searchParams.portalCardStyle);
  const cardStyleParam =
    cardStyleRaw === 'classic' ||
    cardStyleRaw === 'stacked' ||
    cardStyleRaw === 'rows' ||
    cardStyleRaw === 'list'
      ? cardStyleRaw
      : undefined;

  if (
    !templateParam &&
    !styleParam &&
    minWidthParam === undefined &&
    !cardStyleParam
  ) {
    return config;
  }

  return {
    ...config,
    features: {
      ...config.features,
      ...(templateParam && { portalTemplate: templateParam }),
      ...(styleParam && { memberPricingStyle: styleParam }),
      ...(minWidthParam !== undefined && { portalCardMinWidth: minWidthParam }),
      ...(cardStyleParam && { portalCardStyle: cardStyleParam }),
    },
  };
}
