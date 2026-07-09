# Bond on your website — integration guide

One-time setup to show Bond **programs** and **registration** on your domain (e.g. Webflow). Bond analytics run inside Bond iframes. This guide does not change your existing `discovery.bondsports.co/{slug}` direct link. The **host kit** (`bond-host/v1.js`) is the only supported integration path; the legacy embed kit has been retired.

**Also read:** [Analytics (discovery + checkout)](./analytics-discovery-and-host-shell.md) · [Portal UI roadmap](./portal-session-first-design-spec.md)

---

## Architecture (60 seconds)

```text
Your site                          Bond
─────────                          ────
/discovery/programs  ──iframe──►  discovery.bondsports.co/portal/{slug}
       │                                    │
       │ Register click                     │ GTM + events (inside iframe)
       ▼                                    │
/discovery/register?bondPath=... ──iframe──► bondsports.co/programs/...
```

- **Programs page:** discovery iframe (auto height).  
- **Register:** new browser tab on **your** URL; checkout loads in iframe.  
- **Script:** `bond-host/v1.js` on your site footer (once).

---

## Prerequisites

- Bond Discovery admin access to your page (slug).  
- Webflow (or any site) where you can add custom code + two pages.  
- Bond consumer must allow iframe embed on checkout (Bond support if checkout is blank).

---

## Step 1 — Bond admin (5 min)

**Pages → your slug → Embed → Partner host shell**

| Field | Example |
|-------|---------|
| Partner site URL | `https://your-site.webflow.io` |
| Bond checkout domain | `https://bondsports.co` |
| Programs page path | `/programs` |
| Checkout page path | `/discovery/register` |

Save. Checkout path must match the register page you create in Step 3.

Optional: **Analytics** on same page — add partner **GTM-XXXXXX** (see [customer setup guide](./customer-setup-discovery-checkout-analytics.md)).

---

## Step 2 — Site-wide script (once)

**Webflow:** Project settings → Custom code → **Footer**

```html
<script src="https://discovery.bondsports.co/bond-host/v1.js" defer></script>
```

Use your real discovery host if different.

---

## Step 3 — Two pages

### Folder (example)

```text
Discovery/
  programs   →  /discovery/programs
  register   →  /discovery/register
```

### Page A — Programs (`/discovery/programs`)

Add **Embed** element. Default (no offset attributes) is **auto-measure**: the kit measures the page's own in-flow chrome at runtime. Only set an explicit offset when the site has a **fixed/sticky nav that overlays content** (auto-measure cannot detect overlays — measure the nav height in px):

```html
<div
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
  data-bond-chrome-offset-px="80"
  data-bond-chrome-offset-px-mobile="64"
></div>
```

| Attribute | Purpose |
|-----------|---------|
| *(none — default)* | Auto-measure. Checkout iframe fits the viewport below the embed's actual on-page position (re-measured on load/resize; 480px floor; reserves ≤50% of viewport). In-flow headers need nothing. |
| `data-bond-chrome-offset-px` | Explicit desktop value — always wins, disables auto-measure. Programs iframe: `margin-top` to clear a fixed nav. Checkout iframe: `calc(100dvh - Npx)`. |
| `data-bond-chrome-offset-px-mobile` | Optional mobile override (≤767px). Use when mobile nav height differs. |

**Webflow layout rules (programs page):**

1. Put the embed at the **top of the page body** — no extra section padding-top for the nav (the kit applies offset via iframe `margin-top`).
2. Do **not** wrap the embed in a fixed-height div or `overflow: hidden` section.
3. Desktop gap too large → lower `data-bond-chrome-offset-px` or remove duplicate Webflow spacer above the embed.
4. Mobile cut off at bottom → publish site, hard refresh, confirm `bond-host/v1.js` loads; check parent section is not clipping; tune mobile offset separately from desktop.

Replace `YOUR_SLUG` with admin page slug.

### Page B — Register (`/discovery/register`)

Same embed. Default (no attributes) auto-fits the checkout iframe below the page's in-flow chrome so Bond's footer is visible without scrolling:

```html
<div
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
></div>
```

Fixed/sticky nav overlaying content? Add `data-bond-chrome-offset-px="80"` (nav height in px) — checkout iframe height becomes `calc(100dvh - 80px)` so Bond’s footer is not hidden under the nav.

---

## Step 4 — Test (published site only)

| # | Check |
|---|--------|
| 1 | Programs page shows list |
| 2 | Register opens **new tab** |
| 3 | Tab URL is `/discovery/register?bondPath=` |
| 4 | Checkout visible; footer not cut off (tune offset) |
| 5 | Close tab — programs tab still filtered |

Designer preview often does not run embed scripts — **Publish** first.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Register tab 404 | Create register page; match **Checkout page path** in admin |
| Wrong domain in new tab | Fix **Partner site URL**; save |
| Blank checkout | Bond must allow iframe embed on consumer |
| Checkout footer cut off | Increase `data-bond-chrome-offset-px` on register page |
| Programs iframe too low / white gap above | Lower or remove `data-bond-chrome-offset-px`; remove Webflow section padding-top |
| Programs iframe cut off on mobile | Remove fixed-height wrapper; add `data-bond-chrome-offset-px-mobile`; republish Webflow |
| Double scroll on register | One embed per page; avoid extra fixed-height wrappers |
| CORS / API errors | Add Webflow origin under **Embed allowed origins** (or leave empty) |

Do **not** use scripts that read inside the Bond iframe DOM (cross-origin).

---

## What stays the same

| Item | Status |
|------|-----------|
| `discovery.bondsports.co/{slug}` | Direct link — unchanged |
| Embed kit `embed-kit/v1.js` | **Retired** — use the host kit; `/embed/{slug}` redirects to `/{slug}` |
| Cloudflare pretty URLs | Optional later |

---

## Bond reference URLs

| URL | Role |
|-----|------|
| `/portal/{slug}` | Discovery in iframe |
| `/bond-host/v1.js` | Parent script |
| `/api/host/bootstrap?slug=` | Config JSON |

---

## Analytics quick reference

- **Customer guide:** [guide.html](./documentation/website/discovery/guide.html) → live at https://discovery.bondsports.co/documentation/website/discovery/guide  
- **Engineering detail:** [analytics-discovery-and-host-shell.md](./analytics-discovery-and-host-shell.md)  
- **Verify:** GTM Preview on published programs page; click Register inside embed.  
- **Checkout conversions:** the host kit (`/bond-host/v1.js`) automatically forwards Bond checkout conversion events (`BOND_GTM_EVENT` postMessages — `begin_checkout`, `select_payment_method`, `purchase`, etc.) into the partner page's `window.dataLayer`. Partners only need GTM installed on their site (the standard GTM head/noscript snippets) plus their GTM/GA4 tag configuration per Bond's help-center articles 11139263 / 12580240 — no extra listener script.  
- **Manual "Script 3" listener:** partners who previously pasted Bond's manual `BOND_GTM_EVENT` listener ("Script 3" from the help center) can keep it — the kit detects it via `window.__bondGtmListenerAttached` and will not double-fire — but new setups should omit Script 3.  
- **Limitation:** conversion events are forwarded only on pages where the kit mounts the checkout iframe (discovery/landing pages). If a partner deep-links users directly to `bondsports.co` (no iframe), conversions are tracked by GTM configured inside Bond checkout itself, not by the partner page.  

Admin GTM UI: `/admin/help/gtm-setup`

---

## Next product phase

Session-first portal cards, portal-only filters, closed-session tagging — see [portal-session-first-design-spec.md](./portal-session-first-design-spec.md). Not required for basic host shell go-live.
