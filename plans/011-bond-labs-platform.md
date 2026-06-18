# Plan 011: Build "Bond Labs" — a zero-config internal hosting + API platform (new repo)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` in the bond-discovery repo — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: this plan creates a NEW repository (`bond-labs`)
> and modifies nothing in bond-discovery except `plans/README.md`. The drift
> check is therefore: confirm the bond-discovery files excerpted under
> "Current state" still match (`git -C <bond-discovery> diff --stat 0a1fa9a..HEAD -- lib/auth.ts lib/supabase.ts tailwind.config.js scripts/check-env.js`).
> Mismatches in those files are informational (they are *patterns to copy*,
> not files to edit) — re-read the live file and copy the live pattern.

## Status

- **Priority**: P1 (direction — leadership-sponsored internal platform)
- **Effort**: L (phased; Phase A+B alone is a demoable MVP, ~M)
- **Risk**: MED (greenfield, so no production blast radius — risk is in the data-access guardrails of Phase D)
- **Depends on**: none (independent of plans 001–010)
- **Category**: direction
- **Planned at**: bond-discovery commit `0a1fa9a`, 2026-06-11 (renamed Quick→Labs 2026-06-11)

## Why this matters

Shopify built an internal platform called **Quick** (thread:
https://x.com/pushmatrix/status/2064722585019969727, writeup:
https://shopify.engineering/quick): employees deploy a folder of static HTML
to `{site}.quick.shopify.io` behind SSO, and every site gets zero-config,
browser-callable APIs — a Firebase-style JSON document DB, file storage, an
AI/LLM proxy, websockets, user identity, and data-warehouse queries. No API
keys, no frameworks, no pipelines. Results at Shopify: 50,000+ sites in under
a year, >50% of employees built at least one, the whole thing runs on ~$200/mo
of infrastructure, and the culture shifted to "demos over memos."

The unlock is that **AI agents can now write the HTML**, so the bottleneck is
no longer building — it's hosting, sharing, auth, and data access. Bond has
the same bottleneck: anyone can ask Claude to generate a dashboard, but nobody
can put it somewhere SSO-protected, on-brand, and wired to real production
data in five minutes. This plan builds the Bond-native equivalent:
**Bond Labs** at `labs.bondsports.co`, with two Bond-specific additions —
(1) read-only Snowflake / production-data queries so anyone can build internal
tools on real data, and (2) a one-line Bond design-system include so every
site looks on-brand. It is AI-agent-first: `labs init` scaffolds a site with
a CLAUDE.md that teaches Claude Code the whole API surface.

## Current state (facts, verified by direct read of bond-discovery)

There is no internal hosting platform at Bond today. The bond-discovery repo
is the evidence base for Bond's stack and the source of patterns to copy:

- **Hosting**: Vercel, Next.js 14 App Router, Node runtime, crons in
  `vercel.json` (`vercel.json:5-22`). Bond Labs should be a **separate
  Vercel project + repo** — bond-discovery is a live partner-facing product
  and must not absorb an internal platform.
- **SSO pattern** (`lib/auth.ts:1-56`): NextAuth v4 + GoogleProvider, sign-in
  restricted to the `bondsports.co` domain, JWT sessions, 7-day maxAge:

  ```ts
  // lib/auth.ts:5,16-27 (bond-discovery)
  const ALLOWED_DOMAINS = ['bondsports.co'];
  ...
  async signIn({ user }) {
    if (user.email) {
      const domain = user.email.split('@')[1];
      if (ALLOWED_DOMAINS.includes(domain)) return true;
    }
    return false;
  }
  ```

  This is Bond's analog of Shopify's Identity-Aware Proxy: put it in a global
  `middleware.ts` and *everything* on the domain is employee-only.
- **Supabase pattern** (`lib/supabase.ts:49-54,124-138`): lazy singleton
  clients (`getSupabasePublic()` / `getSupabaseAdmin()`), env-driven, throws
  `SUPABASE_ENV_ERROR` when unset (never silently falls back to production).
  Copy this module shape.
- **KV cache pattern** (`lib/cache.ts:1-45`): `@vercel/kv` lazy singleton with
  in-memory fallback when `KV_REST_API_URL`/`KV_REST_API_TOKEN` are unset.
  Copy for caching served site files and for rate-limit counters.
- **Versioned JS kit precedent** (`public/bond-host/v1.js:1-6`): Bond already
  ships a self-hosted, no-build-step JS kit from `/public` with a versioned
  filename. `labs.js` follows the same convention (`public/labs/v1.js`,
  also served at `/labs.js` via a rewrite).
- **Bond design tokens** (`tailwind.config.js:34-61`): the `bond-*` palette is
  the only codified Bond brand today — brand blue `#0d4774`, brand-light
  `#e8eef4`, accent gold `#f7b500`, accent-muted `#fef6e0`, bg `#f7f7f5`,
  text `#2c2c2a`, border `#e0dfd8`, green `#22c55e`, muted `#888888`, plus
  note/optional/badge colors. There is **no published Bond UI package** in
  this repo; the real design system lives in the Bond clients monorepo
  (`packages/ui`) which is NOT checked out here.
- **Env hygiene pattern** (`scripts/check-env.js:1-10`): a `check:env` script
  that prints SET/MISSING (never values) and exits 1 on missing required
  vars. Replicate it.
- **Conventions**: TypeScript `strict: true`, `@/*` path alias, Vitest +
  Testing Library for unit/integration, Playwright for e2e, `next lint`,
  folders `app/` (routes), `lib/` (modules), `components/`, `types/`,
  `migrations/` (numbered SQL).
- **Not present anywhere in bond-discovery**: Snowflake (zero references) and
  direct production-DB access (only the Bond Public API). Both are
  **operator-provisioned prerequisites** (see below), not things this plan
  can self-serve.

## Decisions already made (the architecture — do not relitigate, but STOP if a prerequisite fails)

Shopify's build (single GCP VM, NGINX wildcard vhosts, gcsfuse-mounted GCS
bucket, IAP, Node-then-Go API server) is translated to Bond's existing
Vercel/Supabase stack so there is zero new infrastructure to operate:

