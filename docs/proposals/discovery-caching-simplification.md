# Proposal: Simplify Discovery Caching

**Status:** Draft (not implemented)
**Author:** Generated from the May 4 caching incident triage (coppermine + hudsonville)
**Audience:** Engineers + product (Nicole)

---

## Goals

In Nicole's words:

1. **Consumer experience is instant** on initial render.
2. **Updates from Bond propagate in <15 min** (preferably <5 min).
3. **Spots remaining / waitlist refresh faster** than the rest of the page (closer to live).
4. **Remove the complex layers of caching.** Operating this should not require knowing four different KV key formats.

Implicit goal: **revalidation actually works**. Today it doesn't (see "What's broken").

---

## Current architecture

```
Browser ──► Vercel CDN ──► Next ISR (HTML) ──► /api/events ──► Bond API
                                  │                  │
                                  ▼                  ▼
                          KV: discovery:        KV: discovery:full:
                          response:{slug}       _shared:{scope}
                          (cron writes,         (pipeline writes,
                          4h TTL)               4h TTL)
                                                       │
                                                       ▼
                                            KV: discovery:availability:
                                            _shared:{scope} (30m TTL)
                                                       │
                                                       ▼
                                            KV: programs:{org}:{key}
                                            (bond-client cache)

Cron (`*/15 * * * *`)
  └─► getDiscoveryEvents({ forceFresh: true }) per scope
      └─► writes discovery:response:{slug} (one per slug, even when scopes share)
```

**Five caches**: CDN, Next ISR, `discovery:response:{slug}`, `discovery:full:_shared:{scope}`, `programs:{org}:{key}`, plus an availability SWR cache. Each can drift independently. Each has its own TTL, its own writer, its own invalidation pattern.

---

## What's broken (concrete, from incidents this week)

1. **Revalidate is a no-op against the pipeline cache.** `/api/revalidate?slug=X` deletes `*X*` keys. The pipeline cache lives at `discovery:full:_shared:{scope}` — the literal string `_shared`, not the slug. The pattern doesn't match. Confirmed yesterday with coppermine: precomputed cache cleared, pipeline still served 2 programs from a stale shared cache for hours. Fix-in-flight: add a surgical purge that computes the scope hash and deletes that specific key.

2. **Partial-data poisoning.** When Bond rate-limits the cron, individual `getEvents()` calls fail and silently return `[]`. The cron writes the partial result (e.g. `2 programs` instead of `7`). Empty-write guard catches the all-zero case but not the percent-drop case.

3. **Programs cache is per-org, per-API-key, 4h TTL, populated lazily.** Once written, it's not cleared by revalidate either. Stale program lists silently filter out new programs across all slugs that share that org.

4. **Capacity (spots remaining) and catalog (program/session names, prices) are cached together** in `discovery:response:{slug}`. The page renders both from the same payload. So spots remaining is as stale as the catalog — up to 15 min old in the best case, longer if cron stalled. The availability SWR path partially compensates but adds yet another cache.

5. **Cache key sharing between unrelated slugs**. Two slugs with the same orgs+filters share `discovery:full:_shared:{scope}`. When one slug runs a fallback pipeline that hits 429s, every other slug with the same scope inherits the partial data.

6. **Cron does not write to the shared cache.** Cron uses `forceFresh: true`, which bypasses the shared cache on read AND skips the write-back. So the shared cache is only ever populated by the API fallback path — which is exactly the codepath most likely to hit Bond rate limits and write bad data. The shared cache is structurally biased toward poisoning.

The pattern is: any one of these layers can hold bad data. Revalidate clears one and a half of them. The rest sit and rot for up to 4 hours.

---

## Proposed architecture

**One source of truth: a Postgres mirror of Bond catalog data, refreshed by a cron worker. Capacity refreshed on a faster cadence into the same table. Page renders read from Postgres directly.**

```
Browser ──► Vercel CDN ──► Next ISR (HTML, 60s) ──► Supabase
                                                       │
                                                       ▼
                                                  discovery_events
                                                  (one row per event)

Catalog cron (every 5 min, per org)
  └─► Bond /programs?expand=sessions,...,events
      └─► UPSERT discovery_events.{catalog columns}

Capacity cron (every 1 min, per org, upcoming events only)
  └─► Bond /events?expand=capacity (smaller, cheaper call)
      └─► UPDATE discovery_events.{capacity columns}
```

