# Plan 009 — Design direction (Step 1 deliverable)

Status: DRAFT — direction shown to operator on 2026-06-10 (mockup in session);
awaiting refinements/approval before Steps 2–6 build. Reference pages reviewed:
- Current Bond-rendered page: https://discovery.bondsports.co/pbsz?viewMode=programs
- Partner-built comparison: https://prod-testing.webflow.io/discovery/programs

## Diagnosis of current state

- **PBSZ (current template)**: has the right data (price, ages, spots, sessions)
  but everything renders at equal visual weight — five filter dropdowns in a row,
  cards where all metadata competes. Functional, not scannable.
- **Webflow partner page**: category-accordion browsing with no decision data on
  the surface (no price/ages/availability) — every decision costs a click-through.
  Proof that partners hand-build worse pages than Bond can render; the template
  upgrade is the adoption argument for the host kit.

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

## Open questions for the operator

- Card density: current mock is ~3-up at desktop width; prefer 2-up larger cards?
- Search affordance: keep the quiet search pill, or drop search entirely (chips
  may be sufficient at current program counts)?
- Member pricing prominence: quiet inline hook (current direction) vs. explicit
  member/non-member price rows?
- Real program photography availability per customer (drives how good the
  image-panel fallback must look).
