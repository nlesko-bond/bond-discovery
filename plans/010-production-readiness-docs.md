# Plan 010: Production-readiness sweep + documentation consolidation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- docs/ README.md CLAUDE.md`
> This plan runs LAST — drift from plans 001–009 is expected and good; the
> docs must describe the post-plan state. Verify each claim against live code
> as you write.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (docs + non-behavioral cleanups)
- **Depends on**: plans 001–009 (run last; document what actually shipped)
- **Category**: docs / dx
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

After plans 001–009 land, the product is: a host kit (one script tag) rendering discovery + registration on partner sites, a URL generator, an admin editor, and a cron-warmed caching pipeline — secured, staged, tested, minimal-analytics, embed-kit-free. What's missing is the connective tissue that makes it operable by people other than its author: accurate docs, a runbook for "the page looks stale/broken," an agent-facing CLAUDE.md, and removal of leftover noise. Docs that are wrong are worse than absent — several current docs describe the embed kit and pre-restructure admin.

## Current state

- `docs/` contains (among others): `README.md` (index), `partner-host-integration.md`, `customer-setup-discovery-checkout-analytics.md`, `analytics-discovery-and-host-shell.md`, `portal-session-first-design-spec.md`, `portal-phase-2-agent-prompt.md`, `documentation/` (dir), `proposals/`. Plus out-of-product-scope docs (onboarding etc.) — leave those alone.
- No `CLAUDE.md` at repo root (verify: `ls CLAUDE.md`). Plans are executed by agents; this is high-leverage.
- Repo `README.md` — verify whether setup instructions still work post-plan-005 (env vars changed).
- Known doc gaps (from this audit): no caching-architecture doc, no cache-invalidation runbook, no documented freshness SLA, `CRON_SECRET`/env setup undocumented (plan 005 adds `docs/environments.md` — link it, don't duplicate).
- Console noise: `grep -rn "console.log" app lib --include="*.ts" --include="*.tsx" | grep -v test | wc -l` — sweep for leftover debug logs on hot paths (the `[PATCH]` ones go in plan 001; find the rest).

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm run test:run`   | all pass            |
| Lint      | `npm run lint`       | exit 0              |
| Build     | `npm run build`      | exit 0              |
| Link check| `grep -rn "](.*\.md)" docs/README.md` then verify each target exists | no dead links |

## Scope

**In scope**:
- `README.md`, `CLAUDE.md` (create), `docs/README.md`, `docs/architecture-discovery.md` (create), `docs/runbook-discovery.md` (create), `docs/partner-host-integration.md`, `docs/customer-setup-discovery-checkout-analytics.md`, `docs/analytics-discovery-and-host-shell.md`
- Debug-log cleanup in `app/` + `lib/` discovery paths (log-line deletions only — no logic changes)
- Archival moves: stale docs to `docs/archive/`

**Out of scope**:
- Onboarding/forms/memberships docs and code.
- Any behavioral change. If you find a bug while documenting, file it in `plans/README.md` under "Findings considered", don't fix it here.

## Git workflow

- Branch: `advisor/010-docs-production-readiness`
- Commits: `docs(...)` / `chore(logs): ...`

## Steps

### Step 1: CLAUDE.md (agent onboarding)

Create repo-root `CLAUDE.md` (~60 lines max):
- What this app is (host kit + discovery pages + admin + caching pipeline), in 4 sentences.
- Commands: dev / build / typecheck / test:run / test:e2e / lint / check:env.
- Map of load-bearing paths: `public/bond-host/v1.js` (the kit — live on partner sites; ES5, no build step), `app/portal/[slug]` + `components/host-shell/` (rendering), `app/api/events` + `lib/cache.ts` + `app/api/cron/warm-discovery` (data pipeline), `app/admin/pages/[slug]` (editor), `lib/config.ts` + Supabase `discovery_pages` (configs).
- The three invariants any agent must respect: (1) discovery pages are live — never break the iframe resize contract or the public API shapes; (2) `discovery:response:{slug}` is written only by the warm pipeline (never write-through from request fallbacks); (3) analytics events are a documented partner contract — don't add/rename without updating `docs/customer-setup-discovery-checkout-analytics.md`.
- Pointer to `docs/README.md` and `docs/environments.md`.

**Verify**: file exists; every command in it runs.

### Step 2: Architecture doc

Create `docs/architecture-discovery.md` describing the post-plans system: request flow (partner page → kit → bootstrap → portal iframe → events/programs APIs), the three-layer cache (KV → memory → Bond) with key formats and TTLs (from `lib/cache.ts:171-223` — quote the actual key formats), the cron warm with scope-grouping and the empty-write guard, availability SWR overlay, and the GTM event flow (discovery events from the iframe + `BOND_GTM_EVENT` forwarding from checkout). One ASCII diagram. Every TTL/key cited from code with `file:line`.

**Verify**: each `file:line` citation checked against live code.

### Step 3: Runbook

Create `docs/runbook-discovery.md` with symptom-driven entries:
- "Page shows stale programs/events" → check `X-Bond-Events-Cache` header; check `discovery:cron:lastRun`; force-refresh via `curl '<origin>/api/events?slug=X&forceFresh=true'`; invalidate via admin save or `invalidateDiscoveryResponseCache`; when the cron next runs.
- "Page shows zero events" → empty-write guard semantics, `discovery-zero-events-alert`, Bond API status.
- "Partner says conversions missing in GA4" → checklist: GTM installed on partner page? kit version serves `BOND_GTM_EVENT` forwarding? GTM Preview shows the push? cross-domain settings in partner GA4.
- "Cron failing" → 401 (CRON_SECRET), Bond rate limits (`bondApi` stats in response), Vercel cron logs.
- "Admin can't log in / locked out" → plan 001's env vars and bypass (dev only).

**Verify**: every command in the runbook is copy-pasteable and was executed once against staging.

### Step 4: Update partner-facing docs + index

- `docs/partner-host-integration.md`: ensure it describes only the host kit (post plan 007), the chrome-offset attributes, fixed-footer/checkout height behavior, and the analytics story (post plans 003/004).
- `docs/customer-setup-discovery-checkout-analytics.md`: final event contract; link Bond help-center articles 11139229 / 12580240 / 12580242.
- `docs/README.md`: re-index; move superseded design docs (`portal-phase-2-agent-prompt.md`, and `portal-session-first-design-spec.md` if plan 009 superseded it) to `docs/archive/` with a one-line tombstone note.

**Verify**: no doc in the index references `embed-kit`, `/api/embed`, or removed admin sections (`grep -rln "embed-kit\|api/embed" docs/ --exclude-dir=archive` → empty).

### Step 5: Log hygiene sweep

List `console.log` calls in `app/` and `lib/` discovery paths (exclude tests/scripts). Keep intentional structured logs (`[warm-discovery]`, error paths); delete leftover debug prints of payloads/configs. Convert kept hot-path logs to `console.error`/`console.warn` only where they signal real problems.

**Verify**: `npm run lint` && `npm run test:run` → pass; diff contains only log-line deletions.

## Test plan

No new tests (docs + log deletions). Full suite green: `npm run test:run`, `npm run build`.

## Done criteria

- [ ] `CLAUDE.md`, `docs/architecture-discovery.md`, `docs/runbook-discovery.md` exist and every command/citation in them verified
- [ ] `grep -rln "embed-kit\|api/embed" docs/ --exclude-dir=archive` → empty
- [ ] `docs/README.md` index has no dead links
- [ ] Debug payload logs removed; `npm run lint` && `npm run build` exit 0
- [ ] `plans/README.md` final status pass: every plan row reflects reality

## STOP conditions

- A doc claim cannot be verified because the relevant plan (001–009) didn't land as written — document reality, and update that plan's status row to reflect the divergence; if reality looks broken, report rather than papering over it.
- You find a live bug while documenting — record it in `plans/README.md`, do not fix it in this branch.

## Maintenance notes

- The runbook and architecture doc rot fastest at TTL values and key formats — when changing `lib/cache.ts`, grep docs for the old value.
- CLAUDE.md is the contract for future agent sessions; keep it under ~80 lines or it stops being read.