**Three things go away:**
- `discovery:response:{slug}` precomputed cache
- `discovery:full:_shared:{scope}` shared pipeline cache
- `discovery:availability:_shared:{scope}` SWR cache
- The `programs:{org}` programs cache (folded into the sync worker)

**Two things are kept:**
- Vercel CDN (still gives us edge caching of HTML)
- Next ISR (`revalidate: 60`) — rebuilds HTML every 60s by re-querying Postgres

**One thing is added:**
- A `discovery_events` table in the Supabase project that already hosts `discovery_pages`.

### Schema sketch

```sql
CREATE TABLE discovery_events (
  org_id TEXT NOT NULL,
  event_id TEXT NOT NULL,

  program_id TEXT NOT NULL,
  program_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  segment_id TEXT,
  segment_name TEXT,

  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  timezone TEXT,
  facility_name TEXT,
  space_name TEXT,

  sport TEXT,
  type TEXT,
  link_seo TEXT,
  starting_price NUMERIC,
  member_price NUMERIC,
  has_punch_pass_product BOOLEAN,

  max_participants INT,
  current_participants INT,
  spots_remaining INT,
  is_waitlist_enabled BOOLEAN,
  waitlist_count INT,

  registration_window_status TEXT,
  registration_start_date TIMESTAMPTZ,
  registration_end_date TIMESTAMPTZ,

  catalog_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  capacity_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (org_id, event_id)
);

CREATE INDEX idx_discovery_events_org_window
  ON discovery_events (org_id, start_date)
  WHERE start_date >= NOW();
```

### Page render

```ts
async function getEvents(slug: string) {
  const config = await getPageConfig(slug);
  const horizonEnd = addMonths(new Date(), config.eventHorizonMonths ?? 3);

  const { data } = await supabase
    .from('discovery_events')
    .select('*')
    .in('org_id', config.organizationIds)
    .gte('start_date', new Date().toISOString())
    .lte('start_date', horizonEnd.toISOString())
    .order('start_date');

  return applyProgramFilters(data, config);
}
```

5–20 ms query. Independent of Bond's health. No KV. No `_shared` cache. Filtering happens in the query, not after the cache layer.

### Why this hits all four goals

| Goal | How |
|---|---|
| **Instant initial render** | One Postgres query, served via Next ISR. Postgres is in the same region as the Vercel deployment. p50 query is <20ms. |
| **<15 min update propagation** | Catalog cron runs every 5 min. We can drop to 2 min once we trust it. Each run writes only changed rows. |
| **Faster spots remaining** | Capacity cron runs every 1 min, hits a cheaper Bond endpoint, updates only the capacity columns. Optionally: client-side overlay polls `/api/availability?eventIds=...` which reads from Postgres (always returns last-synced capacity, max 1 min stale). |
| **Remove caching layers** | Five caches → one table. Revalidation becomes "trigger a sync for this org." Postgres IS the cache. |

---

## What stays the same

- The page still uses Next ISR for HTML caching at the edge (60s revalidate).
- Vercel CDN still handles geo-distribution.
- The Supabase project, `discovery_pages` config, and admin flows are unchanged.
- The Bond API client, retry logic, and rate-limit handling are reused (just called from the sync worker instead of the page).

---

## What we lose

1. **The `_shared` cache optimization.** Two slugs sharing orgs no longer share a cache entry. Replaced by: the sync worker fetches per-org, not per-slug, so duplication never happens at the source.
2. **The cron's "warm 18 slugs in 5 minutes" model.** Replaced by per-org sync. Total Bond API calls go *down* (we no longer fan-out per-slug).
3. **The fallback pipeline path in `/api/events`.** A page render that misses Postgres is a real error, not a quiet fallback. Better observability.

---

## Migration plan

Five small, reversible phases. Each can ship behind a feature flag.

### Phase 0 — Schema (1 day)
- Add `discovery_events` table + indexes via Supabase migration.
- No code changes, no traffic. Reversible.

### Phase 1 — Sync worker in shadow mode (2–3 days)
- Build catalog cron (every 5 min, all orgs).
- Build capacity cron (every 1 min, upcoming events only).
- Sync writes to Postgres but **page render still reads from KV**.
- Add a `/api/debug/diff?slug=X` endpoint that compares Postgres vs the current pipeline output. Run it daily for a week and verify parity.

