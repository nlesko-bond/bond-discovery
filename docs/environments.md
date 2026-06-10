# Environments: local / preview-staging / production

How the bond-discovery app is isolated per environment, and the operator
checklist for standing up a true staging environment (plan 005). Run
`npm run check:env` at any time to see which variables are set (values are
never printed).

> **Deprecation warning (one release only)**: if the Supabase env vars are
> missing, the app currently logs a loud `console.error` and falls back to the
> hardcoded **production** Supabase project. UPDATE 2026-06-10: the fallback has
> been REMOVED (`DEPRECATED_PROD_FALLBACK` is now `null`) after the operator
> confirmed the Vercel env vars; missing env now throws. Historical note: it was
> REMOVED in the next release (set the constant to `null`). After removal,
> missing env vars throw at first use. **Operators: verify the production
> Vercel project has all Supabase env vars set before the next release.**

## 1. Environment matrix

| | Local dev | Preview / staging | Production |
|---|---|---|---|
| Deployment | `next dev` on your machine | Vercel Preview deployments (every non-main branch push) | Vercel Production (main) |
| Supabase project | Staging project (via `.env.local`) — never production | **Staging** Supabase project (Preview-scoped env vars) | Production project (`mxketdjzelojxjnzsjgd`) |
| KV / cache | None — in-process memory cache (KV vars unset) | **Staging** Upstash/Vercel KV database | Production KV database |
| Bond API env | Per page via `features.bondEnv` (`production`/`staging`/`dev`); cache keys are already env-segmented | Same — page configs in the staging DB should use `staging`/`dev` `bondEnv` where possible | Per page `features.bondEnv` |
| GTM container | Empty (`NEXT_PUBLIC_BOND_GTM_ID` unset) | Staging GTM container or empty | Production GTM container |
| Cron | Manual `curl` (see section 5) | Not run by Vercel (see section 5) | Vercel crons from `vercel.json` |
| `CRON_SECRET` | Optional (only to test cron routes) | Its own staging value | Production value |

Key properties:

- **Which database you hit is decided only by env vars** (`lib/supabase.ts`).
  There is no code-level environment switch — a deployment with staging vars
  *is* staging.
- KV is used only when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set
  (`lib/cache.ts`); otherwise an in-process memory cache is used. Memory is
  fine locally but **not** for staging, where the cron warmers and page
  renders run in different lambdas.
- `NEXT_PUBLIC_*` variables are inlined at **build** time. Changing them in
  Vercel requires a redeploy to take effect.

## 2. Operator checklist (Vercel + Supabase + KV dashboards)

These are dashboard actions the code cannot perform.

### 2.1 Create the staging Supabase project

1. In the Supabase dashboard, create a new project (e.g. `bond-discovery-staging`)
   — or use a Supabase branch of the production project if branching is enabled.
2. Apply the schema. **Important caveat**: this repo's migrations do *not*
   include the base DDL for the two core tables:
   - `migrations/` (001–013) only *alters* `discovery_pages` and adds the later
     page tables (`membership_pages`, `form_pages`, `reservation_pages`,
     `documentation_pages`, analytics) — the initial `CREATE TABLE` for
     `discovery_pages` and `partner_groups` predates migration 001.
   - `supabase/migrations/` (001–010) covers the onboarding schema only.

   So: extract the base DDL from production first (Supabase dashboard →
   Database → Tables → `discovery_pages` / `partner_groups` → "Definition", or
   `pg_dump --schema-only -t discovery_pages -t partner_groups`), apply it to
   staging, then run the files in `migrations/` in order, then
   `supabase/migrations/` in order. **Follow-up (accepted debt)**: commit that
   base DDL as migration `000_base_schema.sql` so staging can be rebuilt from
   the repo alone.
3. Re-create the RLS policies from production (also visible in the dashboard
   table definitions). Verify anon reads behave the same as production.
4. Note the staging project's URL, anon key, and service-role key.

### 2.2 Create the staging KV database

1. Create a second Upstash (or Vercel KV) Redis database, e.g.
   `bond-discovery-staging`.