| Concern | Shopify Quick | Bond Labs (this plan) |
|---|---|---|
| Serving | NGINX + gcsfuse on one VM | Next.js catch-all route streaming from Supabase Storage, KV-cached |
| Site URLs | `{site}.quick.shopify.io` | **Path-based MVP**: `labs.bondsports.co/s/{site}/` (one domain → one NextAuth cookie, no wildcard DNS/TLS work). Wildcard subdomains are a deferred follow-up. |
| Employee auth | Google Identity-Aware Proxy | NextAuth Google SSO, `bondsports.co`-restricted, enforced in `middleware.ts` on every route |
| Deploy | `quick deploy` (gcloud rsync wrapper) | `labs` CLI (npm package or repo script): tars the folder, POSTs to `/api/deploy` with a personal token |
| Document DB | Shared server, firebase-style JSON store, "big persisted json namespace per site" | `labs_documents` table in a **new dedicated Supabase project** (jsonb, namespaced `site/collection`), REST routes, session-auth |
| File storage | GCS | Supabase Storage (`labs-files` bucket) |
| AI | server-side keys, `quick.ai.chat(...)` | `/api/ai/chat` proxy to Anthropic API (server-side `ANTHROPIC_API_KEY`), per-user KV rate limit |
| Websockets / realtime | socket.io on the VM | Supabase Realtime channels (Vercel can't hold websockets) — `labs.realtime.channel(name)` wraps it |
| Data warehouse | BigQuery proxy | **Snowflake read-only proxy** with hard guardrails (read-only role, SELECT-only parser check, row cap, statement timeout) |
| Identity API | name/title/team/Slack from IdP | `/api/me` from the NextAuth session (name, email, avatar); title/team/Slack enrichment deferred |
| Design system | n/a (not in Shopify's version) | `/bond.css` tokens + components, one `<link>` line; tokens seeded from `tailwind.config.js:34-61` |

**Trust model** (same as Shopify's, state it in the docs): every site is
behind SSO and visible to all employees. Sites share the `labs.bondsports.co`
origin and APIs are scoped per-site by a header the kit sets — a malicious
*employee* could read another site's collections. That is accepted for an
internal tool (Shopify: "being internal removes the security concerns that
plague public websites"), EXCEPT for the data-warehouse proxy, where the
guardrails are real security boundaries and must be tested.

**Production-database stance**: do NOT connect Labs to the production OLTP
database in this plan. Bond's production data should reach Labs through
Snowflake (the analytics copy). A direct read-replica connection is listed as
a deferred follow-up requiring an explicit DBA/security sign-off. If the
operator confirms production data is NOT in Snowflake, that is a STOP
condition for Phase D (ship Phases A–C and E–F regardless).

## Operator prerequisites (non-code; collect before or during Phase A)

The executor cannot create these. Ask the operator; each unblocks the phase noted:

1. **Domain**: configure `labs.bondsports.co` on a new Vercel project. (Phase A)
2. **Google OAuth client** (new client ID/secret for this domain, same Google
   Workspace as `lib/auth.ts` uses). (Phase A)
3. **New Supabase project** dedicated to Labs (do NOT reuse the
   bond-discovery project) — URL, anon key, service-role key. (Phase B)
4. **Upstash/Vercel KV** store for the new project (optional locally). (Phase B)
5. **Anthropic API key** with a monthly spend cap. (Phase C)
6. **Snowflake**: account locator, a dedicated `LABS_RO` user + role with
   SELECT-only grants on the curated schemas the data team approves, an
   XS warehouse with auto-suspend + a resource monitor. Ask the data team
   which schemas. (Phase D)
7. **Decision**: confirm production data lands in Snowflake (expected yes).
   If no → Phase D STOP condition. (Phase D)
8. **Design tokens**: ask frontend (clients monorepo `packages/ui` owners)
   for the canonical token values; until then, the `bond-*` palette from
   `tailwind.config.js:34-61` is the seed. (Phase E)

## Commands you will need

In the new repo (identical scripts to bond-discovery — copy its `package.json` script block):

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 |
| Dev | `npm run dev` | serves http://localhost:3000 |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| Unit tests | `npm run test:run` (vitest) | all pass |
| E2E | `npm run test:e2e` (playwright) | all pass |
| Lint | `npm run lint` | exit 0 |
| Env report | `npm run check:env` | prints SET/MISSING, exit 0 when required vars set |

## Suggested executor toolkit

- `vercel-react-best-practices` skill when writing the explore/gallery page
  and the serving route (streaming, caching headers).
- `anthropic-skills:skill-creator` + `claude-api` skills for Step 16 (the
  Claude Code skill and the AI proxy's model choices — default the proxy to
  `claude-haiku-4-5-20251001`, allow `claude-fable-5` opt-in per request).
- Reference reading: https://shopify.engineering/quick (the source design);
  Supabase Realtime docs; `snowflake-sdk` npm docs.

## Scope

**In scope**:
- A new repository `bond-labs` (everything under it).
- `plans/README.md` in bond-discovery (status row update only).

**Out of scope** (do NOT touch):
- All bond-discovery source code. Labs copies *patterns* from
  `lib/auth.ts`, `lib/supabase.ts`, `lib/cache.ts`, `scripts/check-env.js`,
  `tailwind.config.js` — it never imports from or modifies bond-discovery.
- The bond-discovery Supabase project and its tables.
- Bond's production OLTP database (explicitly deferred; see stance above).
- The clients monorepo / `packages/ui`.

## Git workflow

- New repo `bond-labs`, default branch `main`.
- Conventional-commit style messages matching bond-discovery's log, e.g.
  `feat(labs-db): collection CRUD routes with per-site namespacing`
  (compare `git -C <bond-discovery> log --oneline -5`).
- Commit per step. Do not push or create the GitHub repo without the
  operator confirming the org/visibility (it must be **private/internal**).

## Steps

### Phase A — walls and floor: repo + SSO (demo: "any page I deploy is employee-only")

#### Step 1: Scaffold `bond-labs`

Create a sibling directory `bond-labs` with Next.js 14 App Router +
TypeScript strict + Tailwind, mirroring bond-discovery's `tsconfig.json`
(strict, `@/*` alias), `vitest.config.ts`, `playwright.config.ts`, ESLint via
`next lint`, and the script block from its `package.json` (listed in
"Commands you will need"). Dependencies: `next@^14`, `react@^18`,
`next-auth@^4`, `@supabase/supabase-js@^2`, `@vercel/kv@^2`, `zod@^3`;
dev: vitest, playwright, testing-library (copy versions from bond-discovery's
`package.json`). Add `scripts/check-env.js` modeled on bond-discovery's
(`scripts/check-env.js:1-30` pattern: loads `.env.local`, prints SET/MISSING
only, exits 1 on missing required). Required vars: `NEXTAUTH_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; optional:
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `ANTHROPIC_API_KEY`, `SNOWFLAKE_*`.
Write a README stating what Labs is (3 paragraphs max, link the Shopify
writeup) and a CLAUDE.md for the repo itself (commands + invariants).

**Verify**: `npm run typecheck && npm run lint && npm run test:run` → all exit 0
(include one placeholder vitest test so the suite isn't empty).

#### Step 2: Global SSO wall + identity API

- `lib/auth.ts`: copy bond-discovery `lib/auth.ts:1-56` verbatim, then change
  the sign-in pages to `/login`. Keep `ALLOWED_DOMAINS = ['bondsports.co']`.
- `app/api/auth/[...nextauth]/route.ts`: standard NextAuth handler.
- `middleware.ts`: require a valid session token (`getToken` from
  `next-auth/jwt`) for EVERY path except `/api/auth/*`, `/login`, and Next
  static assets; redirect browsers to `/login`, return 401 JSON for `/api/*`.
  This is the IAP analog — sites get auth without doing anything.
- `app/api/me/route.ts`: returns `{ name, email, image }` from the session.
  This is the `labs.me` backend.
- `app/login/page.tsx`: minimal Google sign-in page (use the `bond-brand`
  blue `#0d4774` for the button; full design system comes in Phase E).

**Verify**: `npm run dev`, then `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/me`
→ `401`. Vitest: a middleware unit test asserting `/api/me` without a token
→ 401 and `/api/auth/signin` is excluded. Playwright: unauthenticated visit
to `/` redirects to `/login`.

### Phase B — the magic moment: deploy a folder, get a URL (Shopify's core loop)

#### Step 3: Site registry + storage

New Supabase migration `migrations/001_labs_base.sql` (run against the NEW
Labs Supabase project via its SQL editor; keep the file in-repo as the
source of truth, numbered like bond-discovery's `migrations/`):

```sql
create table labs_sites (
  name        text primary key check (name ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  owner_email text not null,
  title       text,
  description text,
  deploy_count int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table labs_tokens (
  token_hash  text primary key,          -- sha256 of the token; raw value never stored
  email       text not null,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);
create table labs_documents (
  id          uuid primary key default gen_random_uuid(),
  site        text not null references labs_sites(name) on delete cascade,
  collection  text not null,
  data        jsonb not null,
  created_by  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index labs_documents_site_collection on labs_documents (site, collection);
```

Create Storage buckets `labs-sites` (site files) and `labs-files`
(user uploads), both private. Add `lib/supabase.ts` copying bond-discovery's
lazy-singleton + throw-on-missing-env shape (`lib/supabase.ts:49-54,124-138`)
— service-role client only on the server; the anon key is used solely for
Realtime in Phase C.

**Verify**: a vitest integration test (skipped unless `NEXT_PUBLIC_SUPABASE_URL`
is set, matching how bond-discovery guards env-dependent tests) inserts and
reads back a `labs_sites` row. `npm run typecheck` → exit 0.

#### Step 4: Deploy + token APIs

- `app/token/page.tsx`: signed-in page with a "Create deploy token" button →
  `POST /api/tokens` generates a random 32-byte token, stores its sha256 in
  `labs_tokens`, shows the raw value once.
- `app/api/deploy/route.ts` (`POST`): auth via `Authorization: Bearer <token>`
  (hash → `labs_tokens`) OR a browser session. Body: multipart with a
  `.tar.gz` of the site folder plus a `site` name field. Behavior:
  validate the name against the `labs_sites` regex; first deploy claims the
  name (insert row with the token's email as owner); later deploys require
  owner match (or any session user if the operator opts for open
  collaboration — default: owner-only, return 403 otherwise). Extract the
  tar in memory (`tar` npm package), reject any entry with `..`/absolute
  paths or symlinks, cap 25 MB and 500 files, then upload each file to
  `labs-sites/{site}/{path}` (upsert), bump `deploy_count`, and delete
  KV cache keys with prefix `labs:site:{site}:`. Respond
  `{ url: "/s/{site}/" }`.

**Verify**: vitest tests: (a) token round-trip (mint → hash matches), (b) a
deploy with a path-traversal entry (`../evil.html`) → 400, (c) name conflict
by a different owner → 403. All pass.

#### Step 5: Serving route

`app/s/[site]/[[...path]]/route.ts` (`GET`): map the URL to
`labs-sites/{site}/{path}`; empty/`/`-terminated path → `index.html`; on
storage 404 of an extensionless path, retry with `.html`, then fall back to
the site's `404.html`, then a platform 404 page. Set `Content-Type` from the
extension (use a small in-repo map; no dependency), `Cache-Control:
private, max-age=60`, and an `ETag` from the storage object metadata. Cache
file bytes ≤512 KB in KV under `labs:site:{site}:{path}` (TTL 300 s,
in-memory fallback locally — copy the `getKV()` lazy pattern from
bond-discovery `lib/cache.ts:30-45`); larger files stream through uncached.
Add `app/page.tsx` (platform home: what Labs is, "deploy your first site"
snippet, link to `/explore` and `/docs`).

**Verify**: e2e (Playwright, authenticated via a test session): deploy a
fixture folder (tiny `index.html` + `style.css` + `app.js`) through
`/api/deploy`, then `GET /s/test-site/` → 200 containing the fixture marker
text; `GET /s/test-site/style.css` → `Content-Type: text/css`;
`GET /s/test-site/missing` → the 404 fallback.

#### Step 6: The `labs` CLI

`cli/` workspace in the repo, published later as `@bondsports/labs`
(operator decides registry; until then `npx ./cli` works). Node ≥18, no
heavy deps (`tar` + built-ins). Commands:

- `labs login` — opens `{LABS_URL}/token`, prompts paste, writes
  `~/.config/bond-labs/token` (chmod 600).
- `labs init [name]` — scaffolds `index.html` (on-brand starter using
  `/bond.css` + `/labs.js`, see Phases C/E), `labs.json`
  (`{ "name": "<name>" }`), and a **site-level CLAUDE.md** (see Step 16) so
  an agent in that folder knows the whole platform API.
- `labs deploy` — tars the cwd (respect `.labsignore`), POSTs to
  `/api/deploy`, prints the live URL.
- `labs open` — opens the site URL.

Default `LABS_URL` baked in (`https://labs.bondsports.co`), overridable via
env for local dev.

**Verify**: vitest for the tar/ignore logic; manual e2e against `npm run dev`:
`cd /tmp && npx <repo>/cli init demo && npx <repo>/cli deploy` → prints
`http://localhost:3000/s/demo/` and the page renders.

#### Step 7: `/explore` gallery

`app/explore/page.tsx`: grid of all `labs_sites` (name, title, owner, last
updated, deploy count), newest first, search-by-name input. Every site is
public-to-employees by design — this page is what makes Labs a "learning
workshop" (Shopify's term) instead of 50k invisible URLs.

**Verify**: Playwright: after the Step 5 fixture deploy, `/explore` lists
`test-site` and clicking it lands on `/s/test-site/`.

### Phase C — `labs.js`: the zero-config API kit

#### Step 8: Kit skeleton

`public/labs/v1.js` (ES module AND classic-script friendly: attach to
`window.labs` and `export default`), no build step, following the
self-hosted versioned-kit precedent of bond-discovery
`public/bond-host/v1.js:1-6`. Next rewrite `/labs.js` → `/labs/v1.js`.
The kit: detects its site name from `location.pathname` (`/s/{site}/...`),
exposes `labs.site`, and wraps `fetch` with `credentials: 'same-origin'`
and an `X-Labs-Site: {site}` header. Namespaces (filled in Steps 9–12 and
17): `labs.me()`, `labs.db`, `labs.fs`, `labs.ai`, `labs.realtime`,
`labs.data`, `labs.ui`.

`labs.me()` → GET `/api/me` (works immediately; Step 2 built the backend).

**Verify**: vitest with jsdom: kit loaded at a fake
`/s/foo/index.html` location reports `labs.site === 'foo'` and `labs.me()`
hits `/api/me` with the header set (mock fetch).

#### Step 9: `labs.db` — firebase-style document store

API routes under `app/api/db/[collection]/`:

- `GET    /api/db/:collection` → list (query params: `limit` ≤200 default 50, `order=created_at|updated_at`, `after` cursor)
- `POST   /api/db/:collection` → create (body = arbitrary JSON ≤64 KB; server stamps `created_by` from session email)
- `GET    /api/db/:collection/:id`
- `PATCH  /api/db/:collection/:id` → shallow-merge into `data`
- `DELETE /api/db/:collection/:id`

All scoped `where site = X-Labs-Site header` (reject if header missing or
site not in `labs_sites`). Per-site cap: 50 MB total jsonb (cheap check: a
KV counter incremented by payload size, hard-verified daily by cron later).
Kit sugar mirroring the thread's example
(`const posts = labs.db.collection('posts'); await posts.create({...});
await posts.list(); posts.doc(id).update({...}) / .delete()`).

**Verify**: vitest integration tests: create→list→get→patch→delete round-trip;
**cross-site isolation test** (doc created with `X-Labs-Site: a` is not
returned for `X-Labs-Site: b`) — this is the most important test in Phase C;
oversize body → 413.

#### Step 10: `labs.fs` — file uploads

`POST /api/fs/upload` (multipart, ≤10 MB/file): stores at
`labs-files/{site}/{uuid}-{sanitized-filename}`, returns
`{ url: '/api/fs/o/{site}/{key}' }`; `GET /api/fs/o/{site}/{key}` streams it
back (session-auth like everything else — files are employee-visible, not
public). Kit: `await labs.fs.upload(fileInput.files[0])`.

**Verify**: vitest: upload→fetch round-trip; a 11 MB buffer → 413; filename
`../x` is sanitized (no traversal in the storage key).

#### Step 11: `labs.ai` — LLM proxy

`POST /api/ai/chat`: body `{ messages: [{role, content}], system?, model?,
max_tokens? }`. Server holds `ANTHROPIC_API_KEY`; never exposed. Allowed
models: `claude-haiku-4-5-20251001` (default) and `claude-fable-5`
(opt-in); reject others. `max_tokens` capped at 4096. Rate limit per user
email via KV counter: 50 requests/hour, 429 + `Retry-After` beyond. Log
`{email, site, model, input_tokens, output_tokens}` to a `labs_ai_usage`
table (add to the migration) for the usage dashboard (Step 17). Kit:
`await labs.ai.chat({ messages: [...] })` returning the text plus the raw
response. (Image generation: deferred; note in docs.)

**Verify**: vitest with mocked Anthropic fetch: happy path; disallowed model
→ 400; 51st call within the window → 429. `npm run check:env` lists
`ANTHROPIC_API_KEY` as optional-but-recommended.

#### Step 12: `labs.realtime` — multiplayer

Vercel cannot terminate websockets, so use Supabase Realtime from the
browser: `GET /api/realtime/config` returns the Supabase URL + anon key
(session-gated, so the keypair never appears in static HTML). Kit:
`labs.realtime.channel('room')` lazy-loads `@supabase/supabase-js` from
esm.sh, opens channel `labs:{site}:{room}`, and exposes
`{ broadcast(event, payload), on(event, cb), presence() }` over Supabase
broadcast + presence. Document the limit (broadcast/presence only — no
server-side state; `labs.db` + Realtime's postgres_changes on
`labs_documents` is the deferred upgrade path).

**Verify**: vitest: channel name is always prefixed `labs:{site}:`
(cross-site rooms can't collide silently); config route 401s without a
session. Manual: two browser tabs on a demo site exchange broadcast messages.

### Phase D — real data: Snowflake read-only (`labs.data`)

#### Step 13: Snowflake query proxy with hard guardrails

Operator prerequisites 6–7 must be satisfied first. Add `snowflake-sdk` and
`node-sql-parser`. `lib/snowflake.ts`: connection pool using
`SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD` (or key-pair),
`SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_ROLE=LABS_RO`, session params
`STATEMENT_TIMEOUT_IN_SECONDS=60`, `ROWS_PER_RESULTSET=10000`.

`POST /api/data/query`: body `{ sql }`. Defense in depth, all four layers:
1. `node-sql-parser` must parse the statement as exactly one `SELECT`
   (reject multi-statement, DML/DDL, `CALL`, anonymous blocks);
2. the `LABS_RO` Snowflake role is itself SELECT-only (the real boundary —
   layer 1 is UX, not security);
3. server-side `LIMIT 10000` wrap when the query has no limit;
4. per-user rate limit (KV, 30 queries/hour) + audit log to a
   `labs_data_queries` table `{email, site, sql, rows, ms, error}`.

Also `GET /api/data/tables` → `SHOW TERSE TABLES` in the granted schemas, so
sites (and agents) can discover what's queryable. Kit:
`await labs.data.query('select ... ')` → `{ columns, rows }`;
`await labs.data.tables()`.

**Verify**: vitest (parser layer, no Snowflake needed): `SELECT 1` passes;
`DROP TABLE x`, `SELECT 1; DELETE FROM y`, `CALL p()`, `COPY INTO ...` all →
400. Integration (skipped unless `SNOWFLAKE_ACCOUNT` set): a real SELECT
returns rows; a DML attempt is refused by Snowflake itself (assert the error
surfaces as 403, proving layer 2 works without layer 1). Audit row written
per query.

> Production OLTP read-replica access is **explicitly deferred** — revisit
> only with DBA + security sign-off, as a separate plan. Snowflake is the
> sanctioned path to production data.

### Phase E — the Bond design system, one line

#### Step 14: `/bond.css` + `labs.ui`

`public/bond/v1.css` (rewrites: `/bond.css` → it), no build step:

- `:root` custom properties seeded from `tailwind.config.js:34-61`:
  `--bond-brand:#0d4774; --bond-brand-light:#e8eef4; --bond-accent:#f7b500;
  --bond-accent-muted:#fef6e0; --bond-bg:#f7f7f5; --bond-text:#2c2c2a;
  --bond-border:#e0dfd8; --bond-green:#22c55e; --bond-muted:#888888;` plus
  the note/optional/badge colors from the same block.
- Base layer: sensible typography (system font stack until the operator
  supplies brand fonts), `body` on `--bond-bg`/`--bond-text`.
- Component classes (small, ~300 lines max): `.bond-btn` (+`-primary`,
  `-accent`, `-ghost`), `.bond-card`, `.bond-input`, `.bond-select`,
  `.bond-table`, `.bond-badge`, `.bond-nav` (top bar with site title),
  `.bond-note` (uses note-bg/border/text). Document each with an example in
  `/docs`.
- Kit hook: `labs.ui.load()` injects the `<link>` for pages that didn't add
  it; `labs init`'s starter HTML includes
  `<link rel="stylesheet" href="/bond.css">` so the default is on-brand.

Build a kitchen-sink demo at `app/docs/design/page.tsx` (or as a Labs site
fixture) showing every class.

**Verify**: Playwright screenshot test of the kitchen-sink page (commit the
baseline); `labs init` starter renders with the brand blue header (assert
computed style of `.bond-nav` background = `rgb(13, 71, 116)`).

### Phase F — agents, docs, and ops

#### Step 15: Docs as a Labs site

Write `/docs` (in-app route or — better dogfooding — a Labs site deployed
from `examples/docs/`): what Labs is, the 5-minute quickstart
(`labs init` → `labs deploy`), full API reference for `labs.js` (every
namespace, request/response shapes, limits and rate limits), the trust model
paragraph, and the data-access policy (Snowflake RO; what is auditable).

**Verify**: Playwright: `/docs` (or `/s/docs/`) renders and contains every
namespace name (`labs.db`, `labs.fs`, `labs.ai`, `labs.realtime`,
`labs.data`, `labs.me`, `labs.ui`).

#### Step 16: AI-agent DX — CLAUDE.md template + Claude Code skill

The thread's core insight: agents write the sites, so the platform must be
legible to agents.

- `cli/templates/CLAUDE.md` (written by `labs init` into every new site):
  a compact (~150 lines) spec of the whole surface — the one-line includes
  (`/labs.js`, `/bond.css`), every `labs.*` API with a copy-paste example,
  the limits (body sizes, rate limits, SELECT-only, row caps), the site-name
  rules, and `labs deploy` usage. Self-contained: an agent in a fresh folder
  with only this file must be able to build a working data-backed site.
- A Claude Code skill `bond-labs` (directory `skills/bond-labs/SKILL.md` in
  the repo; operator installs it org-wide later): triggers on "build an
  internal tool/dashboard/site", walks the agent through init → build against
  `labs.*` → deploy, and tells it to read the site CLAUDE.md.
- An `examples/` directory with two complete sites: `team-dashboard`
  (labs.data + bond.css table/cards) and `vote` (labs.db + labs.realtime +
  labs.me).

**Verify**: the acceptance test for the whole platform — in a clean temp dir,
run `labs init agent-test`, then have a fresh Claude session (no other
context) build "a page that lists Snowflake tables and lets me run a query"
using only the scaffolded CLAUDE.md; `labs deploy`; the page works. Record
pass/fail + friction notes in the PR description.

#### Step 17: Ops floor — usage, limits, lifecycle

- `app/admin/usage/page.tsx` (allowlist via `ADMIN_ALLOWED_EMAILS`, same
  convention as bond-discovery): totals per site/user for deploys, db rows,
  ai tokens (`labs_ai_usage`), data queries (`labs_data_queries`).
- Site deletion: `DELETE /api/sites/:name` (owner or admin) → removes storage
  prefix, documents, registry row. CLI: `labs delete`.
- Vercel cron (daily): recompute per-site storage/db usage into
  `labs_sites`, flag sites >50 MB db or >250 MB files; auth via
  `CRON_SECRET` **fail-closed** (bond-discovery learned this in plan 002 —
  copy the fail-closed check, not the legacy skip-when-unset behavior).
- Rate-limit summary documented in `/docs` (ai 50/h, data 30/h, deploy
  60/day/user).

**Verify**: vitest: cron route without `CRON_SECRET` env → 503/401 (never
runs open); delete removes both storage objects and rows (integration test).
`npm run test:all` → green.

## Test plan

- **Unit/integration (vitest)** — mirror bond-discovery's vitest setup; key
  cases called out per step above. The non-negotiables: middleware 401s
  (Step 2), tar path-traversal rejection (Step 4), **cross-site db isolation**
  (Step 9), SELECT-only parser rejections + Snowflake-role 403 surfacing
  (Step 13), fail-closed cron (Step 17).
- **E2E (playwright)** — one journey test: login → deploy fixture → site
  serves → appears in /explore → labs.db round-trip from the page → delete.
  Model the config on bond-discovery's `playwright.config.ts`.
- **Agent acceptance** — Step 16's clean-room agent build is the product bar.

## Done criteria

ALL must hold (in the new repo unless noted):

- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run test:e2e` all exit 0
- [ ] `npm run check:env` exists and exits 1 when `NEXTAUTH_SECRET` is unset
- [ ] `curl -s -o /dev/null -w '%{http_code}' $URL/s/anything/` without a session → 401/302 (the SSO wall holds)
- [ ] `labs init x && labs deploy` from a clean dir yields a working URL in <60 s (manual timing, note it)
- [ ] Cross-site isolation test for `labs.db` exists and passes
- [ ] SELECT-only test matrix (≥4 rejected statement shapes) exists and passes
- [ ] `index.html` from `labs init` contains both `/labs.js` and `/bond.css`
- [ ] `cli/templates/CLAUDE.md` exists and documents all 7 namespaces
- [ ] bond-discovery `plans/README.md` status row for 011 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The operator cannot provision a dedicated Supabase project (do NOT fall
  back to the bond-discovery project — its service key would then be one
  RLS mistake away from partner data).
- The operator confirms production data is **not** in Snowflake (Phase D
  STOP: ship A–C, E–F; write up the gap instead of improvising prod-DB
  access).
- Anyone asks you to point `labs.data` at the production OLTP database —
  out of scope, deferred, needs DBA + security sign-off.
- Supabase Storage latency makes p50 page serve >800 ms even with the KV
  cache (Step 5) — report with numbers; the fallback (Vercel Blob or
  bundling sites into KV) is an architecture change the operator must call.
- `node-sql-parser` cannot parse legitimate Snowflake SQL the data team
  considers table-stakes (e.g. `QUALIFY`) — report; do not weaken the
  parser gate to "regex for ^SELECT".
- The Google OAuth client can't be created for the new domain.

## Maintenance notes

- **The kit and CSS are versioned contracts** (`/labs/v1.js`, `/bond/v1.css`)
  — once ~20 sites exist, breaking changes require a `v2`, exactly like
  bond-discovery's host kit discipline.
- **Resist feature growth** — Shopify's #1 lesson: keep the API surface
  small and fixed; "show how existing capabilities achieve it" before adding
  endpoints. Encode this in the repo CLAUDE.md.
- **Watch in review**: any new route must sit behind the middleware (the
  matcher's exclusion list is the security boundary — keep it tiny);
  the `X-Labs-Site` scoping must never become trust-bearing for
  `labs.data` (it's per-user, not per-site, on purpose).
- **Deferred follow-ups** (each its own future plan): wildcard subdomains
  (`{site}.labs.bondsports.co` + cookie domain work), prod read-replica
  with DBA sign-off, Slack-handle/team enrichment of `/api/me`, image
  generation in `labs.ai`, `postgres_changes`-backed live `labs.db`
  subscriptions, org-wide skill distribution, an internal game jam to seed
  adoption (Shopify's got 140 submissions — it's the best launch event).