### Phase 2 — Switch one slug to Postgres reads (1 day)
- Pick a low-traffic, internal-test slug (or a customer who's already complaining like coppermine).
- Add `features.useDbReads = true` to its config.
- Page render checks the flag and reads from Postgres. KV path untouched.
- Verify in production for 48h. Roll back is one config flip.

### Phase 3 — Migrate all slugs (1–2 days)
- Flip `useDbReads` on all configs.
- Monitor query latency, sync lag, error rates.

### Phase 4 — Decommission KV pipeline (1 day)
- Delete `discovery:response:*`, `discovery:full:_shared:*`, `discovery:availability:_shared:*`, `programs:*` cache code paths.
- Replace `/api/revalidate?slug=X` with `/api/sync?slug=X` (triggers an immediate sync run for that slug's orgs).
- Remove `getDiscoveryEvents` pipeline.

**Total: ~1.5–2 weeks of focused work.** Can pause at any phase boundary without leaving the system in a bad state.

---

## Tradeoffs

**Pros**
- Single source of truth. Every layer above (CDN, ISR, page render) reads from one place.
- Sync failures don't degrade consumer experience. Page reads continue from last-good Postgres data even if Bond is down for hours.
- Cheaper (Bond hit count *decreases* — per-org sync deduplicates across slugs).
- Easier to add features: filtering, search, sorting, "events I'm registered for", etc., are all just SQL.
- Easier to debug: "when was this last synced?" is one column in one table.

**Cons**
- Adds a database to the data path. (Already exists for `discovery_pages`, so the operational footprint is unchanged.)
- Schema changes when Bond's API surface evolves. Manageable with migration discipline.
- First sync per org pulls everything; spread across orgs to avoid a thundering herd.

**Risks**
- **Sync staleness goes unnoticed.** Mitigation: alert if `MAX(catalog_synced_at) < NOW() - 30 min` for any active org.
- **Per-event UPDATE cost.** With ~10k events across all orgs and ~5 min sync interval, this is small. Postgres handles it trivially.
- **Capacity sync hits Bond rate limits more often (every 1 min).** Mitigation: start at 2–5 min; only drop to 1 min if Bond tolerates it. Use `expand=capacity` only (cheaper than full event expansion).

---

## What we ship in week 1, before any of this lands

These are independent and worth doing regardless:

1. **Fix the surgical revalidate bug** (Option A from the May 4 thread). `/api/revalidate?slug=X` should compute the scope hash and delete the matching `_shared` keys. ~30 min of work.
2. **Percent-drop guard in the cron.** Refuse to write a payload that drops >60% of the previously cached event count. Mark the slug as `error` and retry next cron tick. ~1 hour of work.
3. **Lower pipeline concurrency.** `PROGRAM_CONCURRENCY=2`, `SESSION_CONCURRENCY=3` (down from 3/5) to reduce 429 pressure on Bond. ~5 min.

Together these patch the worst of the bleeding while we build the real fix.

---

## Open questions

1. **Does Bond expose webhooks** for `programs:updated`, `event:capacity_changed`, etc.? If so, capacity sync becomes push-driven and we can drop the 1-min poll. Worth a 30-minute conversation with their team.
2. **Do we want client-side polling for capacity overlays** (every 30s while a user is looking at a card), or is "max 1 min stale from Postgres" good enough? Preference depends on conversion data.
3. **Is there ever a customer who needs <1-min freshness** for catalog data (program names, prices)? If yes, we need a manual-trigger path that skips the cron schedule. The Phase 4 `/api/sync?slug=X` covers this.
4. **Should the sync worker be Vercel Cron + Function, or move to Inngest / a queue** for reliability? Vercel Cron is simpler and probably sufficient at our scale; Inngest gives better retries and observability if we outgrow it.

---

## Success criteria

After Phase 4 lands:

- [ ] p50 page render latency at the origin: ≤50ms (today: 200–800ms when KV hits, 4–10s when it falls through to Bond).
- [ ] Catalog change in Bond → visible in a Discovery page: ≤5 min, p99 ≤10 min.
- [ ] Spots remaining update lag: ≤1 min, p99 ≤2 min.
- [ ] "I revalidated and the change still isn't showing" tickets: zero.
- [ ] Number of distinct cache layers an engineer needs to understand to debug a stale-data report: 1 (was 5).
