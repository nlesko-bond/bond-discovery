# Plan 003: Make the host kit forward Bond checkout conversion events to the partner's dataLayer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- public/bond-host/v1.js lib/host-shell/bootstrap.ts lib/host-shell/constants.ts docs/partner-host-integration.md docs/customer-setup-discovery-checkout-analytics.md`
> On mismatch with the "Current state" excerpts, treat as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (the kit runs on live partner pages; a JS error in v1.js breaks discovery for every partner — change must be additive and defensive)
- **Depends on**: none (but coordinate with plan 004, which touches the same analytics docs)
- **Category**: bug / analytics
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

Bond's officially documented conversion-analytics integration (Intercom articles 11139229 "Getting Started: Conversion Analytics" and 12580240 "Setup: Google Tag Manager + GA4") works like this: the Bond checkout page, running in an iframe on `https://bondsports.co`, posts `window.postMessage` messages of shape `{ type: 'BOND_GTM_EVENT', dataLayerEvent: {...} }` to its parent. The parent page (the facility customer's website) must run a small listener that validates `event.origin === 'https://bondsports.co'` and pushes `dataLayerEvent` into `window.dataLayer` — pushing `{ ecommerce: null }` first whenever the payload contains an `ecommerce` object. This delivers 15 events including the money ones: `begin_checkout`, `select_payment_method`, and `purchase` (GA4-standard ecommerce shape, e.g. `{ event: 'purchase', ecommerce: { transaction_id, currency, value, items: [...] } }`).

The host kit (`public/bond-host/v1.js`) mounts the Bond checkout in exactly such an iframe — but its message handler only processes resize/open-tab/chrome-offset messages and **drops every `BOND_GTM_EVENT`**. Unless a partner separately pasted "Script 3" from the help article, every checkout conversion that happens inside a kit-mounted iframe is invisible to the partner's GA4/GTM. The whole point of the kit is one-off setup; conversion forwarding must be built in.

## Current state

- `public/bond-host/v1.js` — a single-file IIFE, ES5-style (`var`, prototypes), no build step, served statically. The message handler:

```js
// public/bond-host/v1.js:219-247
BondHostShell.prototype.onMessage = function (event) {
  var boot = this.bootstrap;
  if (!boot || !event.data || typeof event.data !== 'object') return;
  var allowed = [boot.discoveryOrigin, boot.consumerOrigin];
  if (allowed.indexOf(event.origin) === -1) return;

  var data = event.data;
  if (data.type === MSG_OPEN_TAB && typeof data.path === 'string') { ... }
  if (data.type === MSG_REQUEST_CHROME_OFFSET && event.source) { ... }
  if ((data.type === MSG_RESIZE || data.type === MSG_RESIZE_LEGACY) && typeof data.height === 'number') { ... }
};
```

