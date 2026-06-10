# Plan 008 — Settings inventory (no-loss checklist)

Every input field in the page editor before the restructure, its config path,
where it lived, and where it lands. Statuses: **MOVED** (different section),
**KEPT** (same logical section, possibly renamed), **REMOVED-from-UI**
(embed-kit-only; stored config value preserved per plan 007 — UI removal only).

Target sections: 1 Page · 2 Appearance · 3 Programs & Filters ·
4 Registration & Analytics · 5 Data & Caching.

| # | Label | Config path | Old section | Target section | Status |
|---|-------|-------------|-------------|----------------|--------|
| 1 | Page Name | `name` | Basics | 1 Page | KEPT |
| 2 | URL Slug | `slug` | Basics | 1 Page | KEPT |
| 3 | Organization IDs | `organizationIds` | Basics | 1 Page | KEPT |
| 4 | Facility IDs | `facilityIds` | Basics | 1 Page | KEPT |
| 5 | Page Status (Active/Draft) | `isActive` | Basics | 1 Page | KEPT |
| 6 | Bond Sports API key | `apiKey` | Advanced | 1 Page | MOVED |
| 7 | Allowed website origins (CORS) | `features.embedAllowedOrigins` | Embed | 1 Page | MOVED (live CORS infra — gates cross-origin browser access to `/api/events`; see `lib/embed-cors.ts`) |
| 8 | Company / brand name | `branding.companyName` | Branding | 2 Appearance | MOVED |
| 9 | Tagline | `branding.tagline` | Branding | 2 Appearance | MOVED |
| 10 | Show tagline on mobile | `branding.showTaglineOnMobile` | Branding | 2 Appearance | MOVED |
| 11 | Logo URL | `branding.logo` | Branding | 2 Appearance | MOVED |
| 12 | Primary color | `branding.primaryColor` | Branding | 2 Appearance | MOVED |
| 13 | Secondary color | `branding.secondaryColor` | Branding | 2 Appearance | MOVED |
| 14 | Accent color | `branding.accentColor` | Branding | 2 Appearance | MOVED |
| 15 | Header background | `branding.headerBackgroundColor` | Branding | 2 Appearance | MOVED |
| 16 | Schedule & portal theme style | `features.scheduleThemeStyle` | Branding | 2 Appearance | MOVED |
| 17 | Header display | `features.headerDisplay` | Embed | 2 Appearance | MOVED (live: consumed by `components/discovery/DiscoveryPage.tsx`, `lib/host-shell/portal-config.ts`) |
| 18 | Disable sticky main header | `features.disableStickyHeader` | Embed | 2 Appearance | MOVED (live: same consumers as headerDisplay) |
| 19 | Partner site URL | `features.partnerPublicOrigin` | Host portal | 2 Appearance (Partner site integration) | MOVED |
| 20 | Bond checkout domain | `features.consumerOrigin` | Host portal | 2 Appearance (Partner site integration) | MOVED |
| 21 | Programs page path (org site) | `features.linkSeoPathPrefix` | Host portal | 2 Appearance (Partner site integration) | MOVED |
| 22 | Checkout page path (org site) | `features.checkoutLandingPath` | Host portal | 2 Appearance (Partner site integration) | MOVED |
| 23 | Portal discovery layout | `features.hostPortalLayout` | Host portal | 2 Appearance (Portal overrides) | MOVED |
| 24 | Default session view | `features.portalSessionLayoutDefault` | Host portal | 2 Appearance (Portal overrides) | MOVED |
| 25 | Allow visitors to switch list/grid | `features.allowPortalSessionLayoutToggle` | Host portal | 2 Appearance (Portal overrides) | MOVED |
| 26 | Show hero banner above filters | `features.portalHeroEnabled` | Host portal (PortalSessionsBrandingControls) | 2 Appearance (Portal overrides) | MOVED |
| 27 | Hero title | `features.portalHeroTitle` | Host portal (PortalSessionsBrandingControls) | 2 Appearance (Portal overrides) | MOVED |
| 28 | Hero subtitle | `features.portalHeroSubtitle` | Host portal (PortalSessionsBrandingControls) | 2 Appearance (Portal overrides) | MOVED |
| 29 | Use organization branding on hero | `features.portalAccentSource` | Host portal (PortalSessionsBrandingControls) | 2 Appearance (Portal overrides) | MOVED |
| 30 | Program filtering mode | `features.programFilterMode` | Basics | 3 Programs & Filters | MOVED |
| 31 | Excluded program IDs | `excludedProgramIds` | Basics | 3 Programs & Filters | MOVED |
| 32 | Included program IDs | `includedProgramIds` + `features.includedProgramIds` (written together) | Basics | 3 Programs & Filters | MOVED |
| 33 | Custom registration URL (single included program) | `features.customRegistrationUrl` | Basics | 3 Programs & Filters | MOVED (stays contextual to the single-program include mode) |
| 34 | Programs tab / Schedule tab visibility | `features.enabledTabs` | Programs & schedule | 3 Programs & Filters | KEPT |
| 35 | Default tab | `features.defaultView` | Programs & schedule | 3 Programs & Filters | KEPT |
| 36 | Default schedule view (desktop) | `features.defaultScheduleView` | Programs & schedule | 3 Programs & Filters | KEPT |
| 37 | Default schedule view (mobile) | `features.mobileDefaultScheduleView` | Programs & schedule | 3 Programs & Filters | KEPT |
| 38 | Show pricing information | `features.showPricing` | Programs & schedule | 3 Programs & Filters | KEPT |
| 39 | Show availability / spots remaining | `features.showAvailability` | Programs & schedule | 3 Programs & Filters | KEPT |
| 40 | Show membership badges | `features.showMembershipBadges` | Programs & schedule | 3 Programs & Filters | KEPT |
| 41 | Show age and gender restrictions | `features.showAgeGender` | Programs & schedule | 3 Programs & Filters | KEPT |
| 42 | Show search bar | `features.showSearch` | Programs & schedule | 3 Programs & Filters | KEPT |
| 43 | Show share / copy link button | `features.showShareButton` | Programs & schedule | 3 Programs & Filters | KEPT |
| 44 | Show icon on Register buttons | `features.showRegisterIcon` | Programs & schedule | 3 Programs & Filters | KEPT |
| 45 | Allow switching Programs/Schedule view | `features.allowViewToggle` | Programs & schedule | 3 Programs & Filters | KEPT |
| 46 | Show Table view option on desktop | `features.showTableView` | Programs & schedule | 3 Programs & Filters | KEPT |
| 47 | Show league table & export option | `features.showLeagueScheduleTableAndExport` | Programs & schedule | 3 Programs & Filters | KEPT |
| 48 | Enable mobile quick chips | `features.mobileQuickFilterChips` | Programs & schedule | 3 Programs & Filters | KEPT |
| 49 | Table columns | `features.tableColumns` | Programs & schedule | 3 Programs & Filters | KEPT |
| 50 | Allow table view on mobile | `features.allowTableViewOnMobile` | Programs & schedule | 3 Programs & Filters | KEPT |
| 51 | Show schedule table date & weekday filters | `features.showScheduleTableDateFilters` | Programs & schedule | 3 Programs & Filters | KEPT |
| 52 | Visitor filters (10 checkboxes) | `features.enableFilters` | Filters | 3 Programs & Filters | MOVED |
| 53 | Space column label | `features.spaceColumnLabel` | Filters | 3 Programs & Filters | MOVED |
| 54 | Remember filter selections (localStorage) | `features.persistFiltersInLocalStorage` | Filters | 3 Programs & Filters | MOVED |
| 55 | Hide registration links | `features.hideRegistrationLinks` | Registration | 4 Registration & Analytics | KEPT |
| 56 | Registration link behavior | `features.linkBehavior` | Registration | 4 Registration & Analytics | KEPT (live: consumed by `DiscoveryPage.tsx`, `lib/config.ts`, `lib/host-shell/portal-schedule-events.ts` — NOT embed-kit-only despite the plan-007 era assumption) |
| 57 | Show punch pass redeem button | `features.showPunchPassRedeemButton` | Registration | 4 Registration & Analytics | KEPT |
| 58 | Punch pass redeem URL | `features.punchPassRedeemUrl` | Registration | 4 Registration & Analytics | KEPT |
| 59 | Google Tag Manager ID | `gtmId` | Analytics | 4 Registration & Analytics | MOVED (with inline list of fired events per plan 004) |
| 60 | Deep-link URL examples (read-only) | n/a (`defaultParams` is config-passthrough; no editor input) | Advanced | 4 Registration & Analytics | MOVED |
| 61 | Bond env | `features.bondEnv` | Advanced | 5 Data & Caching | MOVED (amber live-page warning added) |
| 62 | Cache TTL (seconds) | `cacheTtl` | Advanced | 5 Data & Caching | MOVED |
| 63 | Availability cache TTL (seconds) | `features.availabilityCacheTtl` | Advanced | 5 Data & Caching | MOVED |
| 64 | Cache warm policy | `features.discoveryRefreshPolicy` | Advanced | 5 Data & Caching | MOVED |
| 65 | Event horizon (months) | `features.eventHorizonMonths` | Advanced | 5 Data & Caching | MOVED |
| 66 | Enable cache-first schedule | `features.discoveryCacheEnabled` | Advanced | 5 Data & Caching | MOVED (amber live-page warning added) |
| 67 | Embed portal layout | `features.embedPortalTemplate` | Embed | — | REMOVED-from-UI (only consumer is the retired `app/api/embed/bootstrap`; stored value preserved per plan 007) |

## Save-handler coverage check

`page.tsx`'s save handler writes: full `config` object (all paths above) plus
explicit sanitization of `organizationIds` (#3), `facilityIds` (#4), and
`features.embedAllowedOrigins` (#7). All appear in the table. No hidden /
implicit settings found (`defaultParams`, `id` are passthrough, never edited).

## Reconciliation (Step 5)

- [x] Section 1 Page: #1–7 present in `PageEditorPageSection.tsx`
- [x] Section 2 Appearance: #8–29 present in `PageEditorAppearanceSection.tsx` (+`PortalSessionsBrandingControls`)
- [x] Section 3 Programs & Filters: #30–54 present in `PageEditorProgramsSection.tsx`
- [x] Section 4 Registration & Analytics: #55–60 present in `PageEditorRegistrationSection.tsx`
- [x] Section 5 Data & Caching: #61–66 present in `PageEditorDataSection.tsx`
- [x] #67 removed from UI; stored config value untouched (wire format unchanged)

Counts: 27 KEPT · 39 MOVED · 1 REMOVED-from-UI (67 rows total).
