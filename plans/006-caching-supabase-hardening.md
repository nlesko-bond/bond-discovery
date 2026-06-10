# Plan 006: Harden the caching pipeline — warm-on-create, dedupe drift files, close freshness gaps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- lib/cache.ts lib/config.ts lib/host-shell app/api/cron/warm-discovery app/api/pages`
> On mismatch with the "Current state" excerpts, treat as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the live data pipeline; every change is additive or behind existing guards, and plan 002's tests must already be green)
- **Depends on**: plans/002-verification-baseline-cache-tests.md (characterization tests must exist first)
- **Category**: tech-debt / perf / reliability
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

The caching architecture is fundamentally sound — KV with memory fallback, in-flight coalescing, SWR shadow keys, a 15-minute cron that groups page configs by data scope so slugs sharing orgs cost one Bond fetch, and an empty-write guard protecting live pages from a bad warm. The twin goals (always-relevant data, minimal Bond API calls) are mostly met. This plan closes the specific gaps that remain: (1) a newly created page serves slow cold-path responses for up to 15 minutes because nothing warms it on creation; (2) six `" 2.ts"` duplicate files in `lib/host-shell/` are drift bombs — edits land in one copy and silently don't apply; (3) admin config saves invalidate the response cache only when program filters change, but other payload-affecting fields (e.g. `eventHorizonMonths`, `bondEnv`) don't trigger re-warm; (4) the 4-hour programs cache has no SWR shadow, so its expiry causes user-facing slow requests.

## Current state

- Duplicate files (confirmed by `ls lib/host-shell/`): `portal-branding 2.ts`, `portal-filter-options 2.ts`, `portal-schedule-events 2.ts`, `portal-session-filters 2.ts`, `session-card-model 2.ts`, `session-sport-icon 2.ts` — each next to its canonical twin. Verify which copy is imported: `grep -rn "portal-branding\|session-card-model" --include="*.ts*" app components lib | grep "import\|from"` — imports use the unsuffixed names (TS module specifiers can't contain the space anyway), so the `" 2"` copies are dead. Diff each pair before deleting to ensure no fix landed only in the copy.
- Warm-on-create gap: `app/api/pages/route.ts` POST → `createPageConfig()` (in `lib/config.ts`) → nothing warms `discovery:response:{slug}`. First visitors hit the full fallback pipeline in `app/api/events/route.ts:155+` (seconds-slow under Bond rate limits).
- Invalidation trigger: `lib/config.ts` (~lines 362–377 per recon — verify exact lines) calls `invalidateDiscoveryResponseCache()` only when `excludedProgramIds`/`includedProgramIds` change.
- Programs cache: warmed by the cron with `ttl: max(cacheTtl, 4h)` (`app/api/cron/warm-discovery/route.ts:107-118`), read via `cached()` (no SWR shadow) elsewhere — find the read path: `grep -rn "programsCacheKey" lib app`.
- `lib/cache.ts` exports `cachedSWR()` (lines 330–372) ready to be used for programs.
- Cron self-heal: the API fallback intentionally does NOT write `discovery:response:{slug}` (`app/api/events/route.ts:215-219` comment) because partial rate-limited fetches would poison the cache for hours. **Preserve this invariant** — warm-on-create must reuse the cron's careful pipeline, not the API fallback.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm run test:run`   | all pass (incl. plan 002's cache tests) |
| Build     | `npm run build`      | exit 0              |

## Scope

**In scope**:
- `lib/host-shell/*\ 2.ts` (delete after diffing)
- `app/api/cron/warm-discovery/route.ts` (extract a reusable `warmSlug()`; accept `?slug=` param)
- `app/api/pages/route.ts`, `app/api/pages/[slug]/route.ts`, `lib/config.ts` (trigger warm/invalidate on create/update)
- Programs read path file(s) found via the `programsCacheKey` grep (switch `cached` → `cachedSWR`)
- `__tests__/api/warm-discovery.test.ts` (extend)

**Out of scope**:
- `lib/cache.ts` core semantics (`cached`, `cachedSWR`, key formats) — consumers change, primitives don't.
- `lib/availability-cache.ts` — its SWR design is already correct.
- Membership caching (`memberships:*` keys) — different feature, out of product scope.

## Git workflow

- Branch: `advisor/006-caching-hardening`
- Conventional commits, one per step.

## Steps

### Step 1: Delete the duplicate files

For each of the six pairs: `diff "lib/host-shell/<name> 2.ts" "lib/host-shell/<name>.ts"`. If identical or the `" 2"` copy is older/subset → delete the `" 2"` copy. If the `" 2"` copy contains changes absent from the canonical file → STOP condition (report the diff; a human must decide which is live).

**Verify**: `ls lib/host-shell/ | grep " 2"` → empty; `npm run typecheck` && `npm run test:run` → pass.

