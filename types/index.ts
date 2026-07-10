import type { BondEnv } from '@/lib/bond-env';

// ============================================
// Bond Sports API Types - Enhanced
// ============================================

// Organization and Facility
export interface Organization {
  id: string;
  name: string;
  facilities?: Facility[];
}

export interface Facility {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  organizationId: string;
}

// Media type for images
export interface Media {
  id: number;
  url: string;
  mediaType?: number;
  fileType?: string;
  name?: string;
}

// Program Types
export interface Program {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  type?: ProgramType;
  sport?: string;
  facilityId?: string;
  facilityName?: string;
  organizationId?: string;
  imageUrl?: string;
  
  // Media
  mainMedia?: Media;
  
  // Links
  linkSEO?: string;
  
  // Age/Gender restrictions
  ageMin?: number;
  ageMax?: number;
  gender?: Gender;
  levels?: string[];
  
  // Publishing
  publishingStatus?: number;
  
  // Dates
  createdAt?: string;
  updatedAt?: string;
  
  // Nested data
  sessions?: Session[];
  facility?: Facility;
}

export type ProgramType = 
  | 'class' 
  | 'clinic' 
  | 'camp' 
  | 'lesson' 
  | 'league' 
  | 'tournament' 
  | 'club_team' 
  | 'drop_in'
  | 'rental';

export type Gender = 'all' | 'male' | 'female' | 'coed';

/** Bond public API `AvailabilityStatusEnum` on SessionDto */
export enum AvailabilityStatusEnum {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  PARTIALLY_AVAILABLE = 'partially_available',
  EXPIRED = 'expired',
  PARTIALLY_EXPIRED = 'partially_expired',
}

// Session Types
export interface Session {
  id: string;
  programId: string;
  name?: string;
  description?: string;
  longDescription?: string;
  
  // Links
  linkSEO?: string;
  
  // Facility
  facility?: {
    id: number;
    name: string;
  };
  
  // Dates and times
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  
  // Registration dates
  registrationStartDate?: string;
  registrationEndDate?: string;
  earlyRegistrationStartDate?: string;
  earlyRegistrationEndDate?: string;
  lateRegistrationStartDate?: string;
  lateRegistrationEndDate?: string;
  cutoffDate?: string;
  
  // Registration status (legacy / computed in transformer; prefer availabilityStatus for SessionDto)
  registrationWindowStatus?: 'open' | 'closed' | 'not_opened_yet' | 'ended' | string;
  /** SessionDto.availabilityStatus — source of truth for session capacity window */
  availabilityStatus?: AvailabilityStatusEnum | string;
  
  // Capacity
  capacity?: number;
  maxParticipants?: number;
  maxMaleParticipants?: number;
  maxFemaleParticipants?: number;
  currentEnrollment?: number;
  spotsRemaining?: number;
  isFull?: boolean;
  waitlistEnabled?: boolean;
  isWaitlistEnabled?: boolean;
  waitlistCount?: number;
  
  // Status
  status?: SessionStatus;
  isSegmented?: boolean;
  
  // Age/Gender (can override program)
  ageMin?: number;
  ageMax?: number;
  minAge?: number;
  maxAge?: number;
  gender?: Gender;
  levels?: string[];
  sport?: string;
  
  // Recurrence
  recurring?: boolean;
  recurrencePattern?: string;
  daysOfWeek?: string[];
  
  // Nested data
  products?: Product[];
  segments?: Segment[];
  events?: SessionEvent[];
}

export type SessionStatus = 'active' | 'inactive' | 'cancelled' | 'completed' | 'draft';

// Product and Pricing Types
export interface Product {
  id: string;
  sessionId?: string;
  organizationId?: number;
  name: string;
  description?: string;
  quantity?: number;
  type?: ProductType;
  status?: ProductStatus;
  
  // Registration dates
  startDate?: string;
  endDate?: string;
  registrationStartDate?: string;
  registrationEndDate?: string;
  earlyBirdEndDate?: string;
  
  // Membership - inferred from product name/description
  isMemberProduct?: boolean;
  membershipRequired?: boolean;
  membershipIds?: string[];
  membershipDiscounts?: MembershipDiscount[];
  
