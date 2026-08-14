# Rosters

League roster pages and staff check-in sheets at `/rosters/{slug}`, built on Bond's three
group/participant endpoints. Configured in `/admin/rosters`, stored in Supabase `roster_pages`.

## What it is

One surface, four views, all URL-addressable so any of them can be shared or printed:

| View | URL | What it shows |
|---|---|---|
| Browse | `?session={id}` | Divisions and teams as cards, with player counts |
| Team roster | `?session={id}&group={id}` | One team's participants |
| Check-in sheet | `?view=checkin` + a group | Participants × dates, **blank boxes** to mark by hand |
| Registration grid | `?view=matrix` | Participants × dates, marked where **registered** |

## Bond endpoints

| Endpoint | Client method | Notes |
|---|---|---|
| `…/sessions/{id}/groups` | `getSessionGroups` | Flat list with `parentId`; one call builds the whole tree |
| `…/groups/{id}/participants` | `getGroupParticipants` | One request per team — the expensive call |
| `…/events/{id}/participants` | `getEventParticipants` | One request per event; drives the matrix |

All three are v1 public API with `x-api-key`, so they live in `lib/bond-client.ts` alongside the
existing discovery methods and inherit its 429 retry and stats counters.

**There is no check-in or attendance state anywhere in these APIs.** The event-participants endpoint
tells you who is *registered for or assigned to* an event, never who showed up. Hence two distinct
views: the check-in sheet is a deliberately blank grid, and the matrix legend says "registered",
not "attended". Do not relabel either without a Bond API change behind it.

## Invariants — do not break

1. **`redactParticipant` in `lib/roster-privacy.ts` is the only path participant data takes to a
   browser.** It builds a fresh object and only adds permitted keys; it never deletes from a raw
   record. A public payload therefore contains no key hinting that contact data exists. Never
   render a field the server did not send, and never hide one with CSS.
2. **`resolveExpand` decides what we ask Bond for.** In public mode we don't request `contact`,
   `primary`, `primaryContact` or `registration`, so that PII never enters the process. Defence in
   depth: invariant 1 alone would suffice, but a bug in it still cannot leak a phone number.
3. **Viewer mode comes from a verified cookie, never from a request parameter.** `resolveViewerMode`
   in `lib/roster-access.ts` is the only source of `'staff'`. Routes must go through
   `resolveRosterRequest`, which runs the four gates in order.
4. **Staff payloads are never written to KV.** Production KV is shared with preview and local
   deployments. `loadGroupParticipants` passes `memoryOnly` for staff mode; the cache key also
   carries the mode, so a public read can never be served a staff payload.
5. **Roster data never touches `discovery:*` keys.** Those payloads are shared across slugs by scope
   group. The `roster:*` namespace is separate and must stay so.
6. **`rosters` stays in the `next.config.js` header exclusion.** Otherwise these pages inherit
   discovery's `frame-ancestors *`, letting any site embed a page carrying PII.
7. **Indexing is opt-in.** `allow_indexing` defaults false and the route emits `noindex` unless it
   is set. Removing a page carrying names from search results after the fact does not reliably work.

## Privacy model

Two independent axes, following SportsEngine's model rather than inventing one.

**Page access** — `public` / `password` / `staff`, gating whether the page opens at all.

**Field visibility** — what a viewer sees once in, defaulting to the most private useful roster:

| Name mode | Renders | Default |
|---|---|---|
| `numberOnly` | "Player" + jersey number | ✅ |
| `lastInitial` | `Nicole L.` | |
| `firstInitial` | `N. Lesko` | |
| `full` | `Nicole Lesko` | |

Photos are suppressed entirely when the name mode is `numberOnly` — a photo identifies a person as
surely as a name does, regardless of the `showPhoto` switch.

**Staff mode** adds contact, DOB/age, gender, waiver status, registration and guardian name. On any
page flagged `is_youth`, contact columns render the **guardian's** details, not the participant's —
enforced in `normalizeFieldVisibility` regardless of the stored value, so a misconfiguration cannot
surface a child's phone number.

