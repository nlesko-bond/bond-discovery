/**
 * Test Fixtures and Mock Data
 * Shared mock objects for unit tests
 */

import { vi } from 'vitest';
import { 
  Program, 
  Session, 
  Product, 
  Price,
  DiscoveryConfig, 
  BrandingConfig, 
  FeatureConfig,
  CalendarEvent,
  DaySchedule,
  WeekSchedule,
  DiscoveryFilters,
  FilterType,
} from '@/types';

// ============================================
// Branding & Feature Configs
// ============================================

export const mockBranding: BrandingConfig = {
  primaryColor: '#1E2761',
  secondaryColor: '#6366F1',
  accentColor: '#8B5CF6',
  logo: 'https://example.com/logo.png',
  companyName: 'Test Sports Facility',
  tagline: 'Find your perfect program',
  fontFamily: 'Inter',
};

export const mockFeatures: FeatureConfig = {
  showPricing: true,
  showAvailability: true,
  showMembershipBadges: true,
  showAgeGender: true,
  enableFilters: ['search', 'facility', 'programType', 'sport', 'age', 'dateRange', 'program'] as FilterType[],
  defaultView: 'programs',
  defaultScheduleView: 'list',
  allowViewToggle: true,
  showTableView: true,
  headerDisplay: 'full',
  disableStickyHeader: false,
};

export const mockFeaturesMinimal: FeatureConfig = {
  showPricing: false,
  showAvailability: false,
  showMembershipBadges: false,
  showAgeGender: false,
  enableFilters: ['search'] as FilterType[],
  defaultView: 'programs',
  allowViewToggle: false,
};

// ============================================
// Discovery Config
// ============================================

export const mockConfig: DiscoveryConfig = {
  id: 'test-config-1',
  name: 'Test Discovery Page',
  slug: 'test-page',
  organizationIds: ['123', '456'],
  facilityIds: ['789'],
  branding: mockBranding,
  features: mockFeatures,
  apiKey: 'test-api-key',
  gtmId: 'GTM-TEST123',
  allowedParams: ['viewMode', 'facilityIds', 'programIds', 'programTypes', 'search'],
  defaultParams: {},
  cacheTtl: 300,
  isActive: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
};

export const mockConfigMinimal: DiscoveryConfig = {
  ...mockConfig,
  id: 'test-config-minimal',
  slug: 'test-minimal',
  features: mockFeaturesMinimal,
  gtmId: undefined,
};

// ============================================
// Prices & Products
// ============================================

export const mockPrice: Price = {
  id: 'price-1',
  productId: 'product-1',
  price: 99.99,
  amount: 99.99,
  currency: 'USD',
  name: 'Standard Price',
};

export const mockMemberPrice: Price = {
  id: 'price-2',
  productId: 'product-2',
  price: 79.99,
  amount: 79.99,
  currency: 'USD',
  name: 'Member Price',
};

export const mockFreePrice: Price = {
  id: 'price-3',
  productId: 'product-3',
  price: 0,
  amount: 0,
  currency: 'USD',
  name: 'Free',
};

export const mockProduct: Product = {
  id: 'product-1',
  sessionId: 'session-1',
  name: 'Full Session',
  description: 'Access to all classes in the session',
  type: 'full_session',
  status: 'active',
  isMemberProduct: false,
  prices: [mockPrice],
};

export const mockMemberProduct: Product = {
  id: 'product-2',
  sessionId: 'session-1',
  name: 'Member Full Session',
  description: 'Member pricing for full session',
  type: 'full_session',
  status: 'active',
  isMemberProduct: true,
  prices: [mockMemberPrice],
};

export const mockFreeProduct: Product = {
  id: 'product-3',
  sessionId: 'session-2',
  name: 'Free Trial',
  description: 'Try it free',
  type: 'trial',
  status: 'active',
  isMemberProduct: false,
  prices: [mockFreePrice],
};

// ============================================
// Sessions
// ============================================

