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

// Program Types
export interface Program {
  id: string;
  name: string;
  description?: string;
  type?: ProgramType;
  sport?: string;
  facilityId?: string;
  facilityName?: string;
  organizationId?: string;
  imageUrl?: string;
  
  // Age/Gender restrictions
  ageMin?: number;
  ageMax?: number;
  gender?: Gender;
  
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
  
  // Dates and times
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  
  // Capacity
  capacity?: number;
  currentEnrollment?: number;
  spotsRemaining?: number;
  isFull?: boolean;
  waitlistEnabled?: boolean;
  waitlistCount?: number;
  
  // Status
  status?: SessionStatus;
  
  // Age/Gender (can override program)
  ageMin?: number;
  ageMax?: number;
  gender?: Gender;
  
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
  sessionId: string;
  name: string;
  description?: string;
  type?: ProductType;
  status: ProductStatus;
  
  // Registration dates
  registrationStartDate?: string;
  registrationEndDate?: string;
  earlyBirdEndDate?: string;
  
  // Membership
  membershipRequired: boolean;
  membershipIds?: string[];
  membershipDiscounts?: MembershipDiscount[];
  
  // Capacity (product-level)
  maxParticipants?: number;
  currentParticipants?: number;
  spotsRemaining?: number;
  
  // Pricing
  prices: Price[];
}

export type ProductType = 'full_session' | 'drop_in' | 'package' | 'trial' | 'membership';
export type ProductStatus = 'active' | 'inactive' | 'sold_out' | 'coming_soon';

export interface Price {
  id: string;
  productId: string;
  amount: number; // In cents
  currency: string;
  name?: string;
  description?: string;
  
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
  slug?: string;
  
  // Organization/Facility
  organizationIds: string[];
  facilityIds: string[];
  
  // Branding
  branding: BrandingConfig;
  
  // Features
  features: FeatureConfig;
  
  // API (server-side only)
  apiKey?: string;
  
  // URL Parameters
  allowedParams: string[];
  defaultParams: Record<string, string>;
  
  // Cache settings
  cacheTtl: number; // seconds
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logo?: string;
  favicon?: string;
  companyName: string;
  tagline?: string;
}

export interface FeatureConfig {
  showPricing: boolean;
  showAvailability: boolean;
  showMembershipBadges: boolean;
  showAgeGender: boolean;
  enableFilters: FilterType[];
  defaultView: ViewMode;
  allowViewToggle: boolean;
}

export type FilterType = 
  | 'search' 
  | 'facility' 
  | 'sport' 
  | 'programType' 
  | 'dateRange' 
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
  
  // When
  date: string;
  startTime: string;
  endTime: string;
  
  // Where
  facilityId: string;
  facilityName: string;
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
