# Agent prompt — Portal Phase 2 (session-first UI)

Copy everything below the line into a **new Cursor agent** chat in `bond-discovery`.

---

## Task

Implement **Portal Phase 2: session-first discovery layout** for the partner host shell (`/portal/{slug}`). Phase 1 (bond-host, checkout new tab, portal bridge) is done. Read the spec first and do not break legacy discovery.

## Required reading (in order)

1. `docs/portal-session-first-design-spec.md` — scope, do-not-touch list, build order
2. `docs/partner-host-integration.md` — host shell behavior
3. `docs/analytics-discovery-and-host-shell.md` — events; portal register tracking fixed in `HostShellPortalBridge` + `lib/host-shell/registration-analytics.ts`

## Hard rules

- **Do not modify** `/{slug}`, `/embed/{slug}`, `public/embed-kit/v1.js`, or shared discovery components (`DiscoveryPage`, `ProgramCard`, `ScheduleView`, `HorizontalFilterBar`, `FilterBar`, `MobileFilters`) except bugfixes explicitly scoped to portal.
- **All new UI** under `components/host-shell/` (or `components/portal/`).
- Register links must remain real `<a href="/programs/...">` so `HostShellPortalBridge` can intercept.
- Follow repo rules: no `any`, `I` prefix interfaces, `Enum` suffix, no inline comments, no magic numbers (except CSS).
- Do not push to `main` unless the user asks; use a feature branch + PR.

## Product requirements

1. **Admin flag:** `hostPortalLayout: 'legacy_programs' | 'sessions_first'` (default `legacy_programs`).
2. When `sessions_first`, `/portal/[slug]` renders new `HostPortalDiscoveryPage` instead of `DiscoveryPage`.
3. **Session cards** (one per session): name, image, short description, facility, age, gender, date range, registration-type label (weekly segments / drop-ins / session reg — map from API when possible).
4. **Nested** segments and **products** inside card; **Register on product** uses `buildRegistrationUrl(..., { productId })`.
5. **Closed sessions:** show with Closed tag; register disabled (configurable inclusion via existing API/page config).
6. **Schedule tab:** keep second tab; reuse existing schedule/event loading patterns — do not duplicate fetch logic unnecessarily.
7. **Portal-only filters:** new compact `HostPortalFilterBar` — do not import `HorizontalFilterBar`.
8. **Grouping:** start ungrouped; optional facility grouping behind flag if easy.

## Suggested implementation order

1. Types + admin UI for `hostPortalLayout`
2. `HostPortalDiscoveryPage` shell + data wiring (reuse program/session APIs used by `DiscoveryPage`)
3. `HostPortalSessionCard` + product register links
4. Schedule tab wrapper
5. `HostPortalFilterBar` v1
6. Tests for card model, register URLs, closed state

## Verify

- `/{slug}` and embed unchanged
- Portal legacy layout still works when flag unset
- Register → org tab with `bondPath`; `click_register` in GTM Preview inside portal iframe
- `npm test` / relevant vitest for new files

## Out of scope (unless user asks)

- WordPress plugin
- Cloudflare pretty URLs
- Consumer checkout iframe embed / GTM (other repo)
- Changing bond-host message protocol

## Deliverables

- Working `sessions_first` portal for at least one test slug
- Brief PR summary + test plan
- Note any API fields missing for labels (age, reg type, images)