- `boot.consumerOrigin` comes from `/api/host/bootstrap` (built in `lib/host-shell/bootstrap.ts`); it is the origin the checkout iframe is mounted from (`mountCheckout`, v1.js:176–189: `var src = boot.consumerOrigin.replace(/\/$/, '') + path + ...`). The default lives in `lib/host-shell/constants.ts` (`DEFAULT_BOND_CONSUMER_ORIGIN`).
- The checkout can also load via the partner's landing page in a **new tab** (`openRegistrationTab`, v1.js:191–203): the kit on the landing page reads `?bondPath=...` and mounts the checkout iframe there — so a listener added to the kit covers the new-tab flow too, as long as the landing page also includes the kit (it must, by design).
- Message constants are declared at v1.js:12–19.
- Docs that tell partners how to set this up: `docs/partner-host-integration.md` and `docs/customer-setup-discovery-checkout-analytics.md`.
- There are no existing tests for v1.js (it's a plain static file; vitest + jsdom can still load and exercise it).

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0 (v1.js is not typechecked, but route/lib edits are) |
| Tests     | `npm run test:run`   | all pass            |
| Lint      | `npm run lint`       | exit 0              |
| Syntax check | `node --check public/bond-host/v1.js` | exit 0 |

## Scope

**In scope**:
- `public/bond-host/v1.js`
- `__tests__/lib/host-shell/bond-host-kit.test.ts` (create)
- `docs/partner-host-integration.md`, `docs/customer-setup-discovery-checkout-analytics.md` (update the analytics section)

**Out of scope**:
- `components/analytics/GoogleTagManager.tsx` and the discovery iframe's internal events — plan 004 handles those.
- `public/embed-kit/v1.js` — being removed (plan 007); do not add the listener there.
- The Bond checkout/consumer app itself (different repo) — the `BOND_GTM_EVENT` sender side already exists per Bond's docs.

## Git workflow

- Branch: `advisor/003-host-kit-gtm-bridge`
- Commit: `feat(host-kit): forward BOND_GTM_EVENT checkout conversions to partner dataLayer`

## Steps

### Step 1: Add the forwarding branch to onMessage

In `public/bond-host/v1.js`, add a constant near line 19:

```js
var MSG_GTM_EVENT = 'BOND_GTM_EVENT';
```

Then in `BondHostShell.prototype.onMessage`, after the existing origin allowlist check (which already restricts to `boot.discoveryOrigin` / `boot.consumerOrigin` — this satisfies Bond's documented origin check, generalized to the configured consumer origin), add **before** the resize branch:

```js
if (data.type === MSG_GTM_EVENT) {
  this.forwardGtmEvent(data, event.origin);
  return;
}
```

And add the method (defensive — must never throw into the partner page):

```js
BondHostShell.prototype.forwardGtmEvent = function (data, origin) {
  try {
    // Conversion events come only from the Bond checkout (consumer origin).
    if (origin !== this.bootstrap.consumerOrigin) return;
    var payload = data.dataLayerEvent;
    if (!payload || typeof payload !== 'object' || typeof payload.event !== 'string') return;
    window.dataLayer = window.dataLayer || [];
    if (window.__bondGtmListenerAttached) return; // partner already runs Bond's manual listener; avoid double-push
    if (payload.ecommerce) {
      window.dataLayer.push({ ecommerce: null }); // GA4: clear previous ecommerce object
    }
    window.dataLayer.push(payload);
  } catch (e) {
    /* analytics must never break the partner page */
  }
};
```

Notes on the two guards:
- `window.__bondGtmListenerAttached` is the exact sentinel Bond's documented manual "Script 3" sets (`if (window.__bondGtmListenerAttached) return; window.__bondGtmListenerAttached = true;`). Checking it prevents double-pushing `purchase` events on partner sites that already installed the manual listener. Do not set the sentinel from the kit — the kit's guard is its own code path.
- The payload is pushed **verbatim** — do not rename events or fields; GTM tags are configured against Bond's documented names.

**Verify**: `node --check public/bond-host/v1.js` → exit 0.

### Step 2: Tests

Create `__tests__/lib/host-shell/bond-host-kit.test.ts` (vitest, jsdom). Load the kit by reading the file and evaluating it in the jsdom window (e.g. `new Function(fs.readFileSync('public/bond-host/v1.js','utf8')).call(window)` after stubbing `fetch` for the bootstrap call), or instantiate the handler logic by dispatching `MessageEvent`s. Cases:

1. A `MessageEvent` with `origin = consumerOrigin`, `data = { type: 'BOND_GTM_EVENT', dataLayerEvent: { event: 'purchase', ecommerce: { transaction_id: 't1', value: 50, currency: 'USD', items: [] } } }` → `window.dataLayer` receives `{ ecommerce: null }` then the payload, in that order.
2. Non-ecommerce event (`{ event: 'log_in' }`) → pushed without a preceding `{ ecommerce: null }`.
3. Wrong origin (`https://evil.example`) → nothing pushed.
4. `origin = discoveryOrigin` (passes the outer allowlist but is not the consumer origin) → nothing pushed.
5. Malformed payloads (`dataLayerEvent` missing, `event` not a string) → nothing pushed, no throw.
6. `window.__bondGtmListenerAttached = true` → nothing pushed (no double-fire).
7. Existing behavior regression check: a `{ type: 'bond:resize', height: 900 }` message still resizes the active iframe.

**Verify**: `npm run test:run` → all pass.

### Step 3: Update partner docs

In `docs/partner-host-integration.md` and `docs/customer-setup-discovery-checkout-analytics.md`:
- State that the host kit now forwards Bond checkout conversion events (`BOND_GTM_EVENT`) into the page `dataLayer` automatically — partners only need GTM installed on their site (the standard GTM head/noscript snippets) plus their GTM/GA4 tag configuration per Bond's help-center articles 11139263 / 12580240.
- State explicitly: partners who previously pasted Bond's manual "Script 3" listener can keep it — the kit detects it via `window.__bondGtmListenerAttached` and will not double-fire — but new setups should omit Script 3.
- Add one limitation note: events are forwarded only on pages where the kit mounts the checkout iframe (discovery/landing pages). If a partner deep-links users directly to `bondsports.co` (no iframe), conversions are tracked by GTM configured inside Bond checkout itself, not by the partner page.

**Verify**: `grep -n "BOND_GTM_EVENT" docs/partner-host-integration.md` → at least one match.

## Test plan

Covered in Step 2 (7 tests). No existing kit tests exist; this file becomes the pattern for future kit changes.

## Done criteria

- [ ] `node --check public/bond-host/v1.js` exits 0
- [ ] `npm run test:run` exits 0; 7 new kit tests pass
- [ ] `grep -n "BOND_GTM_EVENT" public/bond-host/v1.js` shows the constant and the forward branch
- [ ] Diff to v1.js is purely additive apart from the one new `if` branch (no changes to resize/open-tab/chrome-offset logic)
- [ ] `plans/README.md` status row updated

## STOP conditions

- You find the kit ALREADY forwards `BOND_GTM_EVENT` somewhere (drift since planning) — verify with `grep -n "GTM" public/bond-host/v1.js` first; if present, report instead of duplicating.
- You discover the Bond checkout posts a different message shape than `{ type: 'BOND_GTM_EVENT', dataLayerEvent }` (check against the saved event reference or ask the operator) — do not guess at an alternative shape.
- jsdom cannot execute the kit file after two attempts at a load strategy — fall back to extracting `forwardGtmEvent` logic into a testable pure check, but report the constraint.

## Maintenance notes

- v1.js is served statically with long cache lifetimes on partner pages; after deploy, confirm the served file updated (`curl -s https://<discovery-domain>/bond-host/v1.js | grep BOND_GTM_EVENT`). Consider versioning (`/bond-host/v1.js` → content hash or `v1.1`) if cache headers prove sticky — deferred.
- If Bond ever adds new conversion events, no kit change is needed (payloads are forwarded verbatim).
- Reviewer should scrutinize: the origin guard (consumer origin only) and the no-throw guarantee.
