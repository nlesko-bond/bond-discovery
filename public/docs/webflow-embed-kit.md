# Webflow embed kit playbook (iframe-free)

This guide is for operators who host customer sites in **Webflow** (or any static host) and want the Bond Discovery experience **in the page DOM** without a full-page iframe.

## What gets loaded

1. **`/embed-kit/v1.js`** — small loader that mounts a [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) root so host CSS does not collide with discovery UI.
2. **`/api/embed/bootstrap?slug=…`** — public JSON (branding, `linkBehavior`, portal template, URLs). **No API key** is returned.
3. **`/api/embed/programs?slug=…`** — program list for that slug (same filtering as the main discovery app).
4. **`/api/events?slug=…`** — schedule payload (used by the `schedule-first` portal only).

All Bond Public API calls stay **server-side** in the discovery app.

## Webflow setup

### 1. Footer script (once per site)

**Project settings → Custom Code → Footer Code**

```html
<script src="https://YOUR-DISCOVERY-HOST/embed-kit/v1.js" defer></script>
```

Replace `YOUR-DISCOVERY-HOST` with your deployed origin (e.g. `https://discovery.example.com`).

### 2. Mount markup (per page or component)

Add a **Webflow Embed** element where programs should appear:

```html
<div
  data-bond-discovery
  data-bond-slug="YOUR_PAGE_SLUG"
  data-bond-base="https://YOUR-DISCOVERY-HOST"
></div>
```

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `data-bond-discovery` | Yes | Auto-initializes the kit on `DOMContentLoaded`. |
| `data-bond-slug` | Yes | Discovery page slug (same as `/your-slug`). |
| `data-bond-base` | Recommended when the script origin cannot be inferred | Absolute base URL of the discovery app. |
| `data-bond-portal` | No | `classic`, `hero-carousel`, or `schedule-first`. Overrides server default for this mount only. |
| `data-bond-theme` | No | JSON object, e.g. `{"mode":"light","accent":"#2563eb"}`. See **Theme**. |

### 3. Designer vs published site

- **Published / staging preview**: full behavior; `fetch` runs against your discovery host.
- **Webflow Designer canvas**: third-party scripts and `fetch` may be blocked or unreliable. **Validate on a published link**, not only inside Designer.

### 4. Double embeds

The kit sets `data-bond-initialized="1"` on the mount node so the same block is not initialized twice. Do not duplicate the same mount + slug on one page unless intentional.

## Manual `BondDiscovery.init`

If you load the script without `data-bond-discovery`, call:

```js
BondDiscovery.init({
  mount: '#bond-root',
  slug: 'YOUR_PAGE_SLUG',
  baseUrl: 'https://YOUR-DISCOVERY-HOST',
  portalTemplate: 'hero-carousel',
  theme: { mode: 'light', accent: '#2563eb' },
});
```

## Portal templates (`features.embedPortalTemplate` or `data-bond-portal` or `?portal=`)

| Value | Behavior |
|-------|----------|
| `classic` | Responsive card grid. |
| `hero-carousel` | Dark hero, filter row, horizontal scrolling cards (marketing-style). |
| `schedule-first` | Schedule table (from `/api/events`) plus program cards below. |

**Server preview without changing DB:** append `portal` to bootstrap only (the kit passes it when `data-bond-portal` / `portalTemplate` is set):

`GET /api/embed/bootstrap?slug=toca&portal=hero-carousel`

## Theme (`init.theme` or `data-bond-theme`)

- **`accent`**: hex string; overrides accent color CSS variable (bar, links, buttons where applicable).
- **`mode`**: `light` adjusts hero/filter styling for light-on-light pages. Omit or `dark` keeps the default dark hero for `hero-carousel`.

Example attribute:

`data-bond-theme='{"mode":"light","accent":"#1d4ed8"}'`

## Registration links (`linkBehavior`)

Configured per discovery page in admin (`features.linkBehavior`):

| Value | Embed kit behavior |
|-------|---------------------|
| `new_tab` | `target="_blank"` + `rel="noopener noreferrer"` (default). |
| `same_window` | `target="_top"` so Bond checkout opens in the top window (common on marketing sites). |
| `in_frame` | `target="_self"` (stays inside the host page / shadow root navigation context). |

Checkout still runs on **Bond** unless you build a deeper integration; this only controls how the browser navigates to the registration URL.

## CORS lockdown (`features.embedAllowedOrigins`)

Optional JSON array of **exact** `Origin` values allowed to read embed APIs, e.g.:

`"embedAllowedOrigins": ["https://my-site.webflow.io","https://www.my-site.com"]`

If omitted, embed APIs use `Access-Control-Allow-Origin: *`.

## Rate limits

`/api/embed/bootstrap` and `/api/embed/programs` return **429** with `Retry-After` when a single client exceeds the per-minute quota. Back off and retry; avoid hot loops in Webflow interactions.

## Legacy iframe

If a partner **blocks third-party scripts** but allows iframes, use `/embed/{slug}` in an `<iframe>` instead. Documented as secondary in admin Help.

## QA checklist

- [ ] Published URL shows programs and Register links open correctly.
- [ ] `linkBehavior` matches expectation (`_blank` vs top-level).
- [ ] Optional `embedAllowedOrigins` includes every production and preview origin you use.
- [ ] `hero-carousel` and `schedule-first` smoke-tested if enabled for the customer.
