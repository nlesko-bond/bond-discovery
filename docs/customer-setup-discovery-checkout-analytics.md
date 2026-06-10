# Bond Discovery, Checkout & Analytics — Partner Setup

**Public URL:** https://discovery.bondsports.co/documentation/website/discovery/guide

**Source HTML (paste into admin):** `docs/documentation/website/discovery/guide.html`

**Publish:** Bond admin → Documentation → path `website/discovery/guide` → paste HTML → Save (Active).

---

One guide: embed programs on your site, open checkout on your domain, and measure both.

---

## What you need

- Bond Discovery admin access (your page **slug**)
- A website where you can add footer code and two pages (e.g. Webflow)
- A **Google Tag Manager** container (`GTM-XXXXXX`) linked to **GA4**
- Bond support if checkout iframe is blank (embed must be allowed)

---

## How it works

| Your page | What loads |
|-----------|------------|
| `/programs` (example) | Bond programs in an iframe |
| `/register?bondPath=…` (example) | Bond checkout in an iframe (new tab after Register click) |

**Footer on your site:** two things — Bond embed script **and** your GTM snippet (same container ID everywhere).

**Bond admin:** your GTM ID so Bond can fire **Register** and other events from inside the programs iframe.

---

## Step 1 — Bond admin: Discovery page

1. Open **Pages → your slug**.
2. Confirm org, branding, programs, and filters.
3. **Embed → Partner host shell** — set:

| Field | Example |
|-------|---------|
| Partner site URL | `https://yoursite.com` |
| Bond checkout domain | `https://bondsports.co` |
| Programs page path | `/discovery/programs` |
| Checkout page path | `/discovery/register` |

Paths must match the pages you create in Step 4.

---

## Step 2 — Bond admin: Analytics

1. Same page → **Analytics** (or partner group).
2. Enter your **GTM container ID** (`GTM-XXXXXX`).
3. Save.

Bond loads this container inside the programs iframe and pushes events (e.g. `click_register`) with **program/session IDs and names**.

---

## Step 3 — Your site footer (every page)

Add **both** snippets in **Project settings → Custom code → Footer** (or equivalent).

### A. Bond host script (required for embed)

```html
<script src="https://discovery.bondsports.co/bond-host/v1.js" defer></script>
```

### B. Google Tag Manager (required for analytics)

Use the **same** container ID as Step 2. Paste the install snippet from GTM (**Admin → Install Google Tag Manager**):

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
<!-- End Google Tag Manager -->
```

Replace `GTM-XXXXXXX` with your ID.

**Why both?** Bond script runs the embed. GTM on **your** domain records pageviews on your URLs (`/programs`, `/register`). Bond admin GTM ID records register clicks from inside the iframe.

**No extra listener script needed:** the Bond host script automatically forwards Bond checkout conversion events (`BOND_GTM_EVENT` messages — e.g. `begin_checkout`, `select_payment_method`, `purchase`) into your page's `dataLayer`. You only need GTM installed (the snippet above) plus your GTM/GA4 tag configuration per Bond's help-center articles 11139263 / 12580240. If you previously pasted Bond's manual "Script 3" listener, you can keep it — the host script detects it (via `window.__bondGtmListenerAttached`) and will not double-fire — but new setups should omit Script 3.

---

## Step 4 — Two pages on your site

### Programs page

Add an **Embed** block:

```html
<div
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
  data-bond-chrome-offset-px="80"
  data-bond-chrome-offset-px-mobile="64"
></div>
```

- Replace `YOUR_SLUG` with your Bond page slug.
- `data-bond-chrome-offset-px` = your fixed header height in px (desktop).
- Use `-mobile` if mobile header height differs.
- Do not wrap in a fixed-height box or `overflow: hidden`.

### Register page

Same embed (adjust offset if needed):

```html
<div
  data-bond-host
  data-bond-slug="YOUR_SLUG"
  data-bond-discovery-base="https://discovery.bondsports.co"
  data-bond-chrome-offset-px="80"
></div>
```

**Publish** the site. Preview mode often skips embed scripts.

---

## Step 5 — GTM: GA4 tags (in tagmanager.google.com)

1. **Tag:** GA4 Configuration → your Measurement ID → trigger **All Pages** (pageviews on your domain).
2. **Tag:** GA4 Event → event name `click_register` → trigger **Custom Event** `click_register`.
3. Map Data Layer variables to GA4 parameters:

| Data layer key | GA4 parameter |
|----------------|---------------|
| `program_id` | `program_id` |
| `program_name` | `program_name` |
| `session_id` | `session_id` |
| `session_name` | `session_name` |
| `product_id` | `product_id` |

4. Optional: repeat for `click_redeem_pass` (Schedule tab).
5. **Checkout conversions:** configure GA4 ecommerce tags for `begin_checkout`, `select_payment_method`, and `purchase` (Custom Event triggers; the payloads use the standard GA4 ecommerce shape) per Bond's help-center articles 11139263 / 12580240. The host script pushes these into your `dataLayer` automatically (see Step 3).

**Tip:** If you see two pageviews on the programs page (your page + iframe), restrict the GA4 Configuration tag to fire only when **Page Hostname** equals your site domain.

---

## Step 6 — Test

| Check | Pass? |
|-------|-------|
| Programs page shows sessions | |
| Register opens a **new tab** on your `/register` URL | |
| Checkout loads (not blank) | |
| GTM Preview: click Register → `click_register` with IDs **and** names | |
| GTM Preview on your `/register` page: complete a test checkout → `begin_checkout` / `purchase` in your `dataLayer` | |
| GA4 Realtime: pageview on your `/programs` URL | |

Use **published** URLs. In GTM Preview, connect to your live programs page and click **inside** the Bond embed.

---

## What Bond tracks for you

| Event | When | Payload includes |
|-------|------|------------------|
| `click_register` | Register clicked on programs page | `program_id`, `program_name`, `session_id`, `session_name`, `product_id` |
| `click_redeem_pass` | Redeem on Schedule tab | program/session IDs and names |
| Pageview (GA4) | Your GTM on your footer | Your page URLs |
| Checkout conversions (`begin_checkout`, `select_payment_method`, `purchase`, +12 more) | Inside the checkout iframe on your register/discovery pages | Forwarded automatically by the host script into your `dataLayer` (GA4 ecommerce shape, e.g. `transaction_id`, `currency`, `value`, `items`) |

**Limitation:** conversion events are forwarded only on pages where the host script mounts the checkout iframe (your discovery/landing pages). If you deep-link users directly to `bondsports.co` (no iframe), conversions are tracked by GTM configured inside Bond checkout itself, not by your page.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No events in GA4 | GTM ID saved in Bond admin; GTM snippet in footer; tags published |
| Register tab 404 | Register page exists; checkout path matches Bond admin |
| Blank checkout | Bond must allow iframe embed — contact support |
| No `purchase` events | GTM snippet on the register page footer; checkout actually loads in the iframe (not a direct `bondsports.co` link) |
| Footer cut off on register | Increase `data-bond-chrome-offset-px` |
| White gap above programs | Lower or remove chrome offset; remove extra top padding in Webflow |

---

## Bond reference

| Item | URL |
|------|-----|
| Discovery host | `https://discovery.bondsports.co` |
| Host script | `/bond-host/v1.js` |
| Direct discovery link (unchanged) | `https://discovery.bondsports.co/{slug}` |

**Support:** Bond account team · Internal engineering doc: `docs/analytics-discovery-and-host-shell.md`
