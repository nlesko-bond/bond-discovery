# Plan 009 — Design direction (Step 1 deliverable)

Status: APPROVED WITH REFINEMENTS — operator answered the open questions on
2026-06-10 (folded in below). Reference pages:
- Current Bond-rendered page: https://discovery.bondsports.co/pbsz?viewMode=programs
- Kit-rendered page on a partner site: https://prod-testing.webflow.io/discovery/programs
  — IMPORTANT: this page IS this repo's output. The host kit (bond-host/v1.js)
  iframes /portal/{slug} into the Webflow page. Both reference URLs render the
  same component family this plan redesigns (HostPortalDiscoveryPage /
  DiscoveryPage, session cards, filter bar). There is no "partner-built"
  comparison page — the ugly page is ours, and that is the point of this plan.

## Diagnosis of current state

- The current template has the right data (price, ages, spots, sessions) but
  everything renders at equal visual weight — five filter dropdowns in a row,
  cards where all metadata competes. Functional, not scannable.
- **Filters are a first-class problem, not just styling** (operator, verbatim:
  "Its filters don't work well"). Builders must treat filter BEHAVIOR as in
  scope: audit each filter on real configs (sport/activity, age, gender,
  facility, program type) for (a) options that match the loaded data, (b)
  results updating correctly and visibly, (c) state surviving register
  round-trips, (d) mobile usability. File and fix behavioral bugs found during
  the rebuild — they are part of this plan, not follow-ups.

## Direction (what changes)

1. **Activity chips are the hero filter.** Horizontal chip row directly under the
   header (active chip filled with the brand accent). This is the product's Page-1
   promise — "all programs across facilities filtered by activity" — one tap, always
   visible. Secondary filters (Age, Day, Facility) collapse into small pill
   dropdowns on one row, with a live result count ("8 programs") right-aligned.
2. **Card answers three questions, in order:**
   - What is it → title (15px/500), image or tinted sport-glyph panel
   - Is it for me → ONE muted meta line: `Ages 18+ · Co-ed · Tue & Thu evenings`
   - Cost + urgency → `From $X` (prominent) with optional member-price hook
     (`$8 members` in accent color), availability as a colored pill ON the image
     (green=open, amber=almost full, gray=waitlist/closed)
   - One accent **Register** button (full width on mobile, ≥44px) + ghost
     **Details** link. Register keeps `data-bond-*` analytics attributes.
3. **Image area degrades gracefully**: real program photo when present, else flat
   tinted panel (derived from accent or per-sport hue) with a sport glyph. Never a
   broken/gray image box.
4. **Branding through one accent color** from `branding.primaryColor`: active
   chip, Register button, member-price text. Everything else neutral
   (white surface, near-black text, muted gray meta) so the page looks native on
   any partner site.
5. **Mobile (≤640px)**: single column; chips horizontally scrollable; secondary
   filters fold into a single "Filters" pill opening a bottom sheet (sheet rendered
   in-flow within the iframe — NOT position:fixed); full-width CTA; meta compresses
   to one line `Ages 18+ · Tue & Thu · From $10`.
6. **States**: skeleton cards matching grid geometry while loading; friendly
   empty state with "Clear filters" action; zero-events state renders branded
   header + message (never a blank iframe).
7. **Type/spacing system**: two weights (400/500); sizes 12 (meta) / 13 (buttons)
   / 14–15 (titles) / page title larger; spacing on a 4px grid; 12px card radius;
   hairline borders; whitespace over dividers.

## Invariants (unchanged from plan 009 — repeat for builders)

- No `100vh`/`100dvh`/`position: fixed` in portal components (iframe is
  content-sized; resize contract via postMessage must keep working).
- Register links keep `data-bond-program-id` etc. and the
  `trackHostShellRegisterClick` flow.
- No data-pipeline changes; templates consume the existing session-card model.
- Roll out behind `features.portalTemplate: 'v2'` per page; default unchanged
  until operator flips it.

## Operator answers (2026-06-10) — binding for the build

1. **Card density**: depends on the page's content hierarchy — pages render
   different shapes (programs → sessions → segments, sessions → segments,
   sessions → event schedule, etc.; e.g. Coppermine is sessions-first, not
   programs). So density is NOT one global choice: make it configurable, e.g.
   `features.portalCardMinWidth` (px) feeding
   `grid-template-columns: repeat(auto-fill, minmax(var(--card-min-w), 1fr))`,
   with sensible defaults per layout mode (sessions-first lists can run denser
   than program cards). Admin control belongs in the Appearance section.
2. **Search**: keep it — useful.
3. **Member pricing**: inline hook, designed to work both with and without
   member pricing present (absent → row simply shows "From $X" alone, no gap).
   Build 2–3 visual variants and show the operator examples before settling.
4. **Imagery**: do NOT design around photos. No guaranteed program photography,
   and the API returns no session-level images at all (sessions-first pages
   like Coppermine would never have them). The tinted sport-glyph panel is the
   PRIMARY card visual; a real photo (program-level only, when present) is the
   enhancement, not the default. The glyph panels must look intentional, not
   like fallbacks.
