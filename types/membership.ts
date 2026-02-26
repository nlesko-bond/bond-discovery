// ============================================
// Membership API Types
// ============================================

export interface MembershipApiResponse {
  meta: {
    type: string;
    itemsPerPage: number;
    totalItems: number;
    currentPage: number;
    totalPages: number;
  };
  data: Membership[];
}

export interface Membership {
  id: number;
  organizationId: number;
  name: string;
  description: string;
  customerTypes: string[]; // e.g. ["family"], ["individual"], ["senior"]
  activity: number;
  facilityId: number;
  questionnaires: number[];
  minAgeYears: number;
  maxAgeYears: number;
  gender: number;
  maxMembers: number | null;
  maxMaleMembers: number | null;
  maxFemaleMembers: number | null;
  membershipType: string; // e.g. "fix_membership"
  durationMonths: number | null;
  startDate: string;
  endDate: string;
  registrationStartDate: string;
  registrationEndDate: string;
  tagline: string | null;
  isAutoRenew: boolean;
  importedId: string | null;
  mainMedia: MembershipMedia | null;
  tags: any[];
  createdAt: string;
  updatedAt: string;
  package: MembershipPackage;
  children: MembershipChild[];
}

export interface MembershipMedia {
  id: number;
  url: string;
  mediaType?: number;
  fileType?: string;
  name?: string;
}

export interface MembershipPackage {
  parentProduct: MembershipProduct;
}

export interface MembershipProduct {
  id: number;
  organizationId: number;
  name: string;
  description: string;
  productType: string;
  quantity: number;
  isTaxInclusive: boolean;
  status: string;
  state: string;
  isAvailableOnline: boolean;
  isPublic: boolean;
  prices: MembershipPrice[];
  currPrice: MembershipPrice;
  defaultPrice: MembershipPrice;
  dependentProducts: MembershipProduct[];
  requiredProductIds: number[];
  glCodes: any[];
  resourceSettings: any[];
  createdAt: string;
  updatedAt: string;
}

export interface MembershipPrice {
  id: number;
  organizationId: number;
  productId: number;
  packageId: number | null;
  name: string;
  price: number;
  currency: string;
  startDate: string;
  endDate: string;
  deletedAt: string | null;
  discountMethod: string | null;
  discountValue: number | null;
  maxQuantity: number | null;
  minQuantity: number | null;
}

export interface MembershipChild {
  product: {
    id: number;
    organizationId: number;
    name: string;
    description: string;
    productType: string;
    quantity: number;
    isTaxInclusive: boolean;
    status: string;
    state: string;
    isAvailableOnline: boolean;
    isPublic: boolean;
    prices: MembershipPrice[];
    currPrice: MembershipPrice;
    defaultPrice: MembershipPrice;
    productResources: {
      resourceId: number;
      resourceType: string;
    }[];
  };
  relationType: string;
}

// ============================================
// Membership Page Config (Supabase row)
// ============================================

export interface MembershipBranding {
  primaryColor: string;
  accentColor: string;
  accentColorLight?: string;
  bgColor: string;
  fontHeading: string;
  fontBody: string;
  logoUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
}

export interface MembershipNavLink {
  label: string;
  url: string;
}

export interface MembershipFooterInfo {
  address?: string;
  email?: string;
  phone?: string;
}

export interface CategoryOverride {
  key: string;        // unique identifier, e.g. "senior", "youth"
  label: string;      // tab display label, e.g. "Senior (65+)"
  minAge?: number;    // match if membership minAgeYears >= this
  maxAge?: number;    // match if membership maxAgeYears <= this
  nameContains?: string; // match if membership name contains this (case-insensitive)
  badgeBg: string;    // badge background color
  badgeColor: string; // badge text color
}

export interface MembershipPageConfig {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  organization_id: number;
  organization_name: string | null;
  organization_slug: string | null;
  facility_id: number | null;
  branding: MembershipBranding;
  membership_ids_include: number[] | null;
  membership_ids_exclude: number[] | null;
  include_not_open_for_registration: boolean;
  registration_link_template: string;
  nav_links: MembershipNavLink[] | null;
  footer_info: MembershipFooterInfo | null;
  category_overrides: CategoryOverride[] | null;
  cache_ttl: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Transformed Display Types
// ============================================

export type MembershipCategory = 'family' | 'individual' | 'senior' | (string & {});

export interface TransformedMembership {
  id: number;
  name: string;
  displayName: string;
  category: MembershipCategory;
  memberCount: number;
  minAge: number;
  maxAge: number;
  price: number;
  priceFormatted: string;
  pricePerPerson: number | null;
  pricePerPersonFormatted: string | null;
  currency: string;
  isTaxInclusive: boolean;
  registrationOpen: boolean;
  registrationUrl: string;
  seasonStart: string;
  seasonEnd: string;
  registrationStartDate: string;
  registrationEndDate: string;
  hasDependentProducts: boolean;
  dependentProductNames: string[];
  badgeLabel: string; // e.g. "Person" or "People"
  badgeStyle?: { bg: string; color: string };
}

export interface MembershipPageData {
  memberships: TransformedMembership[];
  categories: MembershipCategory[];
  categoryLabels: Record<string, string>;
  seasonDateRange: { start: string; end: string } | null;
  registrationDeadline: string | null;
  ageRange: { min: number; max: number } | null;
  priceRange: { min: number; max: number } | null;
  isTaxInclusive: boolean;
  totalCount: number;
}
