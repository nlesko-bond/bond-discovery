# Discovery architecture (post plans 001–008)

How a partner page turns into a rendered, cached, measured discovery experience.
Every TTL and key format below is cited from code — when you change
`lib/cache.ts`, grep this doc for the old value.

> Status note: the legacy **embed kit** has been **removed** (plan 007). `/embed/{slug}`
> URLs redirect to `/{slug}`; use the **host kit** for all new integrations.

## Request flow

```text
Partner site (Webflow etc.)                       Bond Discovery (Vercel)
───────────────────────────                       ───────────────────────
<script src=".../bond-host/v1.js">
<div data-bond-host data-bond-slug=S>
        │
        │ fetch config            ┌──────────────────────────────┐
        ├────────────────────────►│ GET /api/host/bootstrap?slug │
        │                         └──────────────────────────────┘
        │ mount iframe            ┌──────────────────────────────┐
        ├────────────────────────►│ /portal/{slug}  (discovery UI)│
        │  ◄── bond:resize ───────│   │ GET /api/events?slug=S    │──► KV cache ──► Bond API
        │  ◄── BOND_GTM_EVENT ────│   │ GET /api/programs?...     │    (cron-warmed)
        │      (checkout conv.)   └──────────────────────────────┘
        │ Register click → bond:open_tab → new tab on partner URL
        ▼                         ┌──────────────────────────────┐
/discovery/register?bondPath=... ►│ checkout iframe (bondsports.co)│
        └─ kit forwards BOND_GTM_EVENT pushes into partner dataLayer
```

- Kit contract: `bond:resize` (+ legacy `discovery-resize`), `bond:open_tab`,
  `bond:chrome-offset`, `BOND_GTM_EVENT` (`public/bond-host/v1.js:12-19`).
- The kit is ES5, served statically, **live on partner sites** — changes must
  stay backward compatible.

## Cache layers

`lib/cache.ts` provides one cache API with two backends:

1. **Vercel KV (Upstash)** — used when `KV_REST_API_URL` + `KV_REST_API_TOKEN`
   are set (`lib/cache.ts:33-43`). This is the only shared layer in
   production (warm cron and page renders run in different lambdas).
2. **In-process memory map** — fallback when KV is unconfigured, i.e. local
   dev (`lib/cache.ts:64-74`). Default TTL 300s (`lib/cache.ts:9`).

On top of that:

- `cached()` — get-or-fetch with in-flight request coalescing
  (`lib/cache.ts:292-320`).
- `cachedSWR()` — stale-while-revalidate via a `swr:{key}` shadow key that
  lives 2× TTL (`lib/cache.ts:330-372`, grace factor at `lib/cache.ts:10`).
  Used by `/api/programs` and `/api/schedule`.

### Key formats (quoted from `lib/cache.ts`)

| Key format | Written by | TTL | Source |
|---|---|---|---|
| `programs:{orgId}:{keyScope}` (or `programs:{orgId}:{facilityId}:{keyScope}`; `keyScope` hashes apiKey+bondEnv) | warm pipeline + request misses | warm: `max(cacheTtl, 4h)` (`lib/discovery-warm.ts:50`) | `lib/cache.ts:173-188` |
| `schedule:{orgId}:{startDate}:{endDate}` | `/api/schedule` via `cachedSWR` | 300s default | `lib/cache.ts:193-195` |
| `config:{configId}` | config layer | 300s default | `lib/cache.ts:200-202` |
| `discovery:full:{slug}:{scopeHash}` | full events pipeline | 4h (`lib/discovery-events.ts:148`) | `lib/cache.ts:207-209` |
| `discovery:availability:{slug}:{scopeHash}` | availability SWR cache | 180s default, per-slug `features.availabilityCacheTtl`, `0` = bypass (`lib/availability-cache.ts:31,59-60`) | `lib/cache.ts:211-213` |
| `discovery:response:{slug}` (or `discovery:response:{bondEnv}:{slug}` for non-production bondEnv) | **warm pipeline ONLY** | 4h (`lib/discovery-warm.ts:112`) | `lib/cache.ts:215-219` |
| `discovery:lastRefreshed:{slug}` | `markDiscoveryRefreshed` | 48h (`lib/cache.ts:240`) | `lib/cache.ts:221-223` |
| `discovery:cron:lastRun` | warm cron | 24h | `app/api/cron/warm-discovery/route.ts:90-97` |

## The warm cron

`vercel.json` runs `GET /api/cron/warm-discovery` every 15 minutes
(production deployments only). The route:

1. **Fails closed on auth**: in production with no `CRON_SECRET` configured it
   refuses to run; with one configured it requires `Authorization: Bearer
   $CRON_SECRET` (`app/api/cron/warm-discovery/route.ts:37-45`).