  // Capacity (product-level)
  maxParticipants?: number;
  currentParticipants?: number;
  spotsRemaining?: number;
  
  // Flags
  isAll?: boolean;
  isProRated?: boolean;
  isPunchPass?: boolean;
  
  // Payment
  downpayment?: number;
  taxes?: any[];
  timezone?: string;
  
  // Pricing
  prices: Price[];
}

export type ProductType = 'full_session' | 'drop_in' | 'package' | 'trial' | 'membership';
export type ProductStatus = 'active' | 'inactive' | 'sold_out' | 'coming_soon';

export interface Price {
  id: string;
  productId?: string;
  organizationId?: number;
  packageId?: number | null;
  price: number; // In dollars (NOT cents!)
  amount?: number; // Alias for price
  currency: string;
  name?: string;
  description?: string;
  
  // Dates
  startDate?: string;
  endDate?: string;
  
  // Age-based pricing
  ageGroup?: string;
  ageMin?: number;
  ageMax?: number;
  
  // Discounts
  originalAmount?: number;
  discountAmount?: number;
  discountPercent?: number;
  
  // Validity
  validFrom?: string;
  validUntil?: string;
}

export interface MembershipDiscount {
  membershipId: string;
  membershipName?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  finalPrice?: number;
}

// Event Types (for schedule)
export interface SessionEvent {
  id: string;
  sessionId: string;
  segmentId?: string;
  
  // When
  date: string;
  startTime: string;
  endTime: string;
  
  // Where
  facilityId?: string;
  facilityName?: string;
  location?: string; // Room, field, court name
  
  // Details
  name?: string;
  description?: string;
  instructor?: string;
  
  // Capacity
  maxParticipants?: number;
  currentParticipants?: number;
  spotsRemaining?: number;
  
  // Status
  status?: 'scheduled' | 'cancelled' | 'completed';
}

export interface Segment {
  id: string;
  sessionId: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  events?: SessionEvent[];
}

// API Response Types
export interface APIResponse<T> {
  data: T;
  meta?: {
    pagination?: Pagination;
  };
}

export interface Pagination {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  hasMore: boolean;
}

// ============================================
// Discovery Configuration Types
// ============================================

export interface DiscoveryConfig {
  // Identity
  id: string;
  name: string;
  slug: string; // URL path (e.g., "toca" for /toca)
  
  // Partner Group (for API key inheritance)
  partnerGroupId?: string;
  
  // Organization/Facility
  organizationIds: string[];
  facilityIds: string[];
  
  // Program filtering (optional)
  excludedProgramIds?: string[]; // Programs to exclude from this page
  includedProgramIds?: string[]; // Programs to include (when using include mode)
  
  // Branding
  branding: BrandingConfig;
  
  // Features
  features: FeatureConfig;
  
  // API (server-side only)
  apiKey?: string;
  
  // Analytics
  gtmId?: string; // Google Tag Manager container ID (inherits from partner group if not set)
  
  // URL Parameters
  allowedParams: string[];
  defaultParams: Record<string, string>;
  
  // Cache settings
  cacheTtl: number; // seconds
  
  // Status
  isActive?: boolean; // Whether the page is published
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  headerBackgroundColor?: string; // Hex color for the header bar background (defaults to white)
  logo?: string;
  favicon?: string;
  companyName: string;
  tagline?: string;
  showTaglineOnMobile?: boolean; // Show tagline on mobile screens (default: false)
  fontFamily?: string; // e.g., 'Inter', 'Roboto', 'Open Sans'
}

export type ScheduleViewType = 'list' | 'table' | 'day' | 'week' | 'month';
export type ScheduleTableColumn =
  | 'date'
  | 'time'
  | 'event'
  | 'program'
  | 'location'
  | 'space'
  | 'spots'
  | 'action';

export type LinkBehavior = 'new_tab' | 'same_window' | 'in_frame' | 'host_routed';
export type ProgramFilterMode = 'all' | 'exclude' | 'include';
export type EnabledTab = 'programs' | 'schedule';

