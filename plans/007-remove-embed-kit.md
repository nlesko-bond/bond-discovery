# Plan 007: Remove the embed kit safely (keep host kit + URL generator working)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- public/embed-kit app/embed app/api/embed lib/embed-cors.ts app/api/events/route.ts`
> On mismatch with the "Current state" excerpts, treat as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: HIGH if done carelessly (live partners might still load the embed kit), LOW with the usage-check gate in Step 1
- **Depends on**: plans/005-staging-environment.md (verify on staging first), plans/002 (tests green)
- **Category**: tech-debt / migration
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

The repo ships two embedding systems: the **host kit** (`public/bond-host/v1.js`, 342 lines, iframe-based — the strategic one) and the **embed kit** (`public/embed-kit/v1.js`, 1,683 lines of iframe-free DOM-injection rendering, plus its own bootstrap API, page route, and admin section). The operator has decided: the product is the host kit's two JS pages plus the plain URL generator (`buildRegistrationUrl()` in `lib/utils.ts:328-360`). The embed kit is dead weight — 1,700+ lines of parallel rendering logic that must be kept visually and behaviorally in sync with the React components, doubling the cost of every template change (plan 009). Removing it safely requires first proving no live partner still loads it.

## Current state

Embed-kit surface (confirmed by grep):
- `public/embed-kit/v1.js` — the kit itself (1,683 lines).
- `public/docs/webflow-embed-kit.md` — partner-facing doc.
- `app/embed/[slug]/page.tsx` + `app/embed/[slug]/EmbedDiscoveryPage.tsx` — the `/embed/{slug}` route (noindex).
- `app/api/embed/bootstrap/route.ts` — embed bootstrap API. (Check for siblings: `ls app/api/embed/`.)
- `app/admin/pages/[slug]/sections/PageEditorEmbedSection.tsx` — admin settings section.
- `app/admin/help/page.tsx` — references embed setup.
- Docs referencing it: `docs/partner-host-integration.md`, `docs/portal-session-first-design-spec.md`, `docs/portal-phase-2-agent-prompt.md`, `docs/proposals/program-type-scope-and-per-program-registration-urls.md`.

Shared infrastructure that must SURVIVE (embed-named but used by the host-kit paths):
- `lib/embed-cors.ts` — `embedKitCorsHeaders()` / `isEmbedKitBrowserRequestAllowed()` are used by `app/api/events/route.ts` (lines 13–17, 22–30, 69–90) to validate cross-origin browser calls per page config (`embedAllowedOrigins`). `/api/events` is also called cross-origin in host-kit contexts. **Keep the module; optionally rename later.**
- `lib/availability-cache.ts` — references embed in comments only; keep.
- `lib/host-shell/bootstrap.ts` and `lib/host-shell/embed-chrome.ts` / `embed-resize.ts` — "embed" in the name but part of the host-shell resize machinery; keep.
- `buildRegistrationUrl()` in `lib/utils.ts:328-360` — the URL generator; keep (it has a JS twin inside `public/embed-kit/v1.js:59` which dies with the kit).

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm run test:run`   | all pass            |
| Build     | `npm run build`      | exit 0              |
| Route check | `grep -rn "embed" app/api/ --include="route.ts" -l` | only surviving routes |

## Scope

**In scope** (delete or edit):
- `public/embed-kit/` (delete in Step 3)
- `public/docs/webflow-embed-kit.md` (delete)
- `app/embed/` (delete)
- `app/api/embed/` (replace with deprecation responses in Step 2, delete in Step 4)
- `app/admin/pages/[slug]/sections/PageEditorEmbedSection.tsx` + its wiring in `app/admin/pages/[slug]/page.tsx` and `page-config-types.ts` (coordinate with plan 008 — if plan 008 is in flight, do the section removal here and tell plan 008's executor)
- `app/admin/help/page.tsx` (remove embed instructions)
- Docs listed above (excise embed-kit sections, leave host-kit content)

**Out of scope (must NOT be deleted)**:
- `lib/embed-cors.ts`, `lib/availability-cache.ts`, `lib/host-shell/embed-chrome.ts`, `lib/host-shell/embed-resize.ts`, `lib/host-shell/bootstrap.ts`
- `app/api/events/route.ts`, `app/api/host/bootstrap/route.ts`
- `public/bond-host/v1.js`
- Page-config DB columns / `features.embed*` fields in Supabase — leave the data; only the UI/routes go (dropping columns is irreversible and unnecessary).

## Git workflow

- Branch: `advisor/007-remove-embed-kit`
- One commit per step (usage gate, deprecation, deletion, docs).

## Steps

### Step 1: Usage gate — prove the kit is unused (DO NOT SKIP)

This is the load-bearing safety step. Gather evidence that no live partner loads the embed kit:
1. Check page configs: query Supabase for configs with embed signals — `features.embedAllowedOrigins` non-empty, `features.embedPortalTemplate` set, etc. From the admin API: `curl -s https://<prod>/api/pages | jq '[.pages[] | {slug, embedOrigins: .features.embedAllowedOrigins, tpl: .features.embedPortalTemplate}]'` (operator may need to run this).
2. Check access logs if available (Vercel analytics/logs for `GET /embed-kit/v1.js` and `/api/embed/bootstrap` over ≥7 days). If the executor has no log access, this becomes an **operator checklist item — block on it**.
3. Record the evidence in the PR description.

