# Bond on your website — integration guide

One-time setup to show Bond **programs** and **registration** on your domain (e.g. Webflow). Bond analytics run inside Bond iframes. This guide does not change your existing `discovery.bondsports.co/{slug}` link or the embed kit.

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

Optional: **Analytics** on same page — add partner **GTM-XXXXXX** (events fire inside discovery iframe; see [analytics doc](./analytics-discovery-and-host-shell.md)).

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

Add **Embed** element:

```html
<div
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
></div>
```

Replace `YOUR_SLUG` with admin page slug. No chrome offset on this page.

### Page B — Register (`/discovery/register`)

Same embed, plus nav offset (measure your header height in px):

```html
<div
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
  data-bond-chrome-offset-px="80"
></div>
```

`data-bond-chrome-offset-px` sets checkout iframe height to `calc(100dvh - 80px)` so Bond’s footer is not hidden under your nav.

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
| Footer cut off | Increase `data-bond-chrome-offset-px` |
| Double scroll on register | One embed per page; avoid extra fixed-height wrappers |
| CORS / API errors | Add Webflow origin under **Embed allowed origins** (or leave empty) |

Do **not** use scripts that read inside the Bond iframe DOM (cross-origin).

---

## What stays the same

| Item | Unchanged |
|------|-----------|
| `discovery.bondsports.co/{slug}` | Direct link |
| Embed kit `embed-kit/v1.js` | Shadow DOM / in-page kit |
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

- **Discovery:** GTM loads inside iframe; events like `click_register`, `filter_applied` — full list in [analytics-discovery-and-host-shell.md](./analytics-discovery-and-host-shell.md).  
- **Verify:** GTM Preview on published programs page; click Register and filters.  
- **Checkout tab:** Tracked in Bond consumer app, not in this repo.  
- **Known gap:** Portal register click may not fire `click_register` until bridge tracking fix — see analytics doc.

Admin GTM UI: `/admin/help/gtm-setup`

---

## Next product phase

Session-first portal cards, portal-only filters, closed-session tagging — see [portal-session-first-design-spec.md](./portal-session-first-design-spec.md). Not required for basic host shell go-live.