export type BondEmbedPortalTemplate = 'classic' | 'hero-carousel' | 'schedule-first';

/** Portal/public discovery template. Absent or 'current' → existing rendering unchanged. */
export type PortalTemplate = 'current' | 'v2';

/** Temporary comparison flag: member-price presentation on v2 cards. */
export type MemberPricingStyle = 'inline' | 'badge' | 'stacked';

/** Session-card presentation on the v2 sessions path. Default 'classic' (existing card). */
export type PortalCardStyle = 'classic' | 'stacked' | 'rows' | 'list';

/**
 * v2 display mode: 'sessions' renders a flat session-card view, 'programs' groups
 * sessions under program headings. 'auto' (default) → sessions when the page scope
 * resolves to exactly one program, programs otherwise.
 */
export type PortalDisplayMode = 'programs' | 'sessions' | 'auto';

/**
 * Session-level columns available in the v2 rows card style.
 * Separate from ScheduleTableColumn (which covers the schedule/list table and includes
 * event-level columns like 'time' and 'space' that don't apply to session rows).
 */
export type PortalRowColumn = 'date' | 'event' | 'program' | 'location' | 'spots' | 'action' | 'schedule';

/**
 * What a clicked row expands to show.
 * 'sessions': each row is a session, expanding shows segment schedule options.
 * 'programs': each row is a program, expanding shows its sessions (future).
 */
export type PortalRowExpandMode = 'sessions' | 'programs';

export enum HostPortalLayoutEnum {
  LEGACY_PROGRAMS = 'legacy_programs',
  SESSIONS_FIRST = 'sessions_first',
  SESSIONS_LIST = 'sessions_list',
}

export enum PortalSessionSortEnum {
  START_DATE = 'start_date',
  NAME = 'name',
  PRICE = 'price',
}

export enum PortalAccentSourceEnum {
  SPORT = 'sport',
  BRANDING = 'branding',
}

export enum PortalSessionLayoutEnum {
  LIST = 'list',
  GRID = 'grid',
}

