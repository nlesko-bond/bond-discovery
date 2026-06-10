import type { BondEmbedPortalTemplate } from '@/types';
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
  | 'basics'
  | 'branding'
  | 'programs'
  | 'filters'
  | 'registration'
  | 'embed'
  | 'host-portal'
  | 'analytics'
  | 'advanced';

export interface IPageEditorSectionProps {
  config: IPageConfig;
  setConfig: (next: IPageConfig) => void;
}

export interface IPageEditorBasicsSectionProps extends IPageEditorSectionProps {
  organizationIdsInput: string;
  setOrganizationIdsInput: (value: string) => void;
  facilityIdsInput: string;
  setFacilityIdsInput: (value: string) => void;
}

export interface IPageEditorProgramsSectionProps extends IPageEditorSectionProps {
  activeTableColumns: IPageConfig['features']['tableColumns'];
  updateTableColumns: (nextColumns: NonNullable<IPageConfig['features']['tableColumns']>) => void;
}

export interface IPageEditorEmbedSectionProps extends IPageEditorSectionProps {
  embedAllowedOriginsInput: string;
  setEmbedAllowedOriginsInput: (value: string) => void;
}

export interface IPageEditorHostPortalSectionProps extends IPageEditorSectionProps {
  onNavigateToSection: (section: PageEditorSectionId) => void;
}

export const PAGE_EDITOR_SECTIONS: ReadonlyArray<{
  id: PageEditorSectionId;
  label: string;
  description: string;
}> = [
  { id: 'basics', label: 'Basics', description: 'Identity, scope, and program filtering' },
  { id: 'branding', label: 'Branding', description: 'Logo, colors, and theme style' },
  { id: 'programs', label: 'Programs & schedule', description: 'Tabs, views, and display options' },
  { id: 'filters', label: 'Filters', description: 'Which filters visitors can use' },
  { id: 'registration', label: 'Registration', description: 'Register links and checkout behavior' },
  { id: 'embed', label: 'Embed (Bond iframe)', description: 'Header and script embed on Bond URLs' },
  { id: 'host-portal', label: 'Host portal', description: 'Webflow org site and /portal layout' },
  { id: 'analytics', label: 'Analytics', description: 'Google Tag Manager' },
  { id: 'advanced', label: 'Advanced', description: 'API, cache, and deep links' },
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
