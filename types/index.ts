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
  
  // Registration status
  registrationWindowStatus?: 'open' | 'closed' | 'not_opened_yet' | 'ended' | string;
  
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
  logo?: string;
  favicon?: string;
  companyName: string;
  tagline?: string;
  showTaglineOnMobile?: boolean; // Show tagline on mobile screens (default: false)
  fontFamily?: string; // e.g., 'Inter', 'Roboto', 'Open Sans'
}

export type ScheduleViewType = 'list' | 'table' | 'day' | 'week' | 'month';

export type LinkBehavior = 'new_tab' | 'same_window' | 'in_frame';
export type ProgramFilterMode = 'all' | 'exclude' | 'include';
export type EnabledTab = 'programs' | 'schedule';

export interface FeatureConfig {
  showPricing: boolean;
  showAvailability: boolean;
  showMembershipBadges: boolean;
  showAgeGender: boolean;
  enableFilters: FilterType[];
  defaultView: ViewMode;
  defaultScheduleView?: ScheduleViewType; // Default view for schedule tab
  mobileDefaultScheduleView?: ScheduleViewType; // Default view for mobile (defaults to 'list')
  allowViewToggle: boolean;
  showTableView?: boolean; // Show table view option on desktop
  // Embed-friendly options
  headerDisplay?: 'full' | 'minimal' | 'hidden'; // Header visibility mode (default: 'full')
  disableStickyHeader?: boolean; // Disable sticky main header (calendar headers still stick)
  // Link behavior for registration buttons
  linkBehavior?: LinkBehavior; // How registration links open (default: 'new_tab')
  // Tab visibility
  enabledTabs?: EnabledTab[]; // Which tabs to show (default: ['programs', 'schedule'])
  // Program filtering mode
  programFilterMode?: ProgramFilterMode; // How to filter programs (default: 'all')
  // Custom registration URL (for single-program pages)
  customRegistrationUrl?: string; // Override registration URL for all links
  // Hide registration links
  hideRegistrationLinks?: boolean; // Hide all Register/Learn More buttons (default: false)
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
  | 'membership';

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
  priceRange?: {
    min?: number;
    max?: number;
  };
  availability?: 'all' | 'available' | 'almost_full' | 'has_spots';
  membershipRequired?: boolean | null;
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
