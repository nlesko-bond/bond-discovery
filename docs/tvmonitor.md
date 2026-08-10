# TV Monitor pages

Full-screen facility schedule displays for lobby TVs, built from templates or custom
building blocks. Replaces the Webflow "custom TV monitor" prototype
(`prod-testing.webflow.io/utility/monitor/*`) with a self-serve tool inside discovery.

- **Live page**: `discovery.bondsports.co/tvmonitor/{pageName}` — open it in the TV's
  browser and go fullscreen. Noindex, dark, no site chrome.
- **Bond admin**: `/admin/tvmonitor` — create/edit any org's monitors, provision
  external access links (Google auth, @bondsports.co only).
- **External studio**: `/tvmonitor/studio` — org-scoped builder for facility staff,
  unlocked by an access link.

## Data flow

```
TV browser ──poll every refreshSeconds──▶ GET /api/tvmonitor/{slug}/schedule
                                              │  returns { config, schedule }
                                              ▼
                     cachedSWR "tvmonitor:schedule:{org}:{facility}:{spaceIds}:{hours}"
                        ttl 60s · stale shadow 30min (rides out Bond hiccups)
                                              │
                                              ▼
      GET api.bondsports.co/v4/facilities/{facility}/organization/{org}/slots-schedule
                     ?spacesIds=…&futureHoursLimit=…      (public, no auth)
```

- Any number of TVs on the same page cost Bond ~1 request/minute (per unique
  org+facility+spaces+hours scope), never one per TV.
- The poll response includes the **config**, so builder edits (colors, ads, toggles)
  go live on screen within one refresh interval — no TV-side reload needed.
- Fetch failures keep the last good payload on screen.
- **Deploys reach unattended TVs automatically**: every build inlines a
  deployment fingerprint (`NEXT_PUBLIC_TVMONITOR_BUILD`, from
  `VERCEL_GIT_COMMIT_SHA`) into both the page and the schedule API. TVs compare
  the two on every poll and self-reload (jittered 0–90s) when they differ — new
  code is on every screen within ~2 minutes of a production deploy. A daily
  hard reload remains as a memory/safety net.
- This endpoint is the same one the official Bond monitor screens use. It is *not*
  the discovery Public API (`lib/bond-client.ts`) and does not touch
  `discovery:response:{slug}` or any discovery cache invariants.

## Config model

One row per page in Supabase `tvmonitor_pages`
(migration `migrations/014_add_tvmonitor_pages.sql`):
`slug`, `name`, `is_active`, `organization_id`, `facility_id`, and a `config` jsonb
blob normalized by `normalizeTvMonitorConfig()` (`lib/tvmonitor-config.ts`) — every
read is deep-defaulted, so old rows survive new config fields.

Building blocks inside `config`:

| Block | Settings |
|---|---|
| `header` | logo, title, live clock, date, schedule QR, waiver QR, optional sponsor ad slot, optional weather chip (see below) |
| `schedule` | **view** — `columns` (one column per resource) or `feed` (all resources merged into one full-width, chronologically-sorted scrolling list, each event tagged with its resource); resource (space) IDs — cap depends on view, see below; optional "you are here" wayfinding highlight (`columns` only, see below); card style — `cards` (default) or `plain`; hours ahead (1–24), show notes / maintenance / private events + notes size/color/italic/bold, labels, auto-scroll (speed 1–5, pause; `columns` also has synchronized vs independent) |
| `ads[]` | fixed placements: left/right rail (optionally full screen height, header beside it), top/bottom banner, in-header; sized by pixels or % of screen; each rotates image/video assets by URL with per-asset duration. The builder shows each slot's rendered px + aspect ratio. JS ad tags are a planned future asset type. |
| `ticker` | optional scrolling text bar across the bottom of the screen — a label chip + up to 20 plain-text messages, pure CSS marquee. Distinct from `ads[]`: text announcements, not image/video creative. |
| `design` | dark/light presets, Google font, font/secondary/accent colors, background gradient (color 1 → color 2), optional background image with adjustable color-overlay strength, card colors |
| `screenRatio` | `fill` (default) or 16:9 / 4:3 / 21:9 / 9:16 letterboxed |

