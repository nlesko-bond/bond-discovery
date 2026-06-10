# Plan 008: Restructure the admin page-editor settings UI — clean, clear, crisp

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- "app/admin/pages/[slug]"`
> On mismatch with the "Current state" description, treat as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M–L
- **Risk**: LOW for end users (admin-only surface; live discovery pages unaffected), MED for admin workflow (don't lose any setting)
- **Depends on**: plans/001-secure-pages-api.md (don't polish an unauthenticated admin), plans/007-remove-embed-kit.md (the Embed section disappears — coordinate; if 007 already removed it, skip those bits)
- **Category**: dx / tech-debt
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

The page editor is how every customer page is configured — branding, program filters, registration behavior, analytics, caching. It has organically grown to 9 sections of mixed altitude: "Basics" sits next to "Advanced" cache TTLs, host-portal layout options live apart from general branding they override, and an "Embed" section configures a kit being removed. The operator wants a settings UI that's clean, clear, and crisp: an admin should find any setting in one guess, understand what it does without reading code, and never wonder whether a save took effect. This is a restructure of an existing, working editor — reorganize and clarify, do not rebuild from scratch.

## Current state

- `app/admin/pages/[slug]/page.tsx` (~217 lines) — the editor shell: loads the config, holds form state, saves via `PATCH /api/pages/{slug}`, renders `PageEditorSectionNav` + the active section.
- `app/admin/pages/[slug]/components/` — `PageEditorSectionNav.tsx` (sidebar nav), `PortalSessionsBrandingControls.tsx`, `SurfaceBadge.tsx`.
- `app/admin/pages/[slug]/sections/` — nine sections: `Basics`, `Branding`, `Programs`, `Filters`, `Registration`, `Embed`, `HostPortal`, `Analytics`, `Advanced`.
- `app/admin/pages/[slug]/page-config-types.ts` — `IPageConfig` and the `PageEditorSectionId` union.
- `app/admin/pages/[slug]/page-config-utils.ts` — config (de)serialization helpers.
- Styling: Tailwind 3.4 (`tailwind.config`), `lucide-react` icons available. Read 2–3 existing sections before writing anything to absorb the established form-control idioms — match them, don't introduce a component library.
- Read before starting: ALL nine section files plus `page.tsx`, so the inventory in Step 1 is grounded.

## Target information architecture

Reorganize the nine sections into five, ordered by how often admins touch them:

1. **Page** — name, slug, organizations/facilities, API key, active toggle, partner group. (today: Basics)
2. **Appearance** — branding (logo, colors, fonts, company name) AND the host-portal layout/branding overrides, presented as one surface with a "Portal overrides" subsection. (today: Branding + HostPortal + the portal controls component)
3. **Programs & Filters** — program include/exclude, filter configuration, table columns, default view. (today: Programs + Filters)
4. **Registration & Analytics** — registration URL behavior, deep-link options, GTM ID, with inline explanation of what events fire (per plan 004's contract: `page_view`, `click_register`, `click_redeem_pass`, plus forwarded Bond checkout events). (today: Registration + Analytics)
5. **Data & Caching** — refresh policy, availability TTL, event horizon, bondEnv, discoveryCacheEnabled — each with a one-line plain-English description and the default marked. Surface the `discovery:cron:lastRun` record from plan 002 here as a read-only "Last warmed: X minutes ago" indicator (fetch via a tiny new `GET /api/admin/cache-status?slug=` route or inline into the existing page GET — executor's choice, keep it small). (today: Advanced)

The Embed section is removed (plan 007). Settings move; **none are dropped** — Step 1's inventory is the checklist.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm run test:run`   | all pass            |
| Build     | `npm run build`      | exit 0              |
| Manual    | `ADMIN_AUTH_BYPASS=true npm run dev` → open `/admin/pages/<slug>` | editor renders, saves work |

## Scope

**In scope**:
- Everything under `app/admin/pages/[slug]/` (page.tsx, components/, sections/, page-config-types.ts)
- A small cache-status read endpoint if chosen (`app/api/admin/cache-status/route.ts`, guarded by `requireAdmin` from plan 001)

**Out of scope**:
- `lib/config.ts` persistence format and `PATCH /api/pages/[slug]` request shape — the wire format must NOT change (live API; the editor is just a client of it).
- The pages LIST view (`app/admin/pages/page.tsx` if present) — separate surface.
- Any new dependency (no UI libraries).
- Discovery page rendering.