2. Note its `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Never reuse the
   production pair on staging — shared KV means staging warms/poisons
   production caches.

### 2.3 Set Preview-environment variables in Vercel

In the Vercel project → Settings → Environment Variables, add **Preview**-scoped
values (Production values stay exactly as they are):

| Variable | Preview value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | staging Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service-role key |
| `KV_REST_API_URL` | staging KV URL |
| `KV_REST_API_TOKEN` | staging KV token |
| `CRON_SECRET` | a new random value (staging-only) |
| `NEXT_PUBLIC_BOND_GTM_ID` | staging GTM container id, or empty |

While doing this, **confirm the Production scope has all of these set too** —
the code's hardcoded production fallback is being removed in the next release.

### 2.4 Optional: dedicated staging project (needed for cron-on-staging)

If crons must run on staging (see section 5): create a second Vercel project
(`bond-discovery-staging`) from the same repo, pin its Production branch to
`staging`, and set the table above as that project's **Production** env vars.
Crons from `vercel.json` then run there natively.

## 3. Seeding staging data

1. Export from production: Supabase dashboard → Table editor →
   `partner_groups` and `discovery_pages` → export CSV. Or:
   `pg_dump --data-only -t partner_groups -t discovery_pages <prod-conn-string>`.
   (Import `partner_groups` first — `discovery_pages.partner_group_id`
   references it.)
2. **Scrub `api_key` values** in both tables before import — production Bond
   API keys must not live in staging. Replace them with staging Bond API keys
   (pages already support per-page `features.bondEnv` to point at the Bond
   staging API).
3. Also scrub/replace `gtm_id` values (page- and partner-level) so staging
   traffic never reports into production GTM containers.
4. Import into the staging project (CSV import in the dashboard, or `psql \copy`).

## 4. Smoke-testing a staging page end-to-end

1. Open the staging deployment's `/admin`, create (or pick) a page; set
   `features.bondEnv` to `staging` and a staging Bond API key.
2. Load `https://<staging-host>/portal/{slug}` — the page should render
   programs from the Bond staging API.
3. Verify caching is on KV, not memory: `curl -sI https://<staging-host>/portal/{slug}`
   and check the `X-Bond-Events-Cache` response header (`HIT`/`MISS`;
   a second request should be `HIT`).
4. Warm the cache manually:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<staging-host>/api/cron/warm-discovery`
   (use the *staging* `CRON_SECRET`). Then re-load the portal page and expect
   a cache `HIT`.
5. Confirm isolation: the new/edited page must **not** appear in production
   `/admin`, and production KV metrics must show no traffic from your test.

## 5. Cron on staging

Vercel runs `vercel.json` crons **only on production deployments** of a
project — never on previews. Two options:

- **Recommended**: the dedicated `bond-discovery-staging` Vercel project from
  section 2.4 (same repo, `staging` branch as its production branch, its own
  env vars including its own `CRON_SECRET`). All four crons
  (`warm-discovery`, `warm-memberships`, `onboarding-stall-alerts`,
  `push-key-dates`) run there natively from the same `vercel.json`.
- **Alternative (no second project)**: skip crons on staging and warm caches
  manually before testing with the `curl` from section 4 step 4.

## 6. Maintenance notes

- **Anon key rotation (operator task)**: the production anon key was committed
  to git history in `lib/supabase.ts`. Anon keys are public by design (RLS
  enforces access), but the URL+key pair invites direct API probing — rotate
  the anon key after the RLS policies are reviewed.
- **Fallback removal (next release)**: set `DEPRECATED_PROD_FALLBACK` to
  `null` in `lib/supabase.ts` (one line). Done criteria: no
  `mxketdjzelojxjnzsjgd` string anywhere in `lib/`, and
  `__tests__/lib/supabase-env.test.ts` updated so the missing-env cases assert
  the thrown `SUPABASE_ENV_ERROR` instead of the warning.
- **Migrations**: future schema changes must land as migration files
  (`migrations/` for the discovery schema, `supabase/migrations/` for
  onboarding). The missing base DDL (section 2.1) is recorded as accepted debt.
- Plans 007 (embed removal) and 009 (page templates) must be verified on
  staging before production.
