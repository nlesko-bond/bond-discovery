# Caching Architecture & Event Loading

This document explains how event data flows from the Bond Sports API to the
end user, the caching layers involved, and the lessons learned from a series
of production incidents in March 2026 where pages loaded slowly or showed
incomplete data.

---

## Data Flow Overview

```
Bond Sports API
      │
      ▼
┌──────────────────────────────┐
│  Cron Job (every 15 min)     │  /api/cron/warm-discovery
│  - Fetches programs + events │
│  - Deduplicates by org scope │
│  - Writes discovery:response │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Vercel KV (Upstash Redis)   │
│                              │
│  discovery:response:{slug}   │  ← Pre-computed API response (cron-only)
│  discovery:full:_shared:{…}  │  ← Pipeline cache (scope-based, shared)
│  programs:{orgId}:{…}        │  ← Programs cache
│  discovery:lastRefreshed:{…} │  ← Cron refresh markers
└──────────┬───────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
 ISR Page     /api/events
 (server)     (client fetch)
     │            │
     ▼            ▼
 Browser renders events
```

### Happy Path (warm cache)

1. **Cron** runs every 15 minutes, fetches all events from Bond API, writes
   the complete filtered response to `discovery:response:{slug}` in KV.
2. **ISR page** (`/[slug]` or `/embed/[slug]`) reads `discovery:response:{slug}`
   from KV during server render. If found, passes events as props
   (`initialEventsFetched=true`). Page loads instantly with data.
3. If ISR misses (new deploy, revalidation), client-side JS fetches
   `/api/events?slug={slug}`. The API reads `discovery:response:{slug}` from
   KV (fast path, ~100ms) and returns the full dataset.

### Cold Cache Path

