# Bond Host Shell — partner integration

Partners load Bond discovery and registration **inside iframes** on their domain so Bond GTM/GA4 runs correctly. The org implements **two routes** (discovery + catch-all checkout paths); Bond ships `bond-host/v1.js` and config from `/api/host/bootstrap`.

## Prerequisites

- Discovery page **slug** (same as `/{slug}` in Bond Discovery admin).
- Optional in page **features** JSON:
  - `consumerOrigin` — e.g. `https://bondsports.co`
  - `partnerPublicOrigin` — e.g. `https://www.yourorg.com`
  - `linkSeoPathPrefix` — default `/programs`
- Bond consumer must allow iframe embedding on registration URLs (consumer team).

## 1. Load the host SDK (once per site)

```html
<script src="https://YOUR-DISCOVERY-HOST/bond-host/v1.js" defer></script>
```

## 2. Discovery page (one CMS page)

Example path: `/programs`

```html
<div
  id="bond-programs"
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://YOUR-DISCOVERY-HOST"
></div>
```

This mounts an iframe to `https://YOUR-DISCOVERY-HOST/portal/YOUR_SLUG` (tracked GTM).

## 3. Checkout shell (catch-all — same HTML everywhere)

All paths under your `linkSeoPathPrefix` (default `/programs/...`) must serve the **same** page markup:

```html
<div
  id="bond-shell"
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://YOUR-DISCOVERY-HOST"
></div>
<script src="https://YOUR-DISCOVERY-HOST/bond-host/v1.js" defer></script>
```

On load, `bond-host.js` reads `window.location.pathname` and opens the checkout iframe to `consumerOrigin + path + search`.

### WordPress

Use a rewrite so `/programs/*` maps to one template containing the shell above (Phase 2 plugin in `integrations/wordpress/`).

### Webflow / static

Use Cloudflare Worker or host rewrites to return one HTML shell for `/programs/*`.

## 4. Bootstrap API

```
GET https://YOUR-DISCOVERY-HOST/api/host/bootstrap?slug=YOUR_SLUG
```

Returns `consumerOrigin`, `linkSeoPathPrefix`, `paths.portalDiscoveryUrl`, branding. CORS follows `features.embedAllowedOrigins` (empty = allow all).

## postMessage contract

| type | From | Action |
|------|------|--------|
| `bond:navigate` | Discovery iframe | `{ path, search? }` — host opens checkout overlay |
| `discovery-resize` / `bond:resize` | Bond iframe | `{ height }` — host sets iframe height |

Register uses `bond:navigate` when discovery runs at `/portal/{slug}` (`host_routed` mode).

## What does not change

- Existing `/{slug}` and `/embed/{slug}` pages behave as before unless you point partners at `/portal/{slug}`.
- Embed kit (`embed-kit/v1.js`) is unchanged.

## QA

1. Discovery page shows programs; GTM loads inside iframe (check tag assistant on iframe document).
2. Register updates parent URL to `/programs/...` and shows checkout iframe.
3. Direct visit to `/programs/{session-path}` loads checkout without a separate CMS page.
4. Back button returns from checkout to discovery.
