# Plan 005: Stand up a true staging environment (Vercel + Supabase + KV + cron)

> **Executor instructions**: Follow this plan step by step. Parts of this plan
> are infrastructure actions in the Vercel/Supabase dashboards that you cannot
> perform — produce the exact configuration as a checklist for the operator and
> implement only the code-side pieces. Run every verification command. If
> anything in the "STOP conditions" section occurs, stop and report.
> When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- lib/supabase.ts lib/config.ts vercel.json .env.example`
> On mismatch with the "Current state" excerpts, treat as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW for production (code changes are env-resolution only and default to current behavior); the risk being eliminated is "testing in production"
- **Depends on**: none (do before plans 007/009, which need a safe place to verify)
- **Category**: dx / infrastructure
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

Every change today is verified in production because there is nowhere else to verify it: the Supabase URL and anon key are hardcoded as fallbacks, so *any* deployment or local run without env vars silently reads and writes the **production** database; Vercel preview deployments share production KV and run against production page configs; and the cron only exists in the production project. The operator's requirement: a true dev/staging environment so nothing ships "wildly to production." This plan creates environment isolation: a staging Supabase project (or branch), a staging KV store, staging env vars on Vercel's preview environment, and removal of the prod-pinning fallbacks.

## Current state

- `lib/supabase.ts:3-8` — hardcoded production fallbacks:

```ts
const DEFAULT_SUPABASE_URL = 'https://mxketdjzelojxjnzsjgd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOi...';   // anon JWT, committed to the repo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
```

  Also used as fallbacks in `getSupabaseAnonKeyForServer()` (line 33) and `getSupabaseUrlForServer()` (line 51). The anon key is public-by-design (RLS enforces access) so this is not a secret leak per se — the problem is **environment pinning**: every misconfigured environment silently becomes production.
- `lib/cache.ts:34` — KV used only when `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set; otherwise in-process memory. So staging KV = a second Upstash database with its own URL/token. (Memory fallback is fine for local dev but not for staging, where the cron and the pages run in different lambdas.)
- `vercel.json` — four crons including `/api/cron/warm-discovery` every 15 min. Vercel runs crons only on the production deployment of a project, and sends `Authorization: Bearer $CRON_SECRET` automatically when set.
- `features.bondEnv` per page config (`'production' | 'staging' | 'dev' | ...`) already routes Bond API calls per page (`createBondClient(apiKey, bondEnv)` in `app/api/cron/warm-discovery/route.ts:106`), and cache keys are already env-segmented (`discoveryResponseCacheKey(slug, bondEnv)`, `lib/cache.ts:215-219`). So Bond-API-level staging exists per page; what's missing is app-level isolation (DB, KV, deployment).
- There is a `.env.example` question: check whether it exists and what it documents (`ls -la .env*`). Recon found Supabase/KV/CRON_SECRET vars undocumented.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm run test:run`   | all pass            |
| Build     | `npm run build`      | exit 0              |
| Env check | `node -e "require('./scripts/check-env.js')"` (created in Step 3) | prints env summary |

## Scope

**In scope** (code):
- `lib/supabase.ts` (remove hardcoded fallbacks, fail loudly)
- `.env.example` (create/update — variable NAMES and descriptions only, never values)
- `scripts/check-env.js` (create — startup env sanity report)
- `docs/environments.md` (create — the staging runbook)
- `__tests__/lib/supabase-env.test.ts` (create)

**Operator checklist** (dashboard actions — deliver as `docs/environments.md`):
- Create staging Supabase project (or Supabase branch); run the schema (tables `discovery_pages`, `partner_groups` — extract DDL from the production project or a migration file if one exists; if no migrations exist, note that as follow-up).
- Create a second Upstash/Vercel-KV database for staging.
- In Vercel: set Preview-environment values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_BOND_GTM_ID` (a staging GTM container or empty). Production values stay as-is.
- Optionally create a dedicated `bond-discovery-staging` Vercel project pinned to a `staging` branch if cron-on-staging is required (Vercel crons don't run on preview deployments — see Step 5).

**Out of scope**:
- Changing `features.bondEnv` semantics or Bond API client routing.
- Auth (plan 001), caching semantics (plan 008).

## Git workflow

- Branch: `advisor/005-staging-environment`
- Commit: `feat(env): remove prod fallbacks, add env validation and staging runbook`

## Steps

### Step 1: Remove production fallbacks from lib/supabase.ts

Delete `DEFAULT_SUPABASE_URL` and `DEFAULT_SUPABASE_ANON_KEY`. New resolution rules:
- `supabaseUrl` / `supabaseAnonKey` (module level, used by the public client): from env only. If missing, **throw at first use** (not at import — Next builds import modules without env) with an actionable message: `'Supabase env not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example)'`. Wrap the public client in a lazy getter (`getSupabasePublic()`) to enable that; update the ~handful of `import { supabase }` call sites (`grep -rn "from '@/lib/supabase'" app lib components | grep -v Admin`).
- `getSupabaseUrlForServer()` / `getSupabaseAnonKeyForServer()`: same — drop the DEFAULT fallback branch, keep the JWT-`ref` derivation (it correctly follows the configured key's project).

This is the riskiest step: production currently *relies* on the fallbacks if Vercel env vars were never set. **Before removing, verify with the operator (or via `vercel env ls` if a token is available) that production has the env vars set.** If you cannot verify, implement the throw as a loud `console.error` + fallback for exactly one release, and record that in the index.

**Verify**: `npm run typecheck` → exit 0; `grep -n "mxketdjzelojxjnzsjgd" lib/` → no matches (the project ref appears nowhere in code).

### Step 2: Tests for env resolution

`__tests__/lib/supabase-env.test.ts` with `vi.resetModules()` + `vi.stubEnv` per case:
1. All env vars present → clients construct, URL matches env.
2. Missing public env → `getSupabasePublic()` throws with the actionable message.
3. `SUPABASE_SERVICE_ROLE_KEY` present but no URL env → URL derived from JWT `ref` claim (build a fake JWT: `header.${base64url(JSON.stringify({ref:'abc123'}))}.sig`) → `https://abc123.supabase.co`.

**Verify**: `npm run test:run` → pass.

### Step 3: Env sanity script + .env.example

- `scripts/check-env.js`: prints (never the values — only SET/MISSING and, for URLs, the host) the status of: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SERVICE_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_BOND_GTM_ID`, `NEXT_PUBLIC_BOND_CONSUMER_ORIGIN`. Exit 1 if a required var is missing. Wire it as `"predev"` and `"prebuild"`? No — Vercel builds would fail on intentionally-absent vars; instead add it as `npm run check:env` script in `package.json`.
- `.env.example`: every variable above with a one-line comment and placeholder (e.g. `NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co`). **No real values.**

**Verify**: `npm run check:env` runs and reports; `.env.example` contains no JWT-looking strings (`grep -c "eyJ" .env.example` → 0).

### Step 4: Write docs/environments.md (the operator runbook)

Sections: (1) environment matrix — local / preview-staging / production, with which Supabase project, KV store, Bond env, GTM container each uses; (2) the Vercel dashboard checklist from Scope; (3) how to seed staging: export `discovery_pages` + `partner_groups` rows from production (Supabase dashboard CSV or `pg_dump --data-only -t discovery_pages -t partner_groups`), scrub `api_key` values, import to staging; (4) how to smoke-test a staging page end-to-end (create page in staging admin → load `/portal/{slug}` → verify `X-Bond-Events-Cache` header → trigger `curl -H "Authorization: Bearer $CRON_SECRET" https://<staging>/api/cron/warm-discovery`); (5) the cron caveat below.

### Step 5: Cron on staging

Vercel crons run only on production deployments. Document the two options in `docs/environments.md` and implement nothing destructive:
- **Recommended**: separate `bond-discovery-staging` Vercel project (same repo, `staging` branch, its own env vars incl. its own `CRON_SECRET`) — crons run there natively from the same `vercel.json`.
- Alternative: no cron on staging; warm manually via the curl above before testing.

**Verify**: `docs/environments.md` exists and covers all 5 sections; `npm run build` → exit 0.

## Test plan

Step 2's three tests, plus the full suite: `npm run test:run` → all pass.

## Done criteria

- [ ] `grep -rn "mxketdjzelojxjnzsjgd\|DEFAULT_SUPABASE_ANON_KEY" lib/ app/ components/` → no matches
- [ ] `npm run typecheck`, `npm run test:run`, `npm run build` all exit 0
- [ ] `.env.example` documents all 9 env vars, contains no real values
- [ ] `docs/environments.md` exists with environment matrix + operator checklist + seeding + smoke test + cron strategy
- [ ] `npm run check:env` exists and exits 1 when required vars are missing
- [ ] `plans/README.md` status row updated

## STOP conditions

- You cannot confirm production Vercel has the Supabase env vars set AND the operator is unreachable → use the loud-warning fallback variant of Step 1 and flag it prominently in your report (removing the fallback blind could take down production pages).
- The Supabase schema has no migration files and you'd have to reverse-engineer DDL beyond the two known tables → document the two tables you can derive from `lib/supabase.ts` types and `lib/config.ts` queries; list the rest as operator TODO.

## Maintenance notes

- Rotation note: the production anon key has been committed to git history (`lib/supabase.ts:4-5`). Anon keys are public by design, but since the URL+key pair invites direct API probing, rotate the anon key after RLS policies are reviewed (operator task; record in the index).
- Once staging exists, plans 007 (embed removal) and 009 (templates) must be verified there before production.
- Future schema changes should land as Supabase migration files; the absence of migrations is recorded as accepted debt in `plans/README.md`.
