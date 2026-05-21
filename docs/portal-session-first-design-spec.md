# Portal session-first layout — design spec (handoff)

**Audience:** Next implementation agent  
**Repo:** `bond-discovery`  
**Last updated:** 2026-05-19  
**Related:** [Partner host integration](./partner-host-integration.md) · [Analytics](./analytics-discovery-and-host-shell.md)

---

## Executive summary

Bond Discovery is adding a **partner host shell**: org-domain pages embed Bond discovery and checkout in **iframes** so Bond GTM/GA4 run inside Bond-controlled documents (not Shadow DOM embed kit).

**Phase 1 (shipped):** `bond-host/v1.js`, `/portal/{slug}`, register opens org-domain new tab with consumer checkout iframe.  
**Phase 2 (this spec):** **Session-first portal UI** — one card per session, nested segments/products, portal-only filters, optional grouping. **Do not change** the legacy discovery surfaces.

---

## What we are doing (product)

| Surface | User experience |
|--------|------------------|
| Org **programs** page | iframe → `https://{discovery-host}/portal/{slug}` |
| **Register** click | New tab on org domain → checkout iframe (`bondPath` query) |
| Portal discovery (Phase 2) | **Session cards** (not flat one-row-per-session grid), nested pricing/products, product-level register deep links |
| Closed sessions | **Shown** when API/config includes them; tagged **Closed**; register CTA disabled |
| Schedule | Keep **Schedule** tab if feasible (reuse existing schedule pipeline) |
| Filters | **New portal-only filter UX** — do not copy current horizontal filter bar |

---

## What NOT to touch (hard boundaries)

These paths and behaviors must remain **unchanged** unless there is an explicit, scoped bugfix:

| Area | Paths / notes |
|------|----------------|
| Public slug discovery | `app/[slug]/`, `components/discovery/DiscoveryPage.tsx` used at `/{slug}` |
| Embed kit | `public/embed-kit/v1.js`, `app/embed/[slug]/`, `public/docs/webflow-embed-kit.md` |
| Shared discovery components | `ProgramCard`, `ScheduleView`, `HorizontalFilterBar`, `FilterBar`, `MobileFilters` — **no portal-specific branches**; portal Phase 2 should use **new** components under `components/host-shell/` (or `components/portal/`) |
| Host shell contract | `public/bond-host/v1.js` message types: `bond:open_tab`, `bond:resize`, legacy `discovery-resize` |
| Portal bridge pattern | `HostShellPortalBridge` intercepts register clicks in iframe only — extend carefully (see analytics doc for click tracking gap) |
| Config storage shape | Page JSON in Supabase; portal overrides via `toPortalDiscoveryConfig()` only |

**Allowed portal-only touch today:** `app/portal/[slug]/`, `lib/host-shell/*`, `components/host-shell/*`, `app/api/host/bootstrap/`, admin Embed → Partner host shell fields.

---

## Phase 1 — already built (reference)

```
Org site (Webflow)
  ├─ /discovery/programs  → bond-host → iframe /portal/{slug}
  └─ /discovery/register?bondPath=... → bond-host → iframe {consumer}/programs/...
```

| File | Role |
|------|------|
| `public/bond-host/v1.js` | Parent SDK: bootstrap, discovery iframe, checkout iframe, open tab, resize |
| `app/api/host/bootstrap/route.ts` | Public config: origins, paths, portal URL |
| `app/portal/[slug]/page.tsx` | Renders `DiscoveryPage` + `toPortalDiscoveryConfig()` (minimal header) |
| `app/portal/[slug]/layout.tsx` | `HostShellPortalBridge` |
| `components/host-shell/HostShellPortalBridge.tsx` | Capture-phase click → `postMessage` `bond:open_tab` |
| `lib/host-shell/portal-config.ts` | Portal-only feature overrides |
| `docs/partner-host-integration.md` | Partner setup guide |

Admin fields (Embed tab): `partnerPublicOrigin`, `consumerOrigin`, `linkSeoPathPrefix`, `checkoutLandingPath`.

---

## Phase 2 — session-first portal (to build)

### Layout model

- **Not** one table row per session.
- **One card per session** containing:
  - Name, image, short description
  - Facility, age range, gender, date range
  - Registration mode label (derive from API): weekly segments / per-event drop-ins / full session registration
  - **Nested** segments and **products (pricing)** inside the card