export interface FeatureConfig {
  showPricing: boolean;
  showAvailability: boolean;
  showMembershipBadges: boolean;
  showAgeGender: boolean;
  showSearch?: boolean; // Show search bar in filters (default: true)
  showShareButton?: boolean; // Show share/copy link button (default: true)
  showRegisterIcon?: boolean; // Show icon on Register buttons (default: true)
  enableFilters: FilterType[];
  defaultView: ViewMode;
  defaultScheduleView?: ScheduleViewType; // Default view for schedule tab
  mobileDefaultScheduleView?: ScheduleViewType; // Default view for mobile (defaults to 'list')
  allowViewToggle: boolean;
  showTableView?: boolean; // Show table view option on desktop
  tableColumns?: ScheduleTableColumn[]; // Columns to show in schedule table view
  allowTableViewOnMobile?: boolean; // Allow table view below md width (bypasses ~768px schedule breakpoint)
  // Embed-friendly options
  headerDisplay?: 'full' | 'minimal' | 'hidden'; // Header visibility mode (default: 'full')
  disableStickyHeader?: boolean; // Disable sticky main header (calendar headers still stick)
  // Link behavior for registration buttons
  linkBehavior?: LinkBehavior; // How registration links open (default: 'new_tab')
  consumerOrigin?: string; // Bond consumer base URL for host shell checkout iframe
  partnerPublicOrigin?: string; // Partner public site origin (e.g. https://www.org.com)
  linkSeoPathPrefix?: string; // Discovery path on partner site (default /programs)
  checkoutLandingPath?: string; // Partner checkout shell page (default /programs/register)
  /** Portal /portal/{slug} layout: legacy DiscoveryPage vs session-first cards */
  hostPortalLayout?: HostPortalLayoutEnum;
  /** Optional hero banner on sessions_list layout (and sessions_first if enabled) */
  portalHeroEnabled?: boolean;
  /** Hero headline override (default: sport label or page name) */
  portalHeroTitle?: string;
  /** Hero subcopy override (default: generated from program filter context) */
  portalHeroSubtitle?: string;
  /** Hero / session strip accents: sport palette vs organization brand colors */
  portalAccentSource?: PortalAccentSourceEnum;
  /** Default session presentation on portal: list rows vs grid cards */
  portalSessionLayoutDefault?: PortalSessionLayoutEnum;
  /** When true, users can switch list/grid via icon toggle (URL: sessionLayout=) */
  allowPortalSessionLayoutToggle?: boolean;
  // Tab visibility
  enabledTabs?: EnabledTab[]; // Which tabs to show (default: ['programs', 'schedule'])
  // Program filtering mode
  programFilterMode?: ProgramFilterMode; // How to filter programs (default: 'all')
  excludedProgramIds?: string[]; // When programFilterMode is 'exclude'
  // Program IDs to include (when programFilterMode is 'include')
  includedProgramIds?: string[];
  // Custom registration URL (for single-program pages)
  customRegistrationUrl?: string; // Override registration URL for all links
  // Hide registration links
  hideRegistrationLinks?: boolean; // Hide all Register/Learn More buttons (default: false)
  // Rollout flag for cache-first discovery schedule path
  discoveryCacheEnabled?: boolean;
  // TTL for availability overlay cache in seconds
  availabilityCacheTtl?: number;
  // Warm policy used by cron
  discoveryRefreshPolicy?: '5min' | '15min' | '30min' | '60min';
  // Schedule visual style for experiment packs
  scheduleThemeStyle?: 'gradient' | 'solid';
  // Show compact mobile quick chips for key filters
  mobileQuickFilterChips?: boolean;
  // Max months of future events to return (default: 3)
  eventHorizonMonths?: number;
  // Bond public API environment for this discovery page
  bondEnv?: BondEnv;
  /** When true, show “Redeem pass” for events whose session has a punch-pass product */
  showPunchPassRedeemButton?: boolean;
  /** Override URL for redeem pass (default https://bondsports.co/user/passes) */
  punchPassRedeemUrl?: string;
  /**
   * When true, schedule table view shows compact date/day filters and applies them to events.
   * Default off — opt in per page after testing.
   */
  showScheduleTableDateFilters?: boolean;
  /**
   * When true (default), discovery filter state is saved/restored via `localStorage` for this slug.
   * Set false in admin to disable browser storage for compliance (URL params still work).
   */
  persistFiltersInLocalStorage?: boolean;
  /** Label for the space/court column and space filter (default: "Space") */
  spaceColumnLabel?: string;
  /**
   * When true, discovery can show league-specific schedule table columns and CSV export
   * after the visitor narrows to league program type or only league programs
   * (`lib/league-schedule-context.ts`). Default off — opt in per page in admin.
   */
  showLeagueScheduleTableAndExport?: boolean;
  /**
   * When true, league events in the schedule show a Standings link to the Bond
   * consumer season page's competition tab (derived from the event's linkSEO).
   * Default off — opt in per page in admin.
   */
  showLeagueStandingsLink?: boolean;
  /**
   * Redesigned discovery template (plan 009). Only 'v2' changes rendering;
   * absent/'current'/unknown values keep the existing templates byte-identical.
   */
  portalTemplate?: PortalTemplate;
  /**
   * Min card width in px feeding `repeat(auto-fill, minmax(var(--card-min-w), 1fr))`
   * on the v2 grid. Default depends on layout mode (cards ~240, list rows denser).
   */
  portalCardMinWidth?: number;
  /** Temporary: member price row style on v2 cards while the operator compares variants. */
  memberPricingStyle?: MemberPricingStyle;
  /** Session-card style on the v2 sessions path (classic | stacked | rows). Default classic. */
  portalCardStyle?: PortalCardStyle;
  /** v2 programs-vs-sessions display mode. Default 'auto' (sessions when one program). */
  portalDisplayMode?: PortalDisplayMode;
  /**
   * Columns to show in the v2 rows card style. Independent of tableColumns (schedule table).
   * When unset, all session-level columns are shown.
   */
  portalRowColumns?: PortalRowColumn[];
  /**
   * What clicking a row expands to show. Default 'sessions' (session rows expand to
   * show segment schedule options). 'programs' is reserved for a future program-rows mode.
   */
  portalRowExpandMode?: PortalRowExpandMode;
  /** When true, show early-bird / late-fee pricing labels on session cards and rows. */
  showTieredSessionPricing?: boolean;
  /** Show waitlist badges and Join Waitlist CTAs on the schedule tab (default true) */
  showWaitlist?: boolean;
  /** Show program type tag (e.g. Drop-in, Class) on schedule events (default true) */
  showScheduleEventType?: boolean;
  /** Layout for iframe-free embed kit (`/embed-kit/v1`) */
  embedPortalTemplate?: BondEmbedPortalTemplate;
  /** When set, browser `Origin` must match one entry for embed-kit CORS */
  embedAllowedOrigins?: string[];
}