export const mockSession: Session = {
  id: 'session-1',
  programId: 'program-1',
  name: 'Spring 2026 Session',
  description: 'Spring session for youth soccer',
  linkSEO: '/programs/youth-soccer/spring-2026',
  facility: {
    id: 789,
    name: 'Main Field',
  },
  startDate: '2026-03-01',
  endDate: '2026-05-31',
  registrationWindowStatus: 'open',
  capacity: 20,
  maxParticipants: 20,
  currentEnrollment: 15,
  spotsRemaining: 5,
  isFull: false,
  products: [mockProduct, mockMemberProduct],
};

export const mockSessionFull: Session = {
  id: 'session-2',
  programId: 'program-1',
  name: 'Summer 2026 Session',
  description: 'Summer session - FULL',
  linkSEO: '/programs/youth-soccer/summer-2026',
  facility: {
    id: 789,
    name: 'Main Field',
  },
  startDate: '2026-06-01',
  endDate: '2026-08-31',
  registrationWindowStatus: 'open',
  capacity: 20,
  maxParticipants: 20,
  currentEnrollment: 20,
  spotsRemaining: 0,
  isFull: true,
  products: [mockProduct],
};

export const mockSessionClosed: Session = {
  id: 'session-3',
  programId: 'program-1',
  name: 'Winter 2025 Session',
  description: 'Registration closed',
  linkSEO: '/programs/youth-soccer/winter-2025',
  facility: {
    id: 789,
    name: 'Main Field',
  },
  startDate: '2025-12-01',
  endDate: '2026-02-28',
  registrationWindowStatus: 'closed',
  capacity: 20,
  maxParticipants: 20,
  currentEnrollment: 18,
  spotsRemaining: 2,
  isFull: false,
  products: [mockProduct],
};

export const mockSessionComingSoon: Session = {
  id: 'session-4',
  programId: 'program-1',
  name: 'Fall 2026 Session',
  description: 'Coming soon',
  linkSEO: '/programs/youth-soccer/fall-2026',
  facility: {
    id: 789,
    name: 'Main Field',
  },
  startDate: '2026-09-01',
  endDate: '2026-11-30',
  registrationWindowStatus: 'not_opened_yet',
  capacity: 20,
  maxParticipants: 20,
  currentEnrollment: 0,
  spotsRemaining: 20,
  isFull: false,
  products: [mockProduct],
};

// ============================================
// Programs
// ============================================

export const mockProgram: Program = {
  id: 'program-1',
  name: 'Youth Soccer Camp',
  description: 'Learn soccer fundamentals in a fun environment',
  longDescription: 'Our youth soccer camp is designed for children ages 5-12...',
  type: 'camp',
  sport: 'soccer',
  facilityId: '789',
  facilityName: 'Main Sports Complex',
  organizationId: '123',
  imageUrl: 'https://example.com/soccer.jpg',
  linkSEO: '/programs/youth-soccer',
  ageMin: 5,
  ageMax: 12,
  gender: 'coed',
  sessions: [mockSession, mockSessionFull],
};

export const mockProgramNoSessions: Program = {
  id: 'program-2',
  name: 'Adult Tennis Clinic',
  description: 'Improve your tennis game',
  type: 'clinic',
  sport: 'tennis',
  facilityId: '789',
  facilityName: 'Tennis Courts',
  organizationId: '123',
  linkSEO: '/programs/adult-tennis',
  ageMin: 18,
  ageMax: undefined,
  gender: 'all',
  sessions: [],
};

export const mockProgramMale: Program = {
  id: 'program-3',
  name: 'Boys Basketball League',
  description: 'Competitive basketball league',
  type: 'league',
  sport: 'basketball',
  facilityId: '790',
  facilityName: 'Indoor Gymnasium',
  organizationId: '123',
  linkSEO: '/programs/boys-basketball',
  ageMin: 10,
  ageMax: 14,
  gender: 'male',
  sessions: [mockSession],
};

