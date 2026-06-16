import type {
  BondEmbedPortalTemplate,
  MemberPricingStyle,
  PortalCardStyle,
  PortalDisplayMode,
  PortalRowColumn,
  PortalRowExpandMode,
  PortalTemplate,
} from '@/types';
import type { BondEnv } from '@/lib/bond-env';

export interface IPageConfig {
  id: string;
  name: string;
  slug: string;
  branding: {
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    headerBackgroundColor?: string;
    logo?: string;
    tagline?: string;
    showTaglineOnMobile?: boolean;
  };
  organizationIds: string[];
  facilityIds?: string[];
  excludedProgramIds?: string[];
  includedProgramIds?: string[];
  apiKey?: string;
  gtmId?: string;
  features: {
    showPricing: boolean;
    showAvailability: boolean;
    showMembershipBadges: boolean;
    showAgeGender: boolean;
    showSearch?: boolean;
    showShareButton?: boolean;
    showRegisterIcon?: boolean;
    enableFilters: string[];
    defaultView: 'programs' | 'schedule';
    defaultScheduleView?: 'list' | 'table' | 'day' | 'week' | 'month';
    mobileDefaultScheduleView?: 'list' | 'table' | 'day' | 'week' | 'month';
    allowViewToggle: boolean;
    showTableView?: boolean;
    tableColumns?: (
      | 'date'
      | 'time'
      | 'event'
      | 'program'
      | 'location'
      | 'space'
      | 'spots'
      | 'action'
    )[];
    allowTableViewOnMobile?: boolean;
    enabledTabs?: ('programs' | 'schedule')[];
    programFilterMode?: 'all' | 'exclude' | 'include';
    includedProgramIds?: string[];
    customRegistrationUrl?: string;
    hideRegistrationLinks?: boolean;
    headerDisplay?: 'full' | 'minimal' | 'hidden';
    disableStickyHeader?: boolean;
    linkBehavior?: 'new_tab' | 'same_window' | 'in_frame';
    embedPortalTemplate?: BondEmbedPortalTemplate;
    embedAllowedOrigins?: string[];
    partnerPublicOrigin?: string;
    consumerOrigin?: string;
    linkSeoPathPrefix?: string;
    checkoutLandingPath?: string;
    hostPortalLayout?: 'legacy_programs' | 'sessions_first' | 'sessions_list';
    portalHeroEnabled?: boolean;
    portalHeroTitle?: string;
    portalHeroSubtitle?: string;
    portalAccentSource?: 'sport' | 'branding';
    portalSessionLayoutDefault?: 'list' | 'grid';
    allowPortalSessionLayoutToggle?: boolean;
    portalTemplate?: PortalTemplate;
    portalCardMinWidth?: number;
    memberPricingStyle?: MemberPricingStyle;
    portalCardStyle?: PortalCardStyle;
    portalDisplayMode?: PortalDisplayMode;
    portalRowColumns?: PortalRowColumn[];
    portalRowExpandMode?: PortalRowExpandMode;
    showTieredSessionPricing?: boolean;
    discoveryCacheEnabled?: boolean;
    availabilityCacheTtl?: number;
    discoveryRefreshPolicy?: '5min' | '15min' | '30min' | '60min';
    scheduleThemeStyle?: 'gradient' | 'solid';
    mobileQuickFilterChips?: boolean;
    eventHorizonMonths?: number;
    showPunchPassRedeemButton?: boolean;
    punchPassRedeemUrl?: string;
    showScheduleTableDateFilters?: boolean;
    bondEnv?: BondEnv;
    persistFiltersInLocalStorage?: boolean;
    spaceColumnLabel?: string;
    showLeagueScheduleTableAndExport?: boolean;
  };
  defaultParams?: Record<string, string>;
  cacheTtl?: number;
  isActive?: boolean;
}

export type PageEditorSectionId =
  | 'page'
  | 'appearance'
  | 'programs'
  | 'registration'
  | 'data';

export interface IPageEditorSectionProps {
  config: IPageConfig;
  setConfig: (next: IPageConfig) => void;
}

export interface IPageEditorPageSectionProps extends IPageEditorSectionProps {
  organizationIdsInput: string;
  setOrganizationIdsInput: (value: string) => void;
  facilityIdsInput: string;
  setFacilityIdsInput: (value: string) => void;
  allowedOriginsInput: string;
  setAllowedOriginsInput: (value: string) => void;
}

export interface IPageEditorProgramsSectionProps extends IPageEditorSectionProps {
  activeTableColumns: IPageConfig['features']['tableColumns'];
  updateTableColumns: (nextColumns: NonNullable<IPageConfig['features']['tableColumns']>) => void;
}

export const PAGE_EDITOR_SECTIONS: ReadonlyArray<{
  id: PageEditorSectionId;
  label: string;
  description: string;
}> = [
  { id: 'page', label: 'Page', description: 'Name, slug, org scope, API key, status' },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Branding, header, and portal overrides',
  },
  {
    id: 'programs',
    label: 'Programs & Filters',
    description: 'What shows, default views, visitor filters',
  },
  {
    id: 'registration',
    label: 'Registration & Analytics',
    description: 'Register links, GTM, deep links',
  },
  { id: 'data', label: 'Data & Caching', description: 'Freshness, cache, Bond environment' },
];

export const ALL_FILTERS = [
  { id: 'facility', name: 'Facility', description: 'Filter by location/facility' },
  {
    id: 'space',
    name: 'Space',
    description: 'Filter by space/court/field within a facility',
  },
  { id: 'programType', name: 'Program Type', description: 'Camp, league, clinic, etc.' },
  { id: 'sport', name: 'Sport', description: 'Filter by sport type' },
  { id: 'age', name: 'Age', description: 'Filter by age range' },
  { id: 'gender', name: 'Gender', description: 'Filter by gender' },
  { id: 'dateRange', name: 'Date Range', description: 'Filter by date range' },
  { id: 'program', name: 'Program', description: 'Filter by specific program' },
  { id: 'availability', name: 'Availability', description: 'Available or almost full' },
  { id: 'price', name: 'Price', description: 'Filter by price range' },
] as const;

export const TABLE_COLUMNS = [
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
  { id: 'event', label: 'Event' },
  { id: 'program', label: 'Program' },
  { id: 'location', label: 'Location' },
  { id: 'space', label: 'Space' },
  { id: 'spots', label: 'Spots' },
  { id: 'action', label: 'Action' },
] as const;

export const PORTAL_ROW_COLUMNS: ReadonlyArray<{
  id: PortalRowColumn;
  label: string;
  hint: string;
}> = [
  { id: 'date', label: 'Date', hint: 'Session date range and week count' },
  { id: 'event', label: 'Session', hint: 'Session name, age range (always shown)' },
  { id: 'program', label: 'Program', hint: 'Program / activity name' },
  { id: 'location', label: 'Location', hint: 'Facility name' },
  { id: 'spots', label: 'Availability', hint: 'Open / limited / full pill' },
  { id: 'action', label: 'Price & Register', hint: 'Starting price and Register button' },
];