Unknown values in the database normalize to the *most private* setting, never the most permissive.

## Timezones

Every date and time renders in the facility timezone with the zone stated. Helpers live in
`lib/roster-time.ts`.

The load-bearing part is bucketing, not formatting: check-in and matrix columns are calendar days, so
a Friday 19:00 event in `America/Los_Angeles` must land in Friday's column. `toISOString().slice(0,10)`
puts it in Saturday's on a UTC server. **Use `zonedDateKey`.** Event-to-column mapping is computed
server-side for the same reason.

Timezone comes from `expand=facility` on the groups call, falling back to an event's own `timezone`.
The participant endpoints carry no time data at all.

## Cost and caps

Groups are cheap — one paginated call returns the whole tree, with `playerCount` per group, so
browsing costs zero participant fetches. Participants are the expensive call, one request per team
or per event, so:

- loading is lazy: participants only when a team opens or a sheet/export is requested
- bulk fan-out runs at concurrency 3
- hard caps of 60 groups and 60 events, **reported in the UI when hit** — never silently truncated

| Cache key | TTL | Store |
|---|---|---|
| `roster:scope:{slug}` | 15 min | KV |
| `roster:groups:{slug}:{sessionId}` | 10 min | KV |
| `roster:events:{slug}:{sessionId}` | 10 min | KV |
| `roster:participants:…:public` | 5 min | KV |
| `roster:participants:…:staff` | 60 s | **memory only** |

## Print

Four modes via a root class, using CSS **named pages** — `@page` cannot be scoped by a selector, so
a bare rule would force one orientation on every printable surface in the app.

| Mode | Orientation |
|---|---|
| `roster-print-mode-team` | portrait |
| `roster-print-mode-checkin` | portrait; `.is-wide` switches to landscape past 14 date columns |
| `roster-print-mode-signin` | portrait, ~0.49in rows for handwriting |
| `roster-print-mode-waiver` | portrait |

Portrait is the default deliberately: a typical season is 8–12 sessions with 10–16 players, which
fits portrait. Landscape would make the common case look sparse and waste a sheet.

⚠️ `thead { display: table-header-group }` repeats headers across pages, but browser support has
historically been patchy — verify in the target browser rather than trusting the CSS.

## Files

| Path | Role |
|---|---|
| `lib/roster-privacy.ts` | **The PII choke point.** Redaction and expand resolution |
| `lib/roster-access.ts` | Viewer/staff cookies, password checks, `resolveViewerMode` |
| `lib/roster-request.ts` | The four gates every public route runs |
| `lib/roster-data.ts` | Bond loading + caching; returns redacted data only |
| `lib/roster-scope.ts` | Config bound → browsable sessions |
| `lib/roster-tree.ts` | Flat groups → division/team tree |
| `lib/roster-time.ts` | Facility-timezone formatting and date bucketing |
| `lib/rosters-config.ts` | Supabase CRUD + normalizer |
| `app/rosters/[slug]/` | Public surface |
| `app/api/rosters/[slug]/` | `scope` · `groups` · `participants` · `sheet` · `export` · `unlock` |
| `app/admin/rosters/` | List and editor |
| `migrations/019_add_roster_pages.sql` | Table |

## Setup

1. Apply `migrations/019_add_roster_pages.sql`.
2. `/admin/rosters` → create a page, set organization IDs.
3. Give the page an `api_key`, or a partner group that has one. There is **no** deployment-wide
   fallback — a page with no key returns 503 rather than borrowing another org's.
4. Check the field settings, then publish. New pages start unpublished and name-free.
5. Set `ROSTER_ACCESS_SECRET` if using password or staff gating (falls back to
   `RESERVATION_PAGE_ACCESS_SECRET`).

## Linking from discovery

`features.showRostersLink` + `features.rostersPageSlug` render a "Team rosters" link on league
events — the mirror of the standings link. Only a URL crosses over; no roster data enters the
discovery payload, which is why these keys are deliberately absent from
`updateAffectsDiscoveryPayload`.
