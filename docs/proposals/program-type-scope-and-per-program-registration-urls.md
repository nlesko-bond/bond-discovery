# Proposal: Page-scoped program types & per-program registration URLs

**Status:** Draft (not implemented)  
**Audience:** Engineers / agents implementing the feature  
**Motivating customer:** Orgs such as **Palm Beach Skate Zone** that use **custom registration pages per program** and may want discovery pages that only surface certain program categories (e.g. leagues only).

---

## Background

Today, discovery pages can:

- Filter which **programs appear** using **`programFilterMode`** + **`includedProgramIds`** / **`excludedProgramIds`** (program IDs only).
- Override registration for **one** narrow case: **`customRegistrationUrl`** when **`programFilterMode === 'include'`** and **exactly one** program is included (single-program pages).

**Gaps:**

1. There is no first-class way to say “this embed / discovery page only ever shows **program types** X, Y, Z” (e.g. **leagues only**) at the **config** level, independent of the visitor toggling filters. URL query `programTypes=` can pre-filter UX, but server/cache/program list behavior should align for consistency and payload size.

2. There is no way to map **many program IDs → custom registration URLs** in admin. Orgs that use external or custom Bond flows per program need something like **`programId → url`** stored in page config, applied everywhere Register / Learn More / schedule CTAs resolve links.

---

## Goals

### A. Page-level restriction by program type(s)

- Admin can configure **one or more allowed `ProgramType` values** (e.g. `league`, `camp`, `class`).
- **Only programs (and their sessions / schedule events)** whose `type` is in that allowlist appear on the page (programs tab + schedule tab + embed), subject to existing ID include/exclude rules.
- **Interaction with existing filters:** If the “Type” filter remains enabled, either:
  - **Option 1 (recommended):** Hide or disable the program-type filter when the page is hard-scoped (no redundant UX), or  
  - **Option 2:** Keep it but clamp choices to the allowed set only.  
  (Pick one in implementation; default recommendation is Option 1.)

### B. Per-program registration URL overrides

- Admin has a dedicated **Programs** (or **Registration links**) area to define **`programId → registration URL`** overrides.
- When present for a given program, **all registration CTAs** for that program use the override instead of `buildRegistrationUrl(linkSEO, …)`.
- **Invalid or missing** entry for an ID → **fall back to Bond** (`buildRegistrationUrl` / existing behavior). Do not hide the button solely because the override is bad unless product explicitly asks later.
- **Relative URLs** are allowed: normalize the same way as other optional URLs in the product (e.g. punch pass redeem URL) — prepend `https:` when scheme is omitted if that’s existing convention.

---

## Non-goals (for v1)

- Replacing Bond registration entirely org-wide without per-ID configuration.
- Per-**session** or per-**event** URLs (only **programId** scope unless requirements change).
- Migrating Palm Beach data automatically (manual admin entry or a one-off script is out of scope for this doc).

---

## Product decisions (confirmed)

| Topic | Decision |
|--------|-----------|
| Bad / missing override URL | **Fallback to Bond** (`buildRegistrationUrl` with `linkSEO`, existing options). |
| Relative override URLs | **OK**; normalize consistently with existing URL helpers. |
| Schedule tab / events | **Not tricky conceptually:** each `CalendarEvent` already carries **`programId`**. Resolution is **`resolveRegistrationUrl(programId, event.linkSEO, …)`** — same as program cards. No separate “event-level” resolution unless we add session-specific URLs later. |

---

## Technical design

### 1. Config / types

Add to **`FeatureConfig`** in `types/index.ts` (exact names can be bikeshedded):

```ts
// Example shape — align naming with existing camelCase in features JSON
restrictedProgramTypes?: ProgramType[];  // if present & non-empty, only these types
programRegistrationUrls?: Record<string, string>; // programId -> url string
```

- Persist in **`discovery_pages.features`** JSON (same as other flags).
- Wire **`rowToConfig`** / **`defaultConfig`** in `lib/config.ts` so missing → undefined / empty means “no restriction” / “no overrides”.

### 2. Program type restriction — where to enforce

Apply in **every path that builds the program/event list** for a page, not only in the browser:

| Area | Action |
|------|--------|
| `lib/discovery-events.ts` | When filtering programs/sessions/events, skip items whose program `type` is not in `restrictedProgramTypes` (when configured). **Extend cache key** (`toCacheKey` / `buildContext`) so different type restrictions do not share the wrong cached payload. |
| `app/api/programs/route.ts` | Filter returned programs by `restrictedProgramTypes` for consistency with SSR and other consumers. |
| `components/discovery/DiscoveryPage.tsx` / `EmbedDiscoveryPage.tsx` | If any client-side filtering assumes full list, ensure it matches server behavior; ideally server already sends a reduced set. |
| Cron / warm routes | Use same config when warming cache (`app/api/cron/warm-discovery/route.ts` or equivalent). |

**Precedence with ID filters:** Apply **ID include/exclude** and **type restriction** together (intersection). Document order: e.g. ID filter first, then type, or both as AND — either is fine if consistent.

### 3. Per-program registration URLs — central resolver

Add a small helper, e.g. **`lib/registration-url.ts`**:

```ts
export function resolveRegistrationUrl(args: {
  programId: string;
  linkSEO?: string;
  config: DiscoveryConfig;
  /** existing single-page override */
  customRegistrationUrl?: string;
  buildOptions?: Parameters<typeof buildRegistrationUrl>[1];
}): string | undefined;
```

**Precedence (recommended):**

1. `config.features.programRegistrationUrls?.[programId]` trimmed; if non-empty after validation, use it (after normalization).
2. Else `customRegistrationUrl` (today’s single-program override), if applicable.
3. Else `buildRegistrationUrl(linkSEO, buildOptions)`.

**Validation:** If override string is invalid / empty → treat as absent and fall through to Bond.

**Call sites to update** (grep-driven; list may grow):

- `components/discovery/ProgramCard.tsx`
- `components/discovery/ScheduleView.tsx` (list, table, modal)
- `components/discovery/calendar/DayView.tsx`
- `components/discovery/PricingCarousel.tsx`
- `app/embed/[slug]/EmbedDiscoveryPage.tsx` (pass `config` or a bound resolver into children)

Replace repeated `customRegistrationUrl || buildRegistrationUrl(...)` with **`resolveRegistrationUrl({ programId: program.id or event.programId, … })`**.

### 4. Admin UI (`app/admin/pages/[slug]/page.tsx`)

**Program types:**

- New control: multi-select of program types (reuse labels from `getProgramTypeLabel` / existing type enums).
- Clear help text: “Only programs of these types will appear on this page.”
- Optional: auto-uncheck **programType** in `enableFilters` when restriction is active (or show warning).

**Per-program URLs:**

- New subsection under Programs / Registration:
  - **v1 fast:** key-value editor — rows of `[ Program ID ] [ URL ]` with add/remove, or a validated textarea `programId,url` per line.
  - **v2 nicer:** searchable list when org has many programs (optional follow-up).

Persist into `features.programRegistrationUrls` on save (same PATCH as other features).

### 5. Testing

- **Unit:** `resolveRegistrationUrl` precedence, invalid URL fallback, relative URL normalization.
- **Integration / API:** `/api/programs` with mock config returns only allowed types.
- **discovery-events:** cache key differs when `restrictedProgramTypes` changes.
- **UI smoke:** Schedule row with override uses external URL; without override uses Bond.

---

## Risks / notes

- **Cache invalidation:** Any change to `restrictedProgramTypes` or `programRegistrationUrls` must affect cache keys or TTL so users don’t see stale mixes.
- **Embed + query params:** If visitors pass `programTypes` in URL, define behavior: e.g. intersect with page restriction, or ignore URL when page is hard-scoped (document choice in code comments).
- **i18n:** If registration button labels are translated later, resolver stays unchanged.

---

## Summary for implementers

1. Add **`restrictedProgramTypes`** and **`programRegistrationUrls`** to config types and admin.  
2. Enforce type restriction in **`discovery-events`** + **`/api/programs`** + **cache key**.  
3. Add **`resolveRegistrationUrl`** and replace all registration link construction for **programs and schedule events** (keyed by **`programId`**).  
4. Confirm **fallback to Bond** and **relative URL** behavior with tests.

This file is the **source of truth** for scope and decisions until the feature ships; update it if product changes precedence or adds session-level URLs.