2. Selects active configs whose per-page refresh policy
   (`features.discoveryRefreshPolicy`: `5min`/`15min`/`30min`/`60min`,
   default `15min`; `lib/cache.ts:17-23`) says they are due, via
   `discovery:lastRefreshed:{slug}` (`lib/cache.ts:228-237`).
3. **Groups configs by data scope** — orgs + apiKey + bondEnv + program
   filters (`app/api/cron/warm-discovery/route.ts:25-33`) — so Bond is hit
   once per scope, not once per slug (rate-limit protection).
4. For each group, `warmScopeGroup` (`lib/discovery-warm.ts:37`) warms the
   programs caches, fetches full events once, then writes a per-slug filtered
   `discovery:response` payload.
5. **Empty-write guard**: a warm yielding zero filtered events never
   overwrites a previously non-empty payload — partial rate-limited Bond
   fetches must not poison live pages (`lib/discovery-warm.ts:92-107`).
6. Persists `discovery:cron:lastRun` (timestamp, warmed/error/skipped counts,
   Bond API stats) for diagnosis (`app/api/cron/warm-discovery/route.ts:88-97`).

The same pipeline also runs outside the cron:

- **Warm-on-create/update**: `POST /api/pages` and config saves call
  `warmScopeGroupWithTimeout` (20s bound; `lib/discovery-warm.ts:160`) so new
  pages are fast immediately; on timeout the next cron run picks the slug up.
- **Admin "Refresh now"**: `POST /api/admin/warm?slug=X` (admin-only,
  `app/api/admin/warm/route.ts`).
- **Admin freshness readout**: `GET /api/admin/cache-status?slug=X` returns
  `discovery:cron:lastRun` + the page's `lastRefreshed`
  (`app/api/admin/cache-status/route.ts`).

### Invalidation

Saving a page config whose changes affect the discovery payload calls
`invalidateDiscoveryResponseCache` (`lib/cache.ts:247-255`), which deletes
`discovery:response:*` and `discovery:lastRefreshed:{slug}` so the next cron
re-warms early. If `bondEnv` or the slug changed, the OLD key variants are
invalidated too (`lib/config.ts:393-413`).

## `/api/events` request path

`app/api/events/route.ts` serves three tiers (header `X-Bond-Events-Cache`
tells you which):

1. **Availability SWR** (`mode=availability`): sub-100ms spots-left overlay,
   ≤180s stale by default (route lines 103-123) → header `SWR`.
2. **Precomputed** (`mode=full`): reads the cron-written
   `discovery:response` payload, applies current program filters, merges the
   availability overlay (`lib/discovery-precomputed-events.ts`) → header
   `PRECOMPUTED`.
3. **Full pipeline fallback** (cron hasn't run, new slug, `forceFresh=true`):
   `getDiscoveryEvents` against `discovery:full`/Bond → headers `HIT`/`MISS`/
   `BYPASS`.

**Write-through from the fallback to `discovery:response` is intentionally
disabled** (`app/api/events/route.ts:215-219`) — only the cron writes that
key. A zero-event full response with Bond 5xx errors triggers
`maybeAlertZeroDiscoveryEvents` (`lib/discovery-zero-events-alert.ts`).

Pages with `features.discoveryCacheEnabled === false` skip tiers 1–2 and the
cron skips warming them (`app/api/events/route.ts:125-128`,
`app/api/cron/warm-discovery/route.ts:51-55`).

## Analytics / GTM flow

Two channels (engineering detail: `analytics-discovery-and-host-shell.md`;
partner contract: `customer-setup-discovery-checkout-analytics.md`):

- **Discovery iframe → partner GTM**: `components/analytics/GoogleTagManager.tsx`
  loads the page's GTM container inside the iframe and pushes a minimal
  contract — `page_view`, `click_register`, `click_redeem_pass` only
  (plan 004 removed seven other events).
- **Checkout iframe → partner page**: Bond checkout posts `BOND_GTM_EVENT`
  messages (`begin_checkout`, `select_payment_method`, `purchase`, …); the
  host kit forwards them into the partner page's `window.dataLayer`, skipping
  the forward if the partner's legacy manual listener is present
  (`window.__bondGtmListenerAttached`) so events never double-fire
  (`public/bond-host/v1.js`).
- **Bond internal analytics** (`lib/analytics.ts` → `/api/analytics/track` →
  Supabase) is unchanged and independent of the GTM contract.

## Admin & auth

- Admin UI: `/admin`, page editor at `/admin/pages/{slug}` restructured into
  5 sections (`app/admin/pages/[slug]/sections/`).
- All `/api/pages` mutations and admin-only routes are guarded by
  `requireAdmin()` (`lib/admin-auth.ts`): NextAuth Google session +
  `ADMIN_ALLOWED_EMAILS` allowlist; fails closed in production; dev-only
  bypass via `ADMIN_AUTH_BYPASS=true` (never active in production builds).
- Environments and required env vars: see [environments.md](./environments.md).
