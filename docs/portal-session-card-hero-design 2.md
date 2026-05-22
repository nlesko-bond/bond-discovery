# Portal session card — hero / top-of-card design (proposal)

**Status:** Locked — icon strip (variant D) for v1  
**Audience:** Product + next implementation agent  
**API reference:** [Bond public API](https://public.api.bondsports.co/public-api/) · `SessionDto` has no image field

---

## Problem

Session-first portal shows **one card per session** under a single program. Program-level imagery does not work when many sessions share one `programId`.

`SessionDto` provides text fields (`name`, `description`, `longDescription`, dates, `facility`, `minAge`/`maxAge`, `gender`, `availabilityStatus`, nested `products`) but **no session image**.

---

## Recommendation (updated after layout mock)

**Do not use a fixed half-card description hero** unless we can guarantee every session description leads with an image (we cannot today).

| ID | Approach | Summary | v1? |
|----|----------|---------|-----|
| A | Text only | Description in body; predictable layout | **Yes** |
| B | Description hero (no image) | Fixed top block — often empty or text-only | No |
| C | Description hero (with image) | Only looks good when partners embed top image | No |
| D | Icon strip | Sport + facility + gender/age from API | **Yes** |
| E | Admin image map | facility + age + gender → uploaded asset | Later |

**Shipped choice: D — icon strip** (`HostPortalSessionIconStrip` + `SessionDto.sport`, `facility`, `minAge`/`maxAge`, `gender`).

Interactive mock: `canvases/portal-session-card-mock.canvas.tsx`.

---

## Card layout (sessions_first)

```
┌─────────────────────────────────────────┐
│  HERO: sanitized session.description    │  min-height ~140px, max ~220px
│  (HTML: text, inline images, lists)     │  overflow hidden + “Read more”
├─────────────────────────────────────────┤
│  Session name                    [Closed]│
│  Program name (muted)                    │
│  Dates · Facility · Age · Gender         │
├─────────────────────────────────────────┤
│  Segments (if any, from API)             │
│  Products + Register (per product)       │
└─────────────────────────────────────────┘
```

- No registration-type label until API/product defines one.
- **Closed** badge driven only by `SessionDto.availabilityStatus` (mapping TBD with product).
- `longDescription` optional expand below hero, not mixed into hero without explicit decision.

---

## Admin setting (portal only)

Add under **Partner host shell** when `hostPortalLayout = sessions_first`:

| Value | Behavior |
|-------|----------|
| `description_hero` (default) | Sanitized HTML hero from `description` |
| `none` | No hero band; plain text description in body (current interim UI) |

Defer program image / image pool / auto-generate until there is an API or CMS source of truth.

---

## Technical notes (when implementing)

- Reuse existing HTML sanitization used elsewhere in discovery (e.g. `stripHtml` / sanitize pipeline) for **display**; hero needs **safe render** (`dangerouslySetInnerHTML` only after sanitize).
- iframe height: hero changes affect `discovery-resize` — remeasure after images load.
- Accessibility: hero images require `alt` from Bond content or decorative handling.

---

## Open questions for product

1. Which `AvailabilityStatusEnum` values show **Closed** and disable Register? (`unavailable`, `expired`, others?)
2. Is `description` always HTML in production, or sometimes plain text?
3. Should `longDescription` appear in-card, in a modal, or not on portal?