**Verify**: written evidence exists that requests to `/embed-kit/v1.js` are zero (or the operator has explicitly accepted breaking the identified slugs).

### Step 2: Soft-kill first — deprecation responses

Don't delete routes on day one; make them inert and observable:
- `app/api/embed/bootstrap/route.ts`: replace the handler body with `console.warn('[deprecated] embed bootstrap requested', { slug }); return NextResponse.json({ error: 'The Bond embed kit has been retired. Use the Bond host kit: /bond-host/v1.js' }, { status: 410 })`.
- `public/embed-kit/v1.js`: replace the file content with a small stub that logs `console.warn('Bond embed kit retired — contact Bond support')` and renders a one-line message with a link into the mount element, instead of the full app. (Static files can't log server-side; the 410 on bootstrap is the observable signal.)
- `app/embed/[slug]/page.tsx`: replace with a `redirect()` to `/${params.slug}` (the public discovery page) — graceful for any human who has the URL.

Ship this and let it soak (operator decides duration; recommend ≥2 weeks in production while watching for the deprecation warnings in logs).

**Verify**: `npm run build` → exit 0; `curl -s -o /dev/null -w "%{http_code}" https://<staging>/api/embed/bootstrap?slug=test` → 410.

### Step 3: Delete the embed UI surface

After the soak (or immediately if Step 1 proved zero usage and the operator approves skipping the soak):
- `git rm -r public/embed-kit public/docs/webflow-embed-kit.md app/embed`
- Remove `PageEditorEmbedSection.tsx`; remove its entry from the section nav and the `PageEditorSectionId` union in `app/admin/pages/[slug]/page-config-types.ts`; remove its import/render in `app/admin/pages/[slug]/page.tsx`.
- Remove embed instructions from `app/admin/help/page.tsx`.

**Verify**: `npm run typecheck` && `npm run build` → exit 0; `grep -rn "EmbedDiscoveryPage\|embed-kit/v1" app components lib --include="*.ts*"` → no matches.

### Step 4: Delete the embed API + scrub docs

- `git rm -r app/api/embed`
- Excise embed-kit sections from `docs/partner-host-integration.md` and the other three docs; where a doc is *entirely* about the embed kit, delete it; where mixed, keep host-kit content intact.
- Do NOT touch `lib/embed-cors.ts` — add a comment at its top: `// Named for the retired embed kit but load-bearing: validates cross-origin browser access to /api/events for host-kit and direct integrations.`

**Verify**: `npm run build` → exit 0; `npm run test:run` → all pass; `grep -rln "api/embed/bootstrap" app components lib public docs` → no matches.

## Test plan

- Existing suite must stay green at every step (`npm run test:run`).
- Add one regression test: `__tests__/api/events-cors.test.ts` — `/api/events` still applies `embedKitCorsHeaders` allowlisting after the removal (mock config with `embedAllowedOrigins: ['https://partner.example']`; assert the CORS header on a request from that origin, and 403 for a disallowed browser origin). This pins the "shared infra survives" invariant.

## Done criteria

- [ ] Usage evidence recorded (Step 1) before any deletion
- [ ] `ls public/embed-kit app/embed app/api/embed 2>&1` → all "No such file or directory" (after Step 4)
- [ ] `lib/embed-cors.ts` unchanged except the comment; events CORS test passes
- [ ] `npm run typecheck`, `npm run test:run`, `npm run build` all exit 0
- [ ] Admin UI renders without the Embed section (`npm run dev`, open `/admin/pages/<any>`; no console errors)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1 finds ANY page config or access-log evidence of live embed-kit usage → stop after Step 2 (soft-kill ships, deletion waits); report the slugs found.
- Removing `PageEditorEmbedSection` requires touching more than the three admin files named in Step 3 (the section is more entangled than planned) — report.
- Anything imports from `app/embed/` or `app/api/embed/` outside those directories (`grep -rn "from '@/app/embed\|from '@/app/api/embed" app components lib`) — untangle is out of scope; report.

## Maintenance notes

- `features.embed*` config fields remain in stored configs as dead data; plan 008's settings model and plan 010's docs should mark them deprecated. A later cleanup migration can drop them once no rollback to the embed kit is conceivable.
- If a partner surfaces post-removal wanting inline (no-iframe) embedding, the answer is the host kit + a styling pass, not resurrecting the embed kit — note this in `docs/partner-host-integration.md`.
