# Embed Bond on an org website (Webflow)

This is for putting Bond **discovery + registration** on an org’s site (e.g. Webflow) so Bond analytics still run inside iframes.

**You do not need Cloudflare** for the normal setup. You need **two Webflow pages** and settings in **Bond Discovery admin**.

---

## What the user experiences

1. They open **`yoursite.com/programs`** → see Bond programs (iframe).
2. They click **Register** → a **new tab** opens.
3. That tab is **`yoursite.com/programs/register?...`** → Bond checkout runs **inside an iframe** (trackable).
4. They close the tab → the **programs** tab is still there with filters unchanged.

---

## Part A — Bond Discovery admin (you)

This is **not** hidden JSON. It’s in the same place you edit any discovery page.

1. Go to **Bond Discovery admin** → **Pages**.
2. Open the page you’re embedding (same **slug** you use today, e.g. `toca-evanston`).
3. Open the **Embed** tab (same area as “Registration link behavior” and “Embed allowed origins”).
4. Scroll to **Partner host shell (Webflow / org site)**.
5. Fill in:

| Field | Example | Required? |
|-------|---------|-------------|
| **Partner site URL** | `https://your-project.webflow.io` or `https://www.real-domain.com` | Recommended (staging + prod may need two configs or pick production) |
| **Bond checkout domain** | `https://bondsports.co` | Optional (default) |
| **Programs page path** | `/programs` | Must match your Webflow discovery page slug |
| **Checkout page path** | `/programs/register` | Must match your second Webflow page slug |

6. Click **Save** (same Save you use for the rest of the page).

If you skip **Partner site URL**, the script guesses from the page the user is on (OK for a quick test on one Webflow URL).

---

## Part B — Webflow (org or you)

### B1 — Footer script (once per site)

**Project settings → Custom code → Footer code**

```html
<script src="https://discovery.bondsports.co/bond-host/v1.js" defer></script>
```

Use your real Bond discovery host if different.

### B2 — Page 1: Programs (discovery)

- Create a Webflow page with slug **`programs`** (or whatever you set as **Programs page path**).
- Add an **Embed** element. Paste:

```html
<div
  data-bond-host
  data-bond-slug="YOUR_DISCOVERY_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
></div>
```

Replace `YOUR_DISCOVERY_SLUG` with the admin page slug (e.g. `toca-evanston`).

### B3 — Page 2: Register (checkout shell)

- Create a **second** Webflow page with slug **`programs/register`** (or whatever you set as **Checkout page path**).
- Add the **same** Embed block (same `data-bond-slug`, same script in footer).

You are **not** creating a page per program. One empty shell page handles every registration.

### B4 — Publish

Test on the **published** URL, not only in the Designer.

---

## Part C — Quick test checklist

| Step | Check |
|------|--------|
| 1 | `yoursite.com/programs` shows programs |
| 2 | Click Register → **new tab** opens |
| 3 | New tab URL is on **your domain** (`.../programs/register?bondPath=...`) |
| 4 | Checkout appears in the page (iframe), not a full redirect to bondsports.co in the address bar |
| 5 | Close tab → programs tab still filtered |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| “Where is features JSON?” | Use **Embed** tab → **Partner host shell** fields (above). No manual JSON. |
| Register tab 404 | Add **page 2** (`/programs/register`) with the same embed div |
| New tab goes to wrong domain | Set **Partner site URL** in admin and Save |
| Blank checkout | Bond consumer may block iframes — engineering must allow embed on checkout |
| Nothing works in Designer | **Publish** and test live URL |
| API blocked | **Embed allowed origins**: add your Webflow URL, or leave empty |

---

## Cloudflare — when is it needed?

**Not for the setup above.**

Cloudflare (or similar) is only if you want the address bar to show the full Bond path, e.g.  
`yoursite.com/programs/123/session/456`  
instead of  
`yoursite.com/programs/register?bondPath=...`

That’s nicer for SEO/sharing later. The **two-page Webflow setup** is enough to ship and test.

Cloudflare Workers has a **free tier**; it is not “you must pay for Cloudflare” for basic hosting. We have not packaged a Worker for you yet — use two Webflow pages first.

---

## What this does not change

- Normal Bond discovery URLs (`discovery.bondsports.co/your-slug`) work as before.
- Embed kit and `/embed/...` are unchanged.

---

## Technical reference (optional)

| Bond URL | Role |
|----------|------|
| `/portal/{slug}` | Loaded inside iframe on org site (analytics) |
| `/api/host/bootstrap?slug=` | Config for `bond-host.js` |
| `/bond-host/v1.js` | Script on org site |

Register click sends `bond:open_tab` → parent opens checkout landing URL with `bondPath` query → checkout iframe loads Bond consumer.
