# Bond on your website (Webflow)

Put Bond discovery and registration on the org’s domain. Bond analytics run inside iframes. **Two Webflow pages + Bond admin settings.** No Cloudflare required.

---

## What users see

1. **`yoursite.com/discovery/programs`** — browse programs (Bond discovery iframe).
2. Click **Register** — **new tab** opens.
3. **`yoursite.com/discovery/register?bondPath=...`** — Bond checkout in an iframe on your domain.
4. Close tab — back to programs with filters unchanged.

---

## Step 1 — Bond Discovery admin

1. Open **Bond Discovery admin** → **Pages** → your discovery page (e.g. `toca-evanston`).
2. Go to the **Embed** tab.
3. Scroll to **Partner host shell (Webflow / org site)**.
4. Set:

| Field | Example (adjust to your site) |
|-------|-------------------------------|
| **Partner site URL** | `https://your-site.webflow.io` |
| **Bond checkout domain** | `https://bondsports.co` |
| **Programs page path** | `/programs` (Bond link path prefix; usually leave as `/programs`) |
| **Checkout page path** | `/discovery/register` |

5. **Save** the page.

---

## Step 2 — Webflow site script (once)

**Project settings → Custom code → Footer code**

```html
<script src="https://discovery.bondsports.co/bond-host/v1.js" defer></script>
```

---

## Step 3 — Webflow pages (two pages, same folder)

### Folder structure (example that works)

```
Folder: Discovery
├── Page: programs   →  /discovery/programs     (discovery)
└── Page: register   →  /discovery/register    (checkout shell)
```

The folder name **Discovery** is fine. What matters is the **published URLs** above.

### Page A — Discovery (`/discovery/programs`)

1. Create folder **Discovery** (or use yours).
2. Add page **programs** inside it → URL **`/discovery/programs`**.
3. Add an **Embed** element:

```html
<div
  data-bond-host
  data-bond-slug="YOUR_DISCOVERY_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
></div>
```

Replace `YOUR_DISCOVERY_SLUG` with your Bond admin page slug.

Discovery height adjusts automatically (Bond sends resize messages to `bond-host.js`).

### Page B — Register (`/discovery/register`)

1. Same folder: add page **register** → URL **`/discovery/register`**.
2. Same embed block as Page A, plus chrome offset for your nav bar:

```html
<div
  data-bond-host
  data-bond-slug="YOUR_DISCOVERY_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
  data-bond-chrome-offset-px="80"
></div>
```

Change **`80`** to your site header height in pixels (measure nav + any banner above the embed).

**Checkout page path** in Bond admin (Step 1) must match this URL: `/discovery/register`.

---

## Step 4 — Publish and test

Test on the **published** site, not Designer-only.

| # | Check |
|---|--------|
| 1 | `/discovery/programs` shows the program list |
| 2 | Register opens a **new tab** |
| 3 | New tab URL contains `/discovery/register?bondPath=` |
| 4 | Checkout is visible; Bond footer not cut off (tweak `data-bond-chrome-offset-px` if needed) |
| 5 | Close tab — programs tab still filtered |

---

## Register page height (vs older integration guide)

Your older guide used fixed `calc(100svh - navbar)` CSS. That still makes sense for **checkout**, because Bond consumer may not send height messages yet.

**Recommended (simplest):**

- Use **`bond-host.js`** (Step 2) — it already resizes the **discovery** iframe.
- On the **register** page only, add **`data-bond-chrome-offset-px="80"`** on the embed div (Step 3).  
  `bond-host` sets checkout iframe height to `calc(100dvh - 80px)` so Bond’s fixed footer stays visible.

**Do not use** the Wix-style script that reads inside the iframe DOM — Bond is cross-origin; that pattern will not work.

**Optional:** If checkout still feels short/tall after offset is right, Bond engineering can add `postMessage` resize from consumer (then `bond-host` will use dynamic height automatically).

You do **not** need a separate resize script in Webflow if you use `data-bond-chrome-offset-px`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Register tab 404 | Create Page B; match **Checkout page path** in admin |
| Wrong domain in new tab | Set **Partner site URL** in admin → Save |
| Blank checkout iframe | Consumer must allow iframe embed (Bond eng) |
| Bond footer cut off on register | Increase `data-bond-chrome-offset-px` |
| Double scroll on register | Keep only one embed on page; avoid extra fixed-height wrappers |
| Works only after Publish | Designer does not run embed scripts reliably |
| API / CORS error | Add your Webflow origin under **Embed allowed origins**, or leave empty |

---

## Cloudflare

**Not required** for this setup.

Optional later if you want pretty URLs like `/programs/123/session/456` instead of `/discovery/register?bondPath=...`.

---

## Unchanged

- `discovery.bondsports.co/your-slug` — same as before.
- Embed kit — unchanged.

---

## Bond URLs (reference)

| URL | Purpose |
|-----|---------|
| `/portal/{slug}` | Discovery inside org iframe |
| `/bond-host/v1.js` | Script on org site |
| `/api/host/bootstrap?slug=` | Config for the script |