**Weather** (`header.weather`): a free-text city/ZIP `location` field, geocoded and
forecast via [Open-Meteo](https://open-meteo.com) — a free, keyless public API
(`lib/tvmonitor-weather.ts`). Renders as an icon + °F chip next to the clock in
both header layouts. Fetched server-side (schedule route + SSR page + builder
preview route), cached 15 min with a 6h stale shadow via `cachedSWR`, same
pattern as the Bond schedule fetch. Weather is decorative, not load-bearing:
`getTvMonitorWeather()` swallows any failure (bad location text, Open-Meteo
outage) and returns `null` rather than throwing, so a bad ZIP can never take
down the schedule response the rest of the page depends on — it just hides
the chip.

**Wayfinding banner** (`schedule.primaryResourceId` / `wayfindingLabel`,
`columns` view only): highlights one resource column as "you are here" — a
banner with a downward-pointing triangle above the chosen column, other
columns rendered muted (lower opacity + partial desaturation). Only applies
with more than one column; `normalizeTvMonitorConfig` clears the pointer if it
doesn't resolve to one of the page's current `resourceIds` (same "keep the
pointer only if the target still exists" pattern as `header.sponsorAdId`).

**Card style** (`schedule.cardStyle`): `cards` (default) keeps the existing
bordered/background event cards. `plain` renders centered, stacked text with
no card chrome — separated by a hairline divider instead of a box — for
boards that want a cleaner, more sign-like look. Applies to both `columns`
and `feed` views.

Templates (`lib/tvmonitor-templates.ts`): **Classic Board** (no ads),
**Sponsor Spotlight** (left rail + header sponsor), **Promo Banner** (light theme +
bottom banner), and **Build your own**. A template is only a starting config.

**Duplicating a page**: the list view (`MonitorList`, used by both `/admin/tvmonitor`
and the studio) has a Duplicate action per row (`duplicateTvMonitorPage()` in
`lib/tvmonitor-config.ts`). It copies the name ("Copy of {name}"), org, facility, and
the full config verbatim into a **new, inactive** page — inactive so a duplicate is a
safe starting point to edit, not an instant second live board on the same resources —
and opens straight into its editor. The slug is derived from the new name and
disambiguated with `-2`, `-3`, ... on collision — the editor's **URL name**
field (see below) lets you rename it to whatever the duplicate is actually for.

**Editing the slug**: the Page section has an editable **URL name** field (not
just at creation/duplicate time — any page, including a live one, can be
renamed). `updateTvMonitorPage()` re-validates and re-disambiguates it exactly
like creation. Renaming a live page is deliberately *not* blocked — an admin
or studio user may need to fix a typo or rename post-launch — but the editor
shows a red/amber warning banner (red when the page `is_active`) as soon as
the field differs from the saved value: the old address 404s immediately for
anyone holding it (a link, QR code, or bookmark), since there is no redirect
or alias. Saving a slug change also client-side redirects the browser to the
new editor URL, since the route itself is keyed by slug.

**Editing the organization** (Bond admin only): the Data source section has an
editable **Organization ID** field, gated by `allowOrgChange` (passed `true`
only from `/admin/tvmonitor/[slug]`, never from the external studio route —
studio users stay org-locked and cannot re-home a page, enforced server-side
too: the studio PATCH route strips `organization_id` from the request body
regardless of what the client sends). Facility IDs and resource/space IDs
only mean something within their own org, so changing it immediately clears
Facility ID and the resource list client-side and shows a warning — forcing a
conscious re-pick rather than silently saving a page pointed at another org's
(possibly nonexistent, possibly someone else's) facility/resources.

**Schedule view — columns vs feed**: `TvMonitorScreen` picks the renderer from
`config.schedule.viewMode`.
- `columns` (`components/tvmonitor/TvScheduleGrid.tsx`, default) — one column per
  resource, each independently or synchronously auto-scrolling.
- `feed` (`components/tvmonitor/TvScheduleFeed.tsx`) — every resource's events merged
  into a single full-width column sorted chronologically by start time
  (`slotStartTimestamp` in `lib/tvmonitor-schedule-format.ts`). Each card identifies its
  resource two ways at once — a color-coded left strip/dot plus a text pill — so it
  reads at a glance and isn't color-dependent. Colors come from a fixed palette
  (`resourceColorFor`), assigned by the resource's position in `resourceIds`, not its
  Bond space ID, so they stay stable relative to each other. Built for "everything
  happening at the facility today" boards rather than per-rink columns.

**Resource ID cap is per-view, not shared** (`resourceIdCapFor()` in
`lib/tvmonitor-config.ts`): `MAX_TV_RESOURCES_COLUMNS = 12` (a display constraint —
side-by-side columns stop being readable past a dozen) vs `MAX_TV_RESOURCES_FEED = 60`
(feed has no columns-must-fit constraint; the cap only bounds Bond query/URL size).
⚠️ **A single shared cap of 12 shipped for one release and silently truncated feed
pages with more than 12 resources on save — a real customer page (36 resource IDs)
lost 24 of them with no signal.** The lesson: any place that can drop `resourceIds`
past a cap (the editor's "Add" merge, and switching View between modes) must warn
before doing it — see `addResource()` / `handleViewModeChange()` in `MonitorEditor.tsx`.
`normalizeTvMonitorConfig`'s clamp remains as a last-resort safety net, not the primary
UX; it stays silent by design (server-side normalization has no user to warn), so the
client-side guards are load-bearing.

Both views share one auto-scroll engine (`useSeamlessLoopScroll` in
`components/tvmonitor/useSeamlessLoopScroll.ts`): overflowing columns render their
content twice and wrap `scrollTop` back by exactly one copy's height once the first
copy scrolls past, so the loop never visibly jumps. Shared time/duration/grouping
helpers live in `lib/tvmonitor-schedule-format.ts`.

## Media uploads

Logos and ad images/videos can be pasted as URLs or uploaded. Uploads go
**directly from the browser to Supabase Storage** via a signed upload URL from
`POST /api/tvmonitor/media` (admin or studio session required), so they are not
capped by Vercel's request-body limit. Bucket: `tvmonitor-media`
(migration `migrations/015_add_tvmonitor_media_bucket.sql`), public read,
50 MB/file; images ≤ 15 MB, videos ≤ 50 MB, allowlisted MIME types. Studio
uploads are namespaced by org (`org-{id}/…`).

## Legacy browser compatibility

Some signage hardware (e.g. LG webOS commercial displays) runs an embedded
Chromium far older than anything this app targets — confirmed fleets have run
webOS 3.x (Chromium 38) and Chromium 53–68. On hardware that old, **any**
React hydration attempt throws (a runtime API React itself needs,
`Node.prototype.getRootNode`, didn't land until Chrome 54) and *deletes the
server-rendered HTML* on its way down, turning a would-be-fine static page
into a blank screen. Transpiling to an old JS target and polyfilling the
missing APIs doesn't fix this cleanly: Next.js has no supported way to target
a different JS engine per route, and polyfill coverage is inherently
whack-a-mole (there's always a next missing API). The robust fix is to skip
hydration entirely for these pages — which has a useful side effect: since
this render path ships **no client JS of any kind**, the target Chromium
version mostly stops mattering for the JS engine and only matters for CSS
rendering-engine feature support, a much narrower and more auditable surface.

**`config.legacyBrowserMode`** (Page section, default off): when on, the live
page (`/tvmonitor/{slug}`) `redirect()`s — a plain HTTP 3xx, no JS involved —
to `/tvmonitor/{slug}/legacy`, a Route Handler
(`app/tvmonitor/[slug]/legacy/route.ts`) that returns a hand-built,
**framework-free** HTML string (`lib/tvmonitor-legacy-render.ts`) with zero
`<script>` tags of any kind. The browser never requests any client JS for
this page, so there is nothing to fail to parse and nothing to hydrate.
If the toggle is later turned back off, the `/legacy` route notices on its
own next request and redirects back to the normal page, so a stale bookmark
doesn't linger in compat mode forever.

Consequences of "no client JS, ever," each a direct fix for a bug the
hardware's vendor found in the normal path:
- **Data freshness**: `<meta http-equiv="refresh">` (a full reload every
  `refreshSeconds`) replaces fetch polling. Builder edits reach the TV on the
  next reload, same as before — just via a different mechanism.
- **Auto-scroll and the ticker**: content is duplicated once and looped with
  a CSS `@keyframes` `translateY`/`translateX` animation, not the JS
  seamless-scroll engine (`useSeamlessLoopScroll`). The math still relies on
  "0% and 100% look identical" (translating exactly one copy's distance) for
  a seamless loop, just driven by CSS instead of measured `scrollTop`.
  `scrollPauseSeconds` isn't replicated (continuous scroll only), and a
  column short enough to not actually need scrolling will still loop gently
  — there's no DOM to measure overflow against without JS. Cosmetic
  differences from the normal view, not bugs.
- **Ad rotation**: with no in-page timer, `pickRotatingAsset()`
  (`lib/tvmonitor-legacy.ts`) picks a duration-weighted slot keyed off
  wall-clock time, so assets still cycle roughly in proportion to their
  configured duration — just once per reload, not continuously.
- **CSS**: flexbox + `vh` + explicit longhand only — no CSS Grid, `dvh`, flex
  `gap`, `inset` shorthand, or the CSS `min()/max()` functions used for
  screenRatio letterboxing (skipped entirely in this mode; the display
  always fills the viewport). All either unsupported or landed well after
  Chrome 53. None of this can lean on the compiled Tailwind stylesheet either
  — it isn't loaded on this path — so every element carries its own inline
  `style="…"` string. Unprefixed `@keyframes`/`animation` (used for the
  scroll/ticker loops) didn't land until Chrome 43 — below Chromium 38's
  target, both the `@-webkit-keyframes` rules and every `-webkit-animation`
  usage are declared alongside the unprefixed ones (harmless everywhere else;
  unrecognized rules are just ignored).
- **Vertical layout — no flex-grow above a scrolling region**: old Blink
  (confirmed on Chromium 38, via a customer's real webOS display) doesn't
  reliably give a `position: absolute; top/right/bottom/left: 0` child a
  *definite* height when its containing block's own height comes from
  `flex: 1 1 0` (flex-grow) along a **column** container's main axis — the
  bug that made the schedule columns invisible (clipped away by
  `overflow:hidden`) or, once that was removed, scroll up over the header
  instead of staying inside their own column. Cross-axis *stretch* sizing (a
  flex item's height/width auto-filling a row/column container's cross axis)
  is unaffected — that's been reliable since early flexbox. Every
  auto-scrolling region uses exactly the abs-pos + inset pattern (see
  `marqueeWrap` in `lib/tvmonitor-legacy-render.ts`), so instead of a
  hardcoded pixel height (which would only work for one specific
  header/ad/ticker/screen configuration), every ancestor in that vertical
  chain — the outer row, the row holding the header/ads, the schedule
  wrapper, the wayfinding-to-columns row, and each column's name-header
  offset — gets an explicit `height` or `calc(100% - …)` computed from the
  *actual configured* header height, ad slot sizes, ticker height, wayfinding
  row height, and column name-header height (`adHeightTerm()`/`heightMinus()`
  and the constants above them in that file). `calc()` mixing `vh` and `px`
  terms in one expression is safe this old (unlike `min()/max()`, which is
  not — see above); only the header's own height is an estimate (a few
  configured-size heuristics, since it isn't itself an ancestor of a
  scrolling region and its auto-height sizing isn't affected by this bug) —
  everything else pins an exact value so the estimate can't drift.
- **Clock and "happening now"**: Bond's slots-schedule endpoint returns bare
  `HH:mm:ss` times with **no timezone marker at all**. The normal (React)
  view gets away with parsing them as local time because it runs in the TV's
  own browser, whose system clock already matches the facility's timezone;
  this path renders **server-side** (Vercel functions run in UTC), where that
  assumption is simply wrong. `schedule.timezone` (an IANA identifier, e.g.
  `"America/Denver"` — a field in the **Page** section, right below the
  legacy-mode toggle, only shown with it on) fixes both the on-screen
  clock/date and the "Now" highlight via `zonedWallClockDate()`
  (`lib/tvmonitor-legacy.ts`): it builds a Date whose local wall-clock
  reading matches what a clock physically in that timezone would read, so
  it's directly comparable to the naively-parsed slot times without needing
  to know what timezone the server itself is in. The field is a text input
  wired to an HTML `<datalist>` (`getTimezoneOptions()` in
  `MonitorEditor.tsx`) populated from `Intl.supportedValuesOf('timeZone')`
  when the browser supports it (the full canonical IANA list, no maintenance
  burden on us) or a small hardcoded common-zones fallback otherwise — native
  type-to-filter suggestions while still accepting free-form entry. Leaving
  it unset falls back to the server's own timezone, which is wrong for
  virtually every real facility — the editor shows an explicit warning
  (and the collapsed section chip flags it) whenever legacy mode is on
  without it configured.
- **Fonts**: a generic system stack, not the configurable Google Font — one
  less external network dependency this path doesn't need.
- **Images**: AVIF/WebP decoding requires a modern Chromium. For our own
  Cloudinary-hosted uploads, `toLegacyImageUrl()` forces PNG delivery via a
  URL transformation (`f_png`, no re-upload needed); externally pasted URLs
  we don't control the delivery of pass through unchanged.
- **Weather icon**: an inline SVG (`legacyWeatherIconSvg()`) instead of the
  normal view's emoji glyph — signage displays have no emoji font, so an
  emoji renders as an empty box.

**Why a Route Handler, not a page**: an App Router *page* always ships Next's
client runtime for hydration purposes, even one built entirely from Server
Components with zero `'use client'` boundaries — that's the exact thing old
Chromium can't survive. `lib/tvmonitor-legacy-render.ts` also can't use JSX
at all: Next's build rejects importing `react-dom/server` from anywhere
reachable by a file under `app/`, transitively, specifically to stop people
routing around its own rendering pipeline — which is precisely what this
path needs to do. The renderer is therefore plain string concatenation, with
every dynamic value (event/reservation names, notes, weather location,
ticker messages, the page name — anything ultimately sourced from Bond data
or admin-entered config) passed through `escapeHtml()` before being spliced
into the response.

## Access model

- **Bond admins**: existing NextAuth Google flow (`requireAdmin()`), full access.
- **External builders — named users (primary)**: `tvmonitor_users` (migration
  017). An admin adds an email + org list (multiple orgs = uber-org support) in
  `/admin/tvmonitor`; the person signs in at `/tvmonitor/studio` by requesting a
  **magic link** (single-use, 15 min) or via an admin-issued **invite link**
  (single-use, 7 days). Tokens live hashed in `tvmonitor_login_tokens` and are
  consumed atomically (`lib/tvmonitor-users.ts`). Email delivery uses Resend
  when `RESEND_API_KEY` is set (`lib/tvmonitor-email.ts`); without it, admins
  copy invite links from the UI. Session cookies carry user id + email; every
  studio API call re-reads the user row, so revocation and org changes apply
  instantly. Designed so Bond-platform SSO (Cognito) can replace the login
  mechanism later without touching the permission model.
- **External builders — legacy access links**: `tvmonitor_access` grants
  (shareable per-org tokens, `?key=…`). Still honored and manageable in the
  admin "Legacy access links" panel, but prefer named users.
- Both paths exchange their credential for a 30-day signed httpOnly cookie
  (`lib/tvmonitor-access.ts`, HMAC via `TVMONITOR_ACCESS_SECRET`).
  Studio API routes re-check the grant in the DB on every call, so revoking a link
  cuts access immediately. Studio users only see/edit/create pages for their org and
  cannot re-home a page to another org. Opening an access link **always replaces**
  any existing studio session with that link's org — a browser holds one org
  session at a time.
- **Live TV pages are public** (like the Webflow prototype) — they render schedule
  data that is already publicly served by the Bond v4 endpoint.

## Ops notes

- Slugs `studio` and `api` are reserved (route collisions).
- `/tvmonitor` is excluded from the discovery `/:slug` cache/framing headers in
  `next.config.js`.
- No cron: the request-path `cachedSWR` (60s ttl / 30min stale) is the freshness
  mechanism, sized for always-on TVs.
- Tests: `__tests__/lib/tvmonitor-config.test.ts`, `__tests__/lib/tvmonitor-weather.test.ts`,
  `__tests__/lib/tvmonitor-access.test.ts`, `__tests__/api/tvmonitor-routes.test.ts`,
  `__tests__/lib/tvmonitor-legacy.test.ts`, `__tests__/lib/tvmonitor-legacy-render.test.ts`.