export const mockProgramFree: Program = {
  id: 'program-4',
  name: 'Free Fitness Class',
  description: 'Free intro fitness class',
  type: 'class',
  sport: 'fitness',
  facilityId: '789',
  facilityName: 'Fitness Center',
  organizationId: '123',
  linkSEO: '/programs/free-fitness',
  ageMin: 16,
  ageMax: undefined,
  gender: 'all',
  sessions: [{
    ...mockSession,
    id: 'session-free',
    name: 'Free Trial Class',
    products: [mockFreeProduct],
  }],
};

// ============================================
// Calendar Events
// ============================================

export const mockCalendarEvent: CalendarEvent = {
  id: 'event-1',
  programId: 'program-1',
  programName: 'Youth Soccer Camp',
  sessionId: 'session-1',
  sessionName: 'Spring 2026 Session',
  title: 'Soccer Practice',
  date: '2026-03-15',
  startTime: '2026-03-15T10:00:00.000Z',
  endTime: '2026-03-15T11:30:00.000Z',
  facilityId: '789',
  facilityName: 'Main Field',
  spaceName: 'Field A',
  sport: 'soccer',
  programType: 'camp',
  color: 'gradient-soccer',
  startingPrice: 99.99,
  memberPrice: 79.99,
  linkSEO: '/programs/youth-soccer/spring-2026',
  registrationWindowStatus: 'open',
  maxParticipants: 20,
  currentParticipants: 15,
  spotsRemaining: 5,
};

export const mockCalendarEventFull: CalendarEvent = {
  ...mockCalendarEvent,
  id: 'event-2',
  title: 'Soccer Match',
  date: '2026-03-16',
  startTime: '2026-03-16T14:00:00.000Z',
  endTime: '2026-03-16T16:00:00.000Z',
  spotsRemaining: 0,
  currentParticipants: 20,
};

export const mockCalendarEventClosed: CalendarEvent = {
  ...mockCalendarEvent,
  id: 'event-3',
  title: 'Advanced Training',
  date: '2026-03-17',
  startTime: '2026-03-17T09:00:00.000Z',
  endTime: '2026-03-17T10:30:00.000Z',
  registrationWindowStatus: 'closed',
};

// ============================================
// Day & Week Schedules
// ============================================

export const mockDaySchedule: DaySchedule = {
  date: '2026-03-15',
  dayOfWeek: 'Sunday',
  events: [mockCalendarEvent],
  isToday: false,
  isPast: false,
};

export const mockDayScheduleToday: DaySchedule = {
  date: new Date().toISOString().split('T')[0],
  dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
  events: [mockCalendarEvent, mockCalendarEventFull],
  isToday: true,
  isPast: false,
};

export const mockDayScheduleEmpty: DaySchedule = {
  date: '2026-03-18',
  dayOfWeek: 'Wednesday',
  events: [],
  isToday: false,
  isPast: false,
};

export const mockWeekSchedule: WeekSchedule = {
  weekStart: '2026-03-15',
  weekEnd: '2026-03-21',
  days: [
    mockDaySchedule,
    { ...mockDaySchedule, date: '2026-03-16', dayOfWeek: 'Monday', events: [mockCalendarEventFull] },
    { ...mockDaySchedule, date: '2026-03-17', dayOfWeek: 'Tuesday', events: [mockCalendarEventClosed] },
    mockDayScheduleEmpty,
    { ...mockDaySchedule, date: '2026-03-19', dayOfWeek: 'Thursday', events: [] },
    { ...mockDaySchedule, date: '2026-03-20', dayOfWeek: 'Friday', events: [mockCalendarEvent] },
    { ...mockDaySchedule, date: '2026-03-21', dayOfWeek: 'Saturday', events: [] },
  ],
};

// ============================================
// Filters
// ============================================

export const mockFiltersEmpty: DiscoveryFilters = {
  search: '',
  facilityIds: [],
  programIds: [],
  sessionIds: [],
  programTypes: [],
  sports: [],
  dateRange: {},
  ageRange: {},
  gender: 'all',
  availability: 'all',
  membershipRequired: null,
};