## Git workflow

- Branch: `advisor/008-admin-editor-ia`
- Commits per step; e.g. `refactor(admin): merge branding + portal sections into Appearance`

## Steps

### Step 1: Settings inventory (the no-loss checklist)

Read all nine section files. Produce `plans/008-settings-inventory.md`: a table of every input field — label, config path (e.g. `features.eventHorizonMonths`), current section, target section. Fields belonging to the embed kit are marked `REMOVED (plan 007)`.

**Verify**: the inventory file exists; every config path written by `page.tsx`'s save handler appears in it.

### Step 2: Restructure sections one merge at a time

Order: (a) Programs+Filters → `PageEditorProgramsSection`; (b) Branding+HostPortal → `PageEditorAppearanceSection`; (c) Registration+Analytics → `PageEditorRegistrationSection`; (d) Advanced → `PageEditorDataSection` with the plain-English descriptions; (e) update `PageEditorSectionId` union + `PageEditorSectionNav` (5 entries, lucide icons). After EACH merge: typecheck, run dev, load the editor, change one field from the merged section, save, reload, confirm persistence.

Crispness rules to apply throughout: every control gets a label + one-line help text; defaults shown (`placeholder` or "Default: 15min"); group related controls with subheadings instead of more sections; destructive/dangerous settings (bondEnv, discoveryCacheEnabled) get an amber warning note that they affect the live page.

**Verify** (after each merge): `npm run typecheck` → 0; manual save round-trip works.

### Step 3: Save-state clarity

In `page.tsx`: ensure the save flow shows the three states distinctly — dirty ("Unsaved changes"), saving, saved (with timestamp). If this already exists, keep it; if saves silently succeed/fail, add it. On save failure, surface the API error message verbatim.

**Verify**: manual — break the network (devtools offline), save, see the error; restore, save, see confirmation.

### Step 4: Cache status indicator

In the Data & Caching section, show `discovery:cron:lastRun` (plan 002) and the page's own `discovery:lastRefreshed` timestamp, plus a "Refresh now" button that calls the warm endpoint for this slug (plan 006's `?slug=` support; if plan 006 hasn't landed, render the timestamps only and leave a TODO).

**Verify**: with KV unconfigured locally the section renders "unknown" gracefully (no crash).

### Step 5: Reconcile the inventory

Walk `plans/008-settings-inventory.md`; tick every field as present in its target section. Delete the old section files; confirm nothing imports them.

**Verify**: `ls app/admin/pages/[slug]/sections/` → 5 files; `grep -rn "PageEditorFiltersSection\|PageEditorHostPortalSection\|PageEditorAnalyticsSection\|PageEditorAdvancedSection\|PageEditorEmbedSection" app/` → no matches; `npm run build` → 0.

## Test plan

The editor has no existing component tests; don't introduce a component-testing harness here. Instead: (1) the inventory reconciliation in Step 5 is the completeness check; (2) add one vitest test for any pure helper you extract into `page-config-utils.ts` during the merge (e.g. section-to-config mapping), modeled on `__tests__/lib/config.test.ts`; (3) the manual save round-trips in Step 2.

## Done criteria

- [ ] 5 sections, every field from the inventory present, none dropped (inventory reconciled)
- [ ] PATCH request body shape unchanged (capture one save in devtools before/after; same config paths)
- [ ] `npm run typecheck`, `npm run test:run`, `npm run build` exit 0
- [ ] No remaining imports of deleted section components
- [ ] `plans/README.md` status row updated

## STOP conditions

- The save handler in `page.tsx` writes config paths that appear in NO section file (hidden/implicit settings) — report them before restructuring.
- The wire format would have to change to merge two sections cleanly — it must not; report instead.
- Plan 007 hasn't run and removing the Embed section here would conflict with its in-flight branch — coordinate via the index.

## Maintenance notes

- New settings must be added to the section whose question they answer ("what does the page show" → Appearance/Programs; "how fresh is data" → Data & Caching) — resist re-growing an "Advanced" junk drawer.
- Reviewer should diff the inventory table against the PR, not the pixels.
- Deferred: component tests for the editor (worth doing once Playwright e2e covers admin login post-plan-001).
