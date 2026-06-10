# Plan 002: Establish a verification baseline — tests + observability for the cache layer and cron warm

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- lib/cache.ts lib/availability-cache.ts app/api/cron/warm-discovery/route.ts __tests__/`
> On mismatch with the "Current state" excerpts, treat as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (tests + log lines + one auth tightening; no behavior change to cached data paths)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

The discovery pages are live and must always work. Their reliability rests entirely on the caching layer (`lib/cache.ts`) and the 15-minute cron warm (`app/api/cron/warm-discovery/route.ts`) — and **neither has a single test**. Existing tests cover only `lib/config.ts` and `lib/discovery-program-scope.ts`. Every later plan in this series (embed-kit removal, caching changes, staging) modifies or depends on this layer; characterization tests must land first so regressions are caught mechanically. This plan also closes a real security gap: the cron route skips auth entirely when `CRON_SECRET` is unset.

## Current state

- `lib/cache.ts` — KV-with-memory-fallback cache. Key behaviors to characterize:
  - `cached()` (lines 292–320): get-or-fetch with in-flight coalescing via a module-level `inflight` Map (line 48).
  - `cachedSWR()` (lines 330–372): primary key → stale shadow key `swr:{key}` (2× TTL, `STALE_GRACE_FACTOR = 2`, line 10) → synchronous fetch. Stale hit triggers fire-and-forget background refresh.
  - `shouldRefreshDiscovery()` (lines 228–237): compares `discovery:lastRefreshed:{slug}` timestamp against policy intervals (`5min|15min|30min|60min`).
  - Memory fallback is active whenever `KV_REST_API_URL`/`KV_REST_API_TOKEN` are unset (line 34) — which is exactly the test environment, so tests can exercise the real code paths without mocking KV.
- `app/api/cron/warm-discovery/route.ts` — the cron. Key behaviors:
  - Auth (lines 51–55): `if (cronSecret && authHeader !== \`Bearer ${cronSecret}\`) return 401` — **when `CRON_SECRET` is unset, the route is open** and anyone can trigger Bond API fan-out (cost/rate-limit abuse).
  - Scope grouping (lines 39–47, 83–89): `computeDataScope()` joins orgIds|apiKey|bondEnv|filterMode|excluded|included so slugs sharing a scope share one Bond fetch.
  - Empty-write guard (lines 149–164): refuses to overwrite a non-empty `discovery:response:{slug}` with an empty payload.
- `lib/availability-cache.ts` — SWR overlay for availability (180s default TTL). Read it before writing tests.
- `__tests__/lib/config.test.ts` (522 lines) — the structural pattern to follow for mocking and layout. Vitest, jsdom environment per `vitest.config.*`.
- `/api/events` already emits `X-Bond-Events-Cache: PRECOMPUTED|SWR|BYPASS|...` headers (`app/api/events/route.ts:114-117,141-145,228-238`) — observability exists there; the cron's response JSON already reports `bondApi` stats. What's missing is a persisted record of the last cron run.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Install   | `npm install`        | exit 0              |
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm run test:run`   | all pass            |
| One file  | `npx vitest run __tests__/lib/cache.test.ts` | pass |

## Scope

**In scope**:
- `__tests__/lib/cache.test.ts` (create)
- `__tests__/api/warm-discovery.test.ts` (create)
- `app/api/cron/warm-discovery/route.ts` (auth tightening + last-run record only)
- `lib/cache.ts` (ONLY if a tiny test seam is unavoidable — e.g. exporting a `__clearMemoryCacheForTests()` helper; no behavior changes)

**Out of scope**:
- Any change to cache TTLs, keys, or SWR semantics — this plan characterizes current behavior, it does not improve it (plan 006 does that).
- `lib/bond-client.ts` — mocked in tests, not modified.
- `app/api/events/route.ts`.

## Git workflow

- Branch: `advisor/002-cache-verification-baseline`
- Conventional commits, e.g. `test(cache): characterize cached/cachedSWR/refresh-policy behavior`

## Steps

### Step 1: Characterization tests for lib/cache.ts

Create `__tests__/lib/cache.test.ts`. Ensure KV env vars are unset (`vi.stubEnv` / delete from `process.env`) so the memory cache is used. Use `vi.useFakeTimers()` for TTL/expiry cases. Because the memory cache and inflight map are module-level, use `vi.resetModules()` + dynamic `await import('@/lib/cache')` per test (or the test-seam helper) to isolate state. Cases:

1. `cacheSet` then `cacheGet` returns the value; after TTL elapses, returns null.
2. `cached()`: fetcher called once on miss, not called on hit.
3. `cached()` coalescing: two concurrent calls to the same key with a slow fetcher → fetcher invoked exactly once, both callers get the value.
4. `cachedSWR()`: primary hit → no fetch. Primary miss + stale shadow present → returns the stale value immediately AND fetcher is invoked in the background (flush with `await vi.runAllTimersAsync()` or awaiting a deferred).
5. `cachedSWR()` total miss → fetches synchronously and populates both primary and `swr:` shadow key.
6. `cachedSWR()` background refresh failure → stale value still served, no throw.
7. `shouldRefreshDiscovery()`: returns true with no marker; false right after `markDiscoveryRefreshed`; true again once the policy interval has elapsed (test `5min` and `60min`).
8. `invalidateDiscoveryResponseCache()` deletes both the response key and lastRefreshed key (assert via `cacheGet` returning null).
9. `discoveryResponseCacheKey('x','staging')` → `discovery:response:staging:x`; with `'production'` or undefined → `discovery:response:x`.

**Verify**: `npx vitest run __tests__/lib/cache.test.ts` → 9+ tests pass.

### Step 2: Tighten cron auth to fail closed

In `app/api/cron/warm-discovery/route.ts` replace lines 51–55 with logic that returns 401 when `CRON_SECRET` is unset in production:

```ts
const cronSecret = process.env.CRON_SECRET;
if (process.env.NODE_ENV === 'production' && !cronSecret) {
  console.error('[warm-discovery] CRON_SECRET not configured; refusing to run');
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Note for the PR: Vercel cron invocations automatically send `Authorization: Bearer $CRON_SECRET` when the env var is set, so production behavior is unchanged as long as `CRON_SECRET` is configured — confirm it is set in the Vercel project before merging.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Persist a last-run record

At the end of the cron's successful path (right before the final `NextResponse.json` at line 207), write a compact summary to KV so staleness is diagnosable after the fact:

```ts
await cacheSet('discovery:cron:lastRun', {
  at: new Date().toISOString(),
  warmed: details.filter((d) => d.status === 'warmed' || d.status === 'shared').length,
  errors: details.filter((d) => d.status === 'error').map((d) => d.slug),
  skipped: skipped.length,
  bondApi: getBondApiStats(),
  elapsedMs: Date.now() - start,
}, { ttl: 24 * 60 * 60 });
```

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Cron route tests

Create `__tests__/api/warm-discovery.test.ts`. Mock `@/lib/config` (`getAllPageConfigs`), `@/lib/discovery-events` (`getDiscoveryEvents`, `filterEventsForResponse`), and `@/lib/bond-client` (`createBondClient` returning a stub with `getPrograms`). Import the route handler directly (`const { GET } = await import('@/app/api/cron/warm-discovery/route')`) and call it with a `NextRequest`. Cases:

1. No auth header + `CRON_SECRET` set → 401.
2. Production + no `CRON_SECRET` → 401 (the new fail-closed behavior).
3. Two configs with identical scope (same orgIds/apiKey/filters) → `getDiscoveryEvents` called once; both slugs appear in `details`, second with status `shared`.
4. Empty-write guard: pre-seed `discovery:response:{slug}` (via `cacheSet`) with `meta.totalFiltered: 5`; make the mocked pipeline return zero filtered events → response details show status `error` for that slug, and `cacheGet` still returns the previous payload.
5. A config with `discoveryRefreshPolicy: '60min'` freshly marked refreshed → appears in `skipped`.
6. Successful run writes `discovery:cron:lastRun` (assert via `cacheGet`).

**Verify**: `npm run test:run` → all pass.

## Test plan

Covered by Steps 1 and 4 (≥15 new tests). Pattern file: `__tests__/lib/config.test.ts`.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:run` exits 0 with ≥15 new tests across the two new files
- [ ] Cron returns 401 in production when `CRON_SECRET` is unset (test 2 proves it)
- [ ] `discovery:cron:lastRun` is written on success (test 6 proves it)
- [ ] No behavior change to `cached`/`cachedSWR` semantics (`git diff lib/cache.ts` shows only test seams, if anything)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `lib/cache.ts` module-level state cannot be isolated between tests even with `vi.resetModules()` — report rather than restructure the module.
- The cron route cannot be imported under vitest (e.g. `next/server` polyfill issues) after one reasonable config fix attempt.
- You discover the cron is invoked WITHOUT a bearer header in this Vercel setup (check `vercel.json` + Vercel docs) — then Step 2 would break production warming; stop and report.

## Maintenance notes

- These are characterization tests: if plan 006 changes cache semantics intentionally, update the tests in the same PR — never delete them to make a change pass.
- The `discovery:cron:lastRun` key is read by nothing yet; plan 008 (admin UI) should surface it on the admin dashboard, and plan 010 documents it in the runbook.