### Step 2: Extract warmSlug() from the cron

In `app/api/cron/warm-discovery/route.ts`, the per-scope-group body (lines ~99–205: warm programs caches, `getDiscoveryEvents({mode:'full', forceFresh:true})`, filter per slug, empty-write guard, `cacheSet` + `markDiscoveryRefreshed`) becomes an exported function in a new module `lib/discovery-warm.ts`:

```ts
export async function warmScopeGroup(configs: DiscoveryConfig[]): Promise<WarmDetail[]>
```

The cron route imports and calls it per group — behavior identical (plan 002's tests must stay green unmodified except import paths).

**Verify**: `npm run test:run` → warm-discovery tests pass unchanged.

### Step 3: Warm on create / on payload-affecting update

- `app/api/pages/route.ts` POST: after `createPageConfig` succeeds, fire-and-forget `warmScopeGroup([newConfig]).catch(err => console.error('[pages] warm-on-create failed', err))` — do NOT await it in the response path (admin UX) but DO `void`-annotate intentionally. Vercel note: fire-and-forget can be killed at lambda end; if the repo targets Vercel Node runtime, prefer `waitUntil`-style handling — Next 14 lacks `after()`, so awaiting with a `Promise.race` timeout of ~20s is the pragmatic choice; pick awaiting-with-timeout and say so in the commit.
- `app/api/pages/[slug]/route.ts` PATCH: extend the existing invalidation logic in `lib/config.ts` so changes to any of `eventHorizonMonths`, `bondEnv`, `organizationIds`, `facilityIds`, `apiKey`, `programFilterMode` (in addition to the current included/excluded ids) call `invalidateDiscoveryResponseCache(slug, bondEnv)` — covering BOTH old and new bondEnv keys when bondEnv itself changes. Then trigger the same warm-with-timeout.

**Verify**: new tests (Step 5); `npm run typecheck` → exit 0.

### Step 4: SWR shadow for the programs cache

On the programs read path (file found via grep, likely `lib/embed-discovery-programs.ts` or `lib/bond-client.ts` callers): replace `cached(key, fetcher, {ttl})` with `cachedSWR(key, fetcher, {ttl})` for program fetches. This gives programs the same stale-while-revalidate behavior availability already has: expiry never blocks a user request as long as the shadow key (2× TTL = 8h) holds data.

**Verify**: `grep -n "cachedSWR" <the file>` → present; `npm run test:run` → pass.

### Step 5: Tests

Extend `__tests__/api/warm-discovery.test.ts` (and add `__tests__/lib/discovery-warm.test.ts` if cleaner):
1. POST /api/pages (mocked auth OK, mocked Bond pipeline) → `warmScopeGroup` invoked with the new config; response still returns within the timeout when warm hangs (mock a never-resolving warm; assert the route responds).
2. PATCH changing `eventHorizonMonths` → `invalidateDiscoveryResponseCache` called.
3. PATCH changing `bondEnv` from 'production' to 'staging' → both `discovery:response:{slug}` and `discovery:response:staging:{slug}` invalidated.
4. PATCH changing only `branding.primaryColor` → NO invalidation (branding doesn't affect the events payload).

**Verify**: `npm run test:run` → all pass.

## Test plan

Steps 1–4 verified by plan 002's characterization suite staying green + 4 new tests in Step 5.

## Done criteria

- [ ] `ls lib/host-shell/ | grep " 2"` → empty
- [ ] `lib/discovery-warm.ts` exists; cron route delegates to it; warm-discovery tests pass
- [ ] Page create and payload-affecting PATCH trigger warm/invalidate (tests 1–3)
- [ ] Branding-only PATCH does not invalidate (test 4)
- [ ] Programs read path uses `cachedSWR`
- [ ] `npm run typecheck`, `npm run test:run`, `npm run build` all exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any `" 2.ts"` file differs meaningfully from its canonical twin (Step 1) — report the diff, do not merge them yourself.
- `warmScopeGroup` extraction forces signature changes that break plan 002's tests in ways that aren't pure import-path updates — the refactor is drifting; stop.
- The programs read path turns out to be shared with non-discovery features (memberships/onboarding) — switching it to SWR there too is out of scope; report instead.

## Maintenance notes

- The empty-write guard now lives in `lib/discovery-warm.ts`; any future "freshen faster" work must keep it — partial Bond fetches must never overwrite a good payload.
- Reviewer should scrutinize: the warm-on-create timeout behavior on Vercel (lambda teardown), and that invalidation covers both bondEnv key variants.
- Deferred: per-org Bond API quota tracking (one runaway org sharing an API key can starve others) — revisit if rate-limit hits (`bondApi.rateLimitHits` in cron responses) trend up.
