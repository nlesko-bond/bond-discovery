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
| `header` | logo, title, live clock, date, schedule QR, waiver QR, optional sponsor ad slot |
| `schedule` | **view** — `columns` (one column per resource) or `feed` (all resources merged into one full-width, chronologically-sorted scrolling list, each event tagged with its resource); resource (space) IDs — cap depends on view, see below; hours ahead (1–24), show notes / maintenance / private events + notes size/color/italic/bold, labels, auto-scroll (speed 1–5, pause; `columns` also has synchronized vs independent) |
| `ads[]` | fixed placements: left/right rail (optionally full screen height, header beside it), top/bottom banner, in-header; sized by pixels or % of screen; each rotates image/video assets by URL with per-asset duration. The builder shows each slot's rendered px + aspect ratio. JS ad tags are a planned future asset type. |
| `design` | dark/light presets, Google font, font/secondary/accent colors, background gradient (color 1 → color 2), optional background image with adjustable color-overlay strength, card colors |
| `screenRatio` | `fill` (default) or 16:9 / 4:3 / 21:9 / 9:16 letterboxed |

Templates (`lib/tvmonitor-templates.ts`): **Classic Board** (no ads),
**Sponsor Spotlight** (left rail + header sponsor), **Promo Banner** (light theme +
bottom banner), and **Build your own**. A template is only a starting config.

**Duplicating a page**: the list view (`MonitorList`, used by both `/admin/tvmonitor`
and the studio) has a Duplicate action per row (`duplicateTvMonitorPage()` in
`lib/tvmonitor-config.ts`). It copies the name ("Copy of {name}"), org, facility, and
the full config verbatim into a **new, inactive** page — inactive so a duplicate is a
safe starting point to edit, not an instant second live board on the same resources —
and opens straight into its editor. The slug is derived from the new name and
disambiguated with `-2`, `-3`, ... on collision.

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
- Tests: `__tests__/lib/tvmonitor-config.test.ts`,
  `__tests__/lib/tvmonitor-access.test.ts`, `__tests__/api/tvmonitor-routes.test.ts`.