export type FilterType = 
  | 'search' 
  | 'facility' 
  | 'program'
  | 'sport' 
  | 'programType' 
  | 'dateRange'
  | 'date' // alias for dateRange 
  | 'age' 
  | 'gender' 
  | 'price' 
  | 'availability'
  | 'membership'
  | 'space';

// ============================================
// Discovery UI Types
// ============================================

export type ViewMode = 'programs' | 'schedule';

export interface DiscoveryFilters {
  search?: string;
  facilityIds?: string[];
  programIds?: string[];
  sessionIds?: string[]; // Filter to specific sessions
  programTypes?: ProgramType[];
  sports?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  ageRange?: {
    min?: number;
    max?: number;
  };
  gender?: Gender | 'all';
  /** Portal: multi-select gender filter (any selected gender matches) */
  genders?: Array<Exclude<Gender, 'all'>>;
  /** Portal: multi-select age bucket ids (see portal-age-buckets) */
  ageBucketIds?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  availability?: 'all' | 'available' | 'almost_full' | 'has_spots';
  /** Portal: multi-select availability (any selected mode matches) */
  availabilityModes?: Array<'available' | 'almost_full'>;
  membershipRequired?: boolean | null;
  /** Local weekdays (0=Sun … 6=Sat) to include; empty/undefined = all */
  daysOfWeek?: number[];
  /** Schedule: filter events whose `spaceName` matches (court/field/resource label) */
  spaceNames?: string[];
}

// Calendar/Schedule Types
export interface CalendarEvent {
  id: string;
  programId: string;
  programName: string;
  sessionId: string;
  sessionName: string;
  title?: string;  // Event-specific title (falls back to programName)
  
  // When
  date: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  
  // Where
  facilityId: string;
  facilityName: string;
  spaceName?: string;  // Resource/court/field name
  location?: string;
  
  // Capacity
  maxParticipants?: number;
  currentParticipants?: number;
  spotsRemaining?: number;
  
  // Display
  sport?: string;
  programType?: ProgramType;
  color: string;
  
  // Pricing preview
  startingPrice?: number;
  memberPrice?: number;
  membershipRequired?: boolean;
  
  // Links
  linkSEO?: string;
  
  // Registration status
  registrationWindowStatus?: 'open' | 'closed' | 'upcoming' | 'ended' | string;
  type?: string;
  
  // Waitlist
  isWaitlistEnabled?: boolean;
  waitlistCount?: number;
  
  // Segment info (for segmented sessions)
  segmentId?: string;
  segmentName?: string;
  isSegmented?: boolean;

  /** Session has at least one Bond product with isPunchPass */
  hasPunchPassProduct?: boolean;
}

export interface DaySchedule {
  date: string;
  dayOfWeek: string;
  events: CalendarEvent[];
  isToday: boolean;
  isPast: boolean;
}

export interface WeekSchedule {
  weekStart: string;
  weekEnd: string;
  days: DaySchedule[];
}

// ============================================
// Utility Types
// ============================================

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

export interface SortOption {
  id: string;
  label: string;
  field: string;
  direction: 'asc' | 'desc';
}

// URL Parameters
export interface UrlParams extends DiscoveryFilters {
  orgIds?: string;
  viewMode?: ViewMode;
  showFilters?: string;
}