1. `discovery:response:{slug}` is empty (cron hasn't run yet, or cache was cleared).
2. ISR page passes `initialEventsFetched=false`.
3. Client-side JS fetches `/api/events?slug={slug}`.
4. API fast path misses, falls back to the full pipeline:
   - Reads `discovery:full:_shared:{scope}` from KV (shared pipeline cache).
   - If HIT: returns data (~500ms). This cache is populated by the cron.
   - If MISS: runs the full Bond API pipeline (~8-15s). May produce partial
     data if Bond API rate-limits requests.
5. Events appear once the client fetch completes.

---

## Caching Layers

### Layer 1: `discovery:response:{slug}` (Response Cache)

- **Written by**: Cron job ONLY
- **TTL**: 4 hours
- **Contents**: Pre-computed, filtered event response ready to serve as JSON
- **Read by**: ISR page `getPrecomputedEvents()` and `/api/events` fast path

This is the primary cache. When it exists and has data (`data.length > 0`),
pages load instantly.

### Layer 2: `discovery:full:_shared:{scope}` (Pipeline Cache)

- **Written by**: `getDiscoveryEvents()` after any pipeline run
- **TTL**: 4 hours
- **Contents**: Raw unfiltered event data from Bond API
- **Key structure**: Scope-based, NOT slug-based. All slugs that share the
  same organizations, API key, and program filters share ONE cache entry.
- **Read by**: `/api/events` fallback path, cron (bypassed with `forceFresh`)

The scope-based key is critical: it means `pbsz` and `pbsz-copy` (which
share the same orgs) read from the same pipeline cache. Whichever fetches
first populates it for both.

### Layer 3: Vercel CDN

- **Controlled by**: `Cache-Control` headers on each API route
- **Current setting**: `s-maxage=60, stale-while-revalidate=120` for events
- **Important**: Do NOT set `s-maxage` in `next.config.js` for API routes.
  This overrides route-level headers and creates stale-data problems.

### Layer 4: ISR (Incremental Static Regeneration)

- **Controlled by**: `export const revalidate = 300` in page files
- **What it caches**: The full rendered HTML including any server-fetched data
- **Gotcha**: If ISR renders when KV is cold, it caches a page WITHOUT events.
  The `generateStaticParams` export ensures pages are pre-built at deploy time.

---

## Cron Job: `/api/cron/warm-discovery`

Runs every 15 minutes (`*/15 * * * *` in `vercel.json`).

### Scope-Based Deduplication

Multiple slugs can share the same Bond API organizations. The cron groups
configs by their **data-fetching scope** (a hash of orgIds + apiKey +
programFilterMode + included/excluded program IDs). It fetches from the
Bond API **once per scope group**, then writes `discovery:response:{slug}`
for every slug in that group.

```
Example:
  pbsz       → scope "90|default|all|none|none"
  pbsz-copy  → scope "90|default|all|none|none"  (same!)

  Cron fetches ONCE → writes discovery:response:pbsz
                     → writes discovery:response:pbsz-copy
```

Without deduplication, the second slug's fetch gets rate-limited by the
Bond API, producing partial data (see Incident 1 below).

### Why `forceFresh: true`

The cron passes `forceFresh: true` to bypass the pipeline cache read.
This ensures the cron always writes fresh data to the pipeline cache,
overwriting any stale or partial entries.

---

## What Can Go Wrong

### Bond API Rate Limiting

The Bond Sports API returns HTTP 429 when too many requests are made in a
short window. The `fetchSessionEvents` function catches these errors and
returns empty arrays for affected sessions, producing **partial data** —
fewer events than expected, with entire programs missing silently.

Concurrency is controlled by `PROGRAM_CONCURRENCY = 3` and
`SESSION_CONCURRENCY = 5` in `discovery-events.ts`. Do not increase these
without confirming the Bond API rate limit allows it.

### Cache Poisoning

Partial data can "poison" caches if written to long-TTL keys. The system
has several guards against this:

- **Response cache** (`discovery:response`): Only written by the cron, never
  by the API fallback. The cron fetches with managed concurrency.
- **Precomputed fast path**: Checks `data.length > 0` before serving.
  Empty results fall through to the pipeline.
- **ISR pages**: Check precomputed data length; return `null` on empty,
  setting `initialEventsFetched=false` so the client retries.

### CDN Serving Stale Data

If `next.config.js` sets `s-maxage` on API routes, it overrides the
route-level `Cache-Control` header. This was removed to prevent Vercel CDN
from serving stale event data after KV was cleared.

---

## Incident Log: March 2026 Slow/Empty Page Loads

### Incident 1: `pbsz-copy` Shows 0 Events

**Symptom**: The `pbsz-copy` embed page (used on `pbsz.webflow.io/public-skate-schedule`)
showed 0 events despite `pbsz` (same orgs) loading correctly with 2218 events.

**Root Cause**: The old cron fetched from Bond API separately for each slug.
`pbsz` and `pbsz-copy` share the same organizations. `pbsz` fetched first
and succeeded (2218 events). `pbsz-copy` fetched second and was rate-limited
(421/2218 events). The Webflow page pre-filters for "Public Ice Skating",
which was among the missing programs — so 0 events displayed.

**Fix**: Cron scope-based deduplication. Fetch once per org scope, write
response for all slugs in the group.

### Incident 2: Write-Through Propagating Partial Data

**Symptom**: After clearing poisoned cache, partial data kept reappearing.

**Root Cause**: The `/api/events` route had a "write-through" mechanism that
wrote pipeline results back to `discovery:response:{slug}`. When the pipeline
returned rate-limited partial data and cached it in the pipeline key, subsequent
requests got a pipeline cache HIT with partial data, triggering the write-through
to copy that partial data into the response cache.

**Fix**: Removed write-through entirely. Only the cron writes to
`discovery:response:{slug}`.

### Incident 3: CDN Serving Stale API Responses

**Symptom**: After clearing KV caches, the API still returned old partial data.

**Root Cause**: `next.config.js` set `Cache-Control: s-maxage=300` on all API
routes, overriding each route's own headers. Vercel CDN cached API responses
for 5+ minutes regardless of KV state.

**Fix**: Removed the API `Cache-Control` header from `next.config.js`. Each
route now controls its own caching via response headers.

### Incident 4: Pipeline Cache Key Was Slug-Specific

**Symptom**: `pbsz-copy` made separate Bond API calls even though `pbsz` had
already fetched and cached the same data.

**Root Cause**: The pipeline cache key included the slug
(`discovery:full:{slug}:{scope}`), so two slugs with identical org configs
produced different cache keys.

**Fix**: Changed the pipeline cache key to be scope-based
(`discovery:full:_shared:{scope}`). Slugs with the same org config now share
one pipeline cache entry.

### What Made Debugging Harder

Repeatedly clearing ALL caches during debugging forced fresh pipeline runs
that got rate-limited, producing partial data each time. Each partial result
was then cached, making the situation worse.

**Lesson**: When diagnosing cache issues, avoid clearing all caches unless
absolutely necessary. Prefer clearing specific keys (`?slug=xxx`) and waiting
for the cron to repopulate rather than forcing fresh pipeline runs.

---

## Operations Runbook

### Clearing Cache for a Specific Slug

```
GET /api/revalidate?slug=<slug>
```

Deletes all KV keys matching `*<slug>*` and revalidates ISR pages.
**Note**: This also deletes the refresh marker, so the next cron run
will re-warm this slug.

### Clearing All Caches

```
GET /api/revalidate?all=true
```

Deletes all KV keys and revalidates all ISR pages.
**Warning**: This forces all subsequent requests through the pipeline
fallback until the cron runs. If Bond API rate-limits, pages may show
partial data for up to 15 minutes.

### Checking Event Counts

```bash
# Check a slug's event data and cache status
curl -sI "https://discovery.bondsports.co/api/events?slug=<slug>" | grep x-bond

# x-bond-events-cache: PRECOMPUTED  → fast path (good)
# x-bond-events-cache: HIT          → pipeline cache hit
# x-bond-events-cache: MISS         → fresh pipeline run (slow, may be partial)
```

### Verifying Cron Output

The cron runs every 15 minutes and returns JSON:
```json
{
  "success": true,
  "warmed": 5,
  "skipped": 2,
  "details": [
    { "slug": "pbsz", "status": "warmed", "totalEvents": 2218 },
    { "slug": "pbsz-copy", "status": "shared", "totalEvents": 2218 }
  ]
}
```

- `warmed`: Primary slug that triggered the Bond API fetch
- `shared`: Slug that reused data from the primary (same scope)
- `error`: Slug that failed to warm

### Key Files

| File | Purpose |
|------|---------|
| `app/api/cron/warm-discovery/route.ts` | Cron job: fetches events, deduplicates by scope, writes response cache |
| `app/api/events/route.ts` | Events API: precomputed fast path + pipeline fallback |
| `lib/discovery-events.ts` | Pipeline: fetches from Bond API, manages concurrency, shared pipeline cache |
| `lib/cache.ts` | KV wrapper: get/set/delete, cache key helpers, refresh policy |
| `app/[slug]/page.tsx` | Main page server component: reads precomputed events for ISR |
| `app/embed/[slug]/page.tsx` | Embed page: same as above but allows iframe embedding |
| `next.config.js` | Headers, caching config. Do NOT add API Cache-Control here. |
| `vercel.json` | Cron schedule (`*/15 * * * *`) |

---

## Configuration Checklist for New Slugs

When creating a new discovery page slug:

1. Add the config in Supabase `discovery_pages` table
2. Set `is_active = true` and `features.discoveryCacheEnabled = true`
3. The cron will pick it up on the next 15-minute run
4. If the new slug shares organizations with an existing slug, the cron's
   deduplication will fetch once and write for both
5. Verify with: `curl -sI ".../api/events?slug=<new-slug>" | grep x-bond`
   — should show `PRECOMPUTED` after the cron runs