- **Register on product** → `buildRegistrationUrl(..., { productId })` so consumer checkout can skip product picker (`productId` query already supported in `lib/utils.ts`).

### Closed sessions

- Inclusion controlled by existing discovery API/page config (same as today).
- UI: visible with **Closed** (or existing status chips); primary register **disabled**; optional secondary “Learn more” if product policy allows.

### Grouping (optional v1.1)

Start **ungrouped**. Later: group headers by **facility** (preferred) or **age band** — admin flag `hostPortalGroupBy?: 'none' | 'facility' | 'age'`.

### Schedule tab

- Portal page hosts tabs: **Sessions** (new) | **Schedule** (reuse).
- Schedule: wire to existing `ScheduleView` or a thin portal wrapper that passes same props/events API as `DiscoveryPage` schedule mode.
- Avoid duplicating event-fetch logic — call same hooks/helpers `DiscoveryPage` uses.

### Portal-only filters

- New `HostPortalFilterBar` (name TBD): compact, embed-width-friendly, mobile-first.
- Reuse filter **state** types (`DiscoveryFilters`) and URL sync patterns from `DiscoveryPage` where possible.
- **Do not** import `HorizontalFilterBar` into portal layout.

### Feature flag

Add to page features (admin + types):

```ts
hostPortalLayout?: 'legacy_programs' | 'sessions_first'; // default legacy until rollout
```

When `sessions_first`, `/portal/[slug]` renders `HostPortalDiscoveryPage` instead of `DiscoveryPage`.

### Suggested file layout

```
components/host-shell/
  HostPortalDiscoveryPage.tsx      # tabs, data loading orchestration
  HostPortalSessionCard.tsx
  HostPortalSessionList.tsx
  HostPortalFilterBar.tsx
  HostPortalScheduleTab.tsx        # wraps ScheduleView or subset
lib/host-shell/
  session-card-model.ts            # map Program/Session/API → card view model
```

### Registration navigation (host shell)

Product/session register links must remain **real `<a href>`** paths under `/programs/...` so `HostShellPortalBridge` can intercept and open org checkout tab. Do not use `window.open` without href.

After analytics fix (see analytics doc), fire `gtmEvent.clickRegister` / `bondAnalytics.clickRegister` **before** `preventDefault` in bridge, or duplicate tracking in bridge from parsed href.

---

## API / data dependencies (confirm before UI lock-in)

Map these from existing program/session payloads (`types`, `lib/transformers.ts`, `/api/programs`):

| UI field | Likely source |
|----------|----------------|
| Session image / description | Session or program branding fields |
| Age / gender | Session or program metadata |
| Weekly vs drop-in vs session reg | Segment list shape, `registrationWindowStatus`, product types |
| Closed | `registrationWindowStatus === 'closed' \| 'ended'` |
| Products | `session.products[]` |
| Segments | Session segments / events linkage (confirm in API response) |

If API lacks a field, show omission rather than inventing data.

---

## Build order

1. `hostPortalLayout` flag + admin toggle  
2. `HostPortalDiscoveryPage` skeleton + session cards + product register links  
3. Wire host bridge + **analytics on register click** (fix gap)  
4. Schedule tab  
5. `HostPortalFilterBar` v1  
6. Optional facility grouping  

---

## Testing checklist

- [ ] `/{slug}` unchanged (visual + register behavior)  
- [ ] `/embed/{slug}` unchanged  
- [ ] `/portal/{slug}` legacy layout still works when flag unset  
- [ ] Session-first: card expand, product register URL contains `productId`  
- [ ] Closed session: visible, register disabled  
- [ ] Register → new tab on org domain with correct `bondPath`  
- [ ] GTM `click_register` fires in portal iframe (after analytics fix)  
- [ ] `discovery-resize` still resizes programs iframe  

---

## Open questions

- Exact API fields for “weekly segments vs drop-in vs session reg” labels  
- Whether portal should set `linkBehavior: host_routed` in config (type exists; bridge is layout-based today)  
- Consumer iframe embed + GTM on checkout (consumer repo — not in this spec)  
- Pretty URLs via Cloudflare vs `?bondPath=` (optional; not blocking)

---

## Links

- Partner setup: [partner-host-integration.md](./partner-host-integration.md)  
- Analytics inventory: [analytics-discovery-and-host-shell.md](./analytics-discovery-and-host-shell.md)  
- In-app GTM help (partial event list): `/admin/help/gtm-setup`
