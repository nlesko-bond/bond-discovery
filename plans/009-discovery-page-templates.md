# Plan 009: Kickass discovery templates — visual upgrade of the host-kit portal pages, mobile-first

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- components/host-shell components/DiscoveryPage.tsx "app/portal/[slug]" lib/host-shell`
> On mismatch with the "Current state" description, treat as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH if shipped carelessly (this is the live, customer-facing surface) — mitigated by the iframe-contract invariants below, staging verification, and per-page rollout via a template flag
- **Depends on**: plans/005-staging-environment.md (verify here before prod), plans/007-remove-embed-kit.md (so the visual work happens once, not twice)
- **Category**: direction / product
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

The host kit is the product: facility customers do a one-off script-tag setup and Bond renders Page 1 (program discovery filtered by activity) and Page 2 (registration via dynamically loaded linkSEO) inside their site. For customers to adopt it over hand-built pages, the rendered templates must look *better* than what they'd build themselves — polished, on-brand, and flawless on mobile, where most registrations happen. Today's portal rendering (session cards, filter bar, segments panel) is functional but utilitarian. This plan upgrades the visual layer **without touching the data pipeline or the iframe sizing contract** — the two things that keep live pages working.

## Current state

- Rendering entry points: `app/portal/[slug]/page.tsx` chooses between `HostPortalDiscoveryPage` (sessions-first layouts) and `DiscoveryPage` (standard) based on layout flags in the page config (`isSessionsFirstPortalLayout()` / `isSessionsListPortalLayout()` from `lib/host-shell/portal-config.ts` or similar — locate via grep). `app/[slug]/page.tsx` renders `DiscoveryPage` for the public/SEO route.
- Key components: `components/host-shell/HostPortalDiscoveryPage.tsx`, `HostPortalSessionCard.tsx`, `HostPortalFilterBar.tsx`, `HostPortalSessionList.tsx`, `HostPortalSessionSegmentsPanel.tsx`, `components/host-shell/list/HostPortalSessionListRow.tsx`; data mapping in `lib/host-shell/session-card-model.ts` (program → card model, including registration URLs via `buildRegistrationUrl()` from `lib/utils.ts:328-360`).
- Theming: per-page branding from config (`branding.primaryColor/secondaryColor/accentColor/logo/fontFamily`), applied via portal theme utilities (`lib/host-shell/portal-accent-theme.ts`, `portal-color-utils.ts`, `portal-card-accent.ts`). Tailwind 3.4.
- Design references that already exist in-repo — READ FIRST: `docs/portal-session-first-design-spec.md` and `docs/portal-phase-2-agent-prompt.md` (prior design intent; build on it, don't contradict it without saying so).

### Iframe-contract invariants (MUST NOT BREAK — live pages depend on these)

1. **Resize protocol**: the portal page reports its content height to the parent kit via postMessage (`bond:resize` / legacy `discovery-resize`), wired through `components/host-shell/useHostPortalEmbedResize.ts` and `lib/host-shell/embed-resize.ts`. Any layout change that alters document height behavior (lazy images, animations that change height, sticky elements) must still produce correct height reports. The kit floors height at 480px (`public/bond-host/v1.js:10,63-68`).
2. **No fixed-viewport assumptions**: the page renders inside an iframe whose height equals its content. `100vh`/`100dvh`, `position: fixed`, and own-scrollbar patterns are forbidden in portal components — a fixed footer inside the iframe would detach from the visual viewport. (The Bond *checkout* page's fixed footer is exactly why the kit sizes the checkout iframe with `calc(100dvh - offset)` — `v1.js:70-79`; discovery must stay content-sized.)
3. **Register-click analytics**: register links carry `data-bond-*` attributes (`lib/host-shell/registration-analytics.ts:27-44`) and clicks flow through `trackHostShellRegisterClick` / the `HostShellPortalBridge` — preserve the attributes and handlers on any redesigned card/button.
4. **Data props are fixed**: templates consume the existing card model from `lib/host-shell/session-card-model.ts`; no new API calls, no changes to `/api/events` or `/api/programs`.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm run test:run`   | all pass            |
| Build     | `npm run build`      | exit 0              |
| Dev       | `npm run dev` → `http://localhost:3000/portal/<slug>` | renders |
| E2E       | `npm run test:e2e`   | passes (Playwright is configured — check `playwright.config.*` for existing specs first) |

## Suggested executor toolkit

- Skill `vercel-react-best-practices` — apply when restructuring components (memoization, server/client component boundaries).
- A browser tool (Playwright headed / preview tool) for visual verification at 375px, 768px, 1280px widths.

## Scope

**In scope**:
- All visual/layout code in `components/host-shell/**` and `components/DiscoveryPage.tsx` and their styles
- A new `features.portalTemplate` value (additive) if a template variant is introduced
- `lib/host-shell/portal-*` theming utilities (extend, don't break existing pages' rendering)
- Playwright specs under the e2e dir

**Out of scope**:
- `public/bond-host/v1.js` (the kit), `useHostPortalEmbedResize.ts`'s protocol, all `app/api/**`, `lib/cache*`, `lib/session-card-model.ts` data shapes (visual-only fields may be added, existing fields unchanged)
- The Bond checkout page (different repo)

