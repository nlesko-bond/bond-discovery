# Bond Host Shell — Webflow / partner setup (d1)

Register opens a **new tab** on the org domain (`org.com/programs/...`) with Bond checkout **inside an iframe** so Bond GTM/GA4 still runs. The discovery tab stays open with filters intact.

This uses **new routes only** (`/portal/{slug}`, `bond-host/v1.js`). Existing discovery pages (`/{slug}`, `/embed/{slug}`, embed kit) are unchanged.

---

## What happens (user journey)

1. User visits **`https://your-site.com/programs`** (your Webflow page).
2. **bond-host.js** loads an iframe → `https://discovery.bondsports.co/portal/YOUR_SLUG` (Bond discovery + analytics).
3. User browses and filters in that iframe.
4. User clicks **Register** → a **new tab** opens: **`https://your-site.com/programs/xx/session/yy?...`** (URL built automatically from Bond `linkSEO` — you do not create these pages in Webflow).
5. The new tab shows Bond **checkout** in a full-height iframe (`bondsports.co` + same path). Analytics run in that iframe.
6. User closes the checkout tab → returns to the **programs** tab with filters unchanged.

---

## Prerequisites

| Item | Where |
|------|--------|
| Discovery **slug** | Bond Discovery admin |
| Deployed host | e.g. `https://discovery.bondsports.co` (main branch with host shell) |
| **`partnerPublicOrigin`** in page features JSON | e.g. `"https://www.your-site.com"` or `"https://your-project.webflow.io"` — **required** so new tabs use your domain, not `bondsports.co` |
| Optional **`consumerOrigin`** | Default `https://bondsports.co` |
| Optional **`linkSeoPathPrefix`** | Default `/programs` |

Example features JSON (Bond admin → page config):

```json
{
  "partnerPublicOrigin": "https://your-project.webflow.io",
  "consumerOrigin": "https://bondsports.co",
  "linkSeoPathPrefix": "/programs"
}
```

---

## Webflow — Step 1: Footer script (site-wide, once)

**Project settings → Custom code → Footer code**

```html
<script src="https://discovery.bondsports.co/bond-host/v1.js" defer></script>
```

---

## Webflow — Step 2: Discovery page (`/programs`)

Create a page whose slug is **`programs`** (or match your `linkSeoPathPrefix`).

Add an **Embed** element (body). Paste:

```html
<div
  id="bond-programs"
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
></div>
```

Replace `YOUR_SLUG` with your discovery slug.

---

## Webflow — Step 3: Registration URLs (catch-all)

Every path like `/programs/anything/...` must serve the **same** embed as Step 2 so shared links and new tabs work.

Webflow **cannot** do this natively. Use one of:

| Approach | Who sets it up |
|----------|----------------|
| **Cloudflare Worker** in front of the Webflow domain | You or the org — Worker returns one HTML shell with the same `data-bond-host` markup for `/programs/*` |
| **Reverse proxy / host rules** | IT on the org side |

**Without Step 3:** Register from the discovery page still opens a new tab, but that tab may **404** on Webflow until the catch-all exists. Discovery-only testing works after Step 1–2.

### Minimal Worker idea (for IT)

- If path is exactly `/programs` → pass through to Webflow (discovery page).
- If path starts with `/programs/` → return static HTML with the same `data-bond-host` div + script (checkout-only mode is automatic).

---

## Webflow — Step 4: Publish and test

1. **Publish** the site (not Designer-only).
2. Open `https://your-project.webflow.io/programs`.
3. Confirm programs load in the page.
4. Click **Register** → new tab → URL should be on **your domain** under `/programs/...`, with Bond checkout inside the page.
5. Close tab → discovery tab still filtered.

### Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| New tab goes to `bondsports.co` not your domain | Set `partnerPublicOrigin` in features JSON |
| Blank checkout iframe | Consumer blocks iframe embed — consumer team must allow `frame-ancestors` |
| New tab 404 | Step 3 catch-all not configured |
| Nothing in Designer | Test on **published** URL only |
| CORS error on bootstrap | Add your Webflow origin to `embedAllowedOrigins` in page config, or leave empty to allow all |

---

## Bond-side routes (reference)

| URL | Purpose |
|-----|---------|
| `/portal/{slug}` | Discovery iframe content (GTM). Only used inside host shell. |
| `/api/host/bootstrap?slug=` | Config for bond-host.js |
| `/bond-host/v1.js` | Partner parent-page script |

---

## Message contract (reference)

| type | From | Action |
|------|------|--------|
| `bond:open_tab` | Portal iframe → parent | Parent runs `window.open(partnerPublicOrigin + path + search)` |
| `discovery-resize` | Bond iframe → parent | Parent sets iframe height |

---

## What we do not change

- `/{slug}`, `/embed/{slug}`, embed kit, and shared discovery components behave as before.
- Portal uses a small **portal-only** click bridge (`HostShellPortalBridge`) that loads only under `/portal/*`.