export const mockFiltersWithSearch: DiscoveryFilters = {
  ...mockFiltersEmpty,
  search: 'soccer',
};

export const mockFiltersWithFacility: DiscoveryFilters = {
  ...mockFiltersEmpty,
  facilityIds: ['789'],
};

export const mockFiltersComplex: DiscoveryFilters = {
  search: 'camp',
  facilityIds: ['789'],
  programIds: [],
  sessionIds: [],
  programTypes: ['camp', 'clinic'],
  sports: ['soccer', 'basketball'],
  dateRange: {
    start: '2026-03-01',
    end: '2026-05-31',
  },
  ageRange: {
    min: 5,
    max: 12,
  },
  gender: 'coed',
  availability: 'available',
  membershipRequired: false,
};

// ============================================
// Filter Options (for filter components)
// ============================================

export const mockFilterOptions = {
  facilities: [
    { id: '789', name: 'Main Sports Complex', count: 10 },
    { id: '790', name: 'Indoor Gymnasium', count: 5 },
  ],
  // programTypes has both 'name' and 'label' to satisfy HorizontalFilterBar and MobileFilters
  programTypes: [
    { id: 'camp', name: 'Camp', label: 'Camp', count: 8 },
    { id: 'clinic', name: 'Clinic', label: 'Clinic', count: 4 },
    { id: 'league', name: 'League', label: 'League', count: 3 },
  ],
  // sports has both 'name' and 'label' to satisfy HorizontalFilterBar and MobileFilters
  sports: [
    { id: 'soccer', name: 'Soccer', label: 'Soccer', count: 6 },
    { id: 'basketball', name: 'Basketball', label: 'Basketball', count: 4 },
    { id: 'tennis', name: 'Tennis', label: 'Tennis', count: 2 },
  ],
  programs: [
    { id: 'program-1', name: 'Youth Soccer Camp', facilityId: '789', facilityName: 'Main Sports Complex' },
    { id: 'program-2', name: 'Adult Tennis Clinic', facilityId: '789', facilityName: 'Tennis Courts' },
    { id: 'program-3', name: 'Boys Basketball League', facilityId: '790', facilityName: 'Indoor Gymnasium' },
  ],
  sessions: [
    { id: 'session-1', name: 'Spring 2026 Session', programId: 'program-1' },
    { id: 'session-2', name: 'Summer 2026 Session', programId: 'program-1' },
  ],
  ages: [],
};

// ============================================
// Supabase Mock Helpers
// ============================================

export const createMockSupabaseClient = () => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockSingle = vi.fn();
  const mockOrder = vi.fn().mockReturnThis();

  return {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      single: mockSingle,
      order: mockOrder,
    })),
    mockSelect,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockEq,
    mockSingle,
    mockOrder,
  };
};

// ============================================
// Database Row Mocks (for config tests)
// ============================================

export const mockDiscoveryPageRow = {
  id: 'test-config-1',
  name: 'Test Discovery Page',
  slug: 'test-page',
  organization_ids: [123, 456],
  facility_ids: [789],
  api_key: 'test-api-key',
  gtm_id: 'GTM-TEST123',
  partner_group_id: 'partner-1',
  branding: mockBranding,
  features: mockFeatures,
  allowed_params: ['viewMode', 'facilityIds', 'programIds', 'programTypes', 'search'],
  default_params: {},
  cache_ttl: 300,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
  partner_group: {
    api_key: 'partner-api-key',
    gtm_id: 'GTM-PARTNER',
  },
};

export const mockDiscoveryPageRowNoGtm = {
  ...mockDiscoveryPageRow,
  gtm_id: null,
  partner_group: {
    api_key: 'partner-api-key',
    gtm_id: 'GTM-PARTNER',
  },
};

export const mockDiscoveryPageRowEmptyFilters = {
  ...mockDiscoveryPageRow,
  features: {
    ...mockFeatures,
    enableFilters: [],
  },
};