## Git workflow

- Branch: `advisor/009-portal-templates`
- Small commits per component; `feat(portal): ...`

## Steps

### Step 1: Design spike (deliverable: a one-page direction doc)

Read the two design docs, render the current portal for 2–3 real slugs (`GET /api/pages` lists them) at mobile/tablet/desktop, screenshot, and write `plans/009-design-direction.md`: what stays, what changes, for each of — card anatomy (image/sport icon, title, schedule, age/gender chips, price, availability state, CTA), filter bar (mobile: horizontal scroll chips or bottom-sheet — pick one and justify), empty/loading/error states, typography scale, spacing system, dark-on-light contrast (WCAG AA), and how `branding.primaryColor` flows through accents. Keep it to one page; this is direction, not a redesign doc.

**Verify**: the doc exists and names every component file it will touch.

### Step 2: Foundations — tokens and theme plumbing

Consolidate spacing/typography/radius into Tailwind theme extensions or CSS variables set from page branding (extend `portal-accent-theme.ts`). No visual change yet beyond normalization.

**Verify**: `npm run build` → 0; visual diff at the three widths shows no layout breakage on existing slugs.

### Step 3: Card + list redesign (the core)

Rebuild `HostPortalSessionCard` and `HostPortalSessionListRow` per the direction doc. Mobile-first: single column ≤640px, comfortable tap targets (≥44px CTA), price/availability scannable, CTA full-width on mobile. Preserve invariant 3 (data attributes + click handler) verbatim — copy the existing register-link JSX attributes.

**Verify**: `npm run test:run` → pass (session-card-model tests untouched); manual: register click on a card still pushes a `click_register` dataLayer event (devtools: `window.dataLayer`).

### Step 4: Filter bar + page scaffolding

Redesign `HostPortalFilterBar` per the direction doc; activity filter is the primary affordance (the product's Page-1 promise: "all programs across facilities filtered by activity"). Sticky elements: only `position: sticky` within normal flow if used at all — test that height reporting stays correct when filters collapse/expand (resize fires on content change; confirm `useHostPortalEmbedResize` observes mutations — if it only listens to `window.resize`, ADD a `ResizeObserver` on the document body inside the portal page, which is an allowed change to the hook's *internals*, not its message protocol).

**Verify**: in dev, toggle filters and confirm the iframe-height postMessage fires with the new height (log messages in a test harness page that embeds the portal in an iframe — create `scripts/dev-embed-harness.html` with the kit script tag pointing at localhost, and keep it for future manual testing).

### Step 5: States — empty, loading, error

Design and implement: no-programs-match-filter (friendly, with clear-filters action), zero-events (the page must render sensibly when the cache serves an empty-but-valid payload), and skeleton loading consistent with the card grid.

**Verify**: force each state (filter to nothing; mock empty payload) and screenshot.

### Step 6: E2E + rollout

- Playwright spec: load `/portal/<seed-slug>` at 375px and 1280px; assert cards render, activity filter narrows results, register link has `data-bond-program-id`, no horizontal overflow (`document.documentElement.scrollWidth <= viewport width`).
- Rollout: verify on staging (plan 005) with 2+ real configs; then production. If the redesign is gated behind a `features.portalTemplate` variant, enable per-page starting with a friendly customer; if it replaces the default, get operator sign-off on staging screenshots first.

**Verify**: `npm run test:e2e` → pass; staging screenshots attached to PR.

## Test plan

- Playwright specs from Step 6 (≥4 assertions listed there).
- Existing unit tests stay green throughout — they pin the data layer.
- Manual matrix recorded in the PR: iPhone-width, iPad-width, desktop × discovery page, filtered state, register click → checkout iframe swap (via the dev embed harness).

## Done criteria

- [ ] `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run test:e2e` all exit 0
- [ ] No `100vh|100dvh|position: fixed` introduced in portal components (`grep -rn "100dvh\|100vh\|fixed" components/host-shell --include="*.tsx" | grep -v sticky` reviewed — any hit justified in the PR)
- [ ] Register links retain `data-bond-program-id` attributes (e2e asserts it)
- [ ] Height reporting verified on filter expand/collapse via the embed harness
- [ ] Staging screenshots (3 widths × 2 slugs) attached; operator approved before prod
- [ ] `plans/README.md` status row updated

## STOP conditions

- `useHostPortalEmbedResize` turns out to drive height from something other than postMessage (e.g. URL params) — the contract description has drifted; re-read `lib/host-shell/embed-resize.ts` and report.
- Any change requires modifying the postMessage protocol or `public/bond-host/v1.js` — that's a kit version bump, out of scope.
- The design direction (Step 1) reveals the session-card model lacks data the design needs (e.g. images) — adding model fields touches the data pipeline; report with the specific fields instead of extending `/api` responses.

## Maintenance notes

- The dev embed harness (`scripts/dev-embed-harness.html`) is the canonical way to test "as the partner sees it" — keep it working.
- Future template variants should be config-driven (`features.portalTemplate`) rather than forked components.
- Reviewer should scrutinize: mobile overflow, height-report correctness, and that no card lost its analytics attributes.
