# Discovery runbook

Symptom-driven fixes for live discovery pages. Background:
[architecture-discovery.md](./architecture-discovery.md) ·
[environments.md](./environments.md).

> **Verification status**: all commands below were verified against the code
> paths they exercise (routes, headers, cache keys); execute the full runbook
> once against staging when it is provisioned (see environments.md §2).

Set these once per incident:

```bash
ORIGIN="https://discovery.bondsports.co"   # or staging origin
SLUG="the-page-slug"
```

---

## "Page shows stale programs/events"

1. **Which cache tier served it?** Check the `X-Bond-Events-Cache` header:

   ```bash
   curl -sI "$ORIGIN/api/events?slug=$SLUG" | grep -i x-bond-events
   ```

   `PRECOMPUTED` = cron-written payload (normal). `HIT`/`MISS` = fallback
   pipeline (cron hasn't warmed this slug — see below). `SWR` only appears in
   `mode=availability`.

2. **When did the cron last run?** Read `discovery:cron:lastRun` via the
   admin endpoint (requires an admin session; also shown in the admin page
   editor → Data & Caching):

   ```bash
   curl -s "$ORIGIN/api/admin/cache-status?slug=$SLUG" \
     -H "Cookie: <admin session cookie>"
   # → { "cronLastRun": { at, warmed, errors, skipped, bondApi, elapsedMs }, "lastRefreshed": <ms epoch> }
   ```

   If `cronLastRun.at` is older than ~20 min, the cron is failing — see
   "Cron failing" below. If `errors` contains your slug, the warm hit the
   empty-write guard or a Bond error for that slug.

3. **Force a fresh read** (bypasses every cache, hits Bond live — slow, and
   it does NOT rewrite the precomputed payload):

   ```bash
   curl -s "$ORIGIN/api/events?slug=$SLUG&forceFresh=true" | head -c 400
   ```

   If this returns current data, the data path is fine and only the
   precomputed payload is stale.

4. **Re-warm the slug.** Any of:
   - Admin UI → page editor → Data & Caching → **Refresh now**
     (`POST /api/admin/warm?slug=$SLUG`, admin-only).
   - Save the page in the admin editor (payload-affecting saves call
     `invalidateDiscoveryResponseCache` + a bounded re-warm).
   - Run the cron manually:

     ```bash
     curl -s -H "Authorization: Bearer $CRON_SECRET" \
       "$ORIGIN/api/cron/warm-discovery"
     ```

     Note: the cron honors per-page refresh policy; an admin save or
     **Refresh now** clears `discovery:lastRefreshed:{slug}` so the page is
     due immediately.

5. **When will it fix itself?** The cron runs every 15 min (`vercel.json`);
   a page refreshes when its `features.discoveryRefreshPolicy`
   (`5min`/`15min`/`30min`/`60min`, default `15min`) elapses.

## "Page shows zero events"

- **Empty-write guard semantics** (`lib/discovery-warm.ts:92-107`): if a warm
  yields zero filtered events while the previous payload was non-empty, the
  warm REFUSES the write, logs
  `[warm-discovery] refusing empty write; keeping previous payload`, and
  reports that slug as `error` in `discovery:cron:lastRun`. So a page showing
  zero events usually means the *request fallback* returned zero (Bond
  outage/rate limit) or the page's program filters exclude everything — not a
  poisoned cache.
- **Alerting**: a full-mode request that returns zero events *with Bond 5xx
  errors* fires `maybeAlertZeroDiscoveryEvents`
  (`lib/discovery-zero-events-alert.ts`) — check that alert channel first.
- **Check Bond API health**: the cron response and `discovery:cron:lastRun`
  include `bondApi` stats (request count, `serverErrors`). Compare:

  ```bash
  curl -s "$ORIGIN/api/events?slug=$SLUG&forceFresh=true" -o /dev/null \
    -D - | grep -i x-bond-events-bond-5xxs
  ```

- **Check the page's filters**: admin editor → Programs section
  (`programFilterMode`, included/excluded program IDs) — an over-tight
  include list filters everything out *after* the precomputed read.

## "Partner says conversions missing in GA4"

Checklist, in order (contract details:
[customer-setup-discovery-checkout-analytics.md](./customer-setup-discovery-checkout-analytics.md)):

1. **GTM installed on the partner page?** The partner's own GTM snippet must
   be in their site footer — the host kit forwards into
   `window.dataLayer`, it does not load GTM.
2. **Kit serves the forwarding?** Confirm the partner loads
   `$ORIGIN/bond-host/v1.js` (not the deprecated `embed-kit/v1.js`) and that
   the served file contains the forwarder:

   ```bash
   curl -s "$ORIGIN/bond-host/v1.js" | grep -c BOND_GTM_EVENT   # expect >= 1
   ```

3. **Double-listener?** If the partner kept Bond's manual "Script 3"
   listener, the kit detects `window.__bondGtmListenerAttached` and skips its
   own forward — events should appear exactly once. If they removed Script 3
   AND the kit is old/cached, events appear zero times — hard-refresh /
   purge the partner site's script cache.
4. **GTM Preview shows the push?** Connect GTM Preview to the partner's
   published register page, complete a test checkout in the iframe, and look
   for `begin_checkout` / `purchase` in the dataLayer.
5. **Conversions only forward where the kit mounts the checkout iframe.**
   Deep links straight to `bondsports.co` are tracked by Bond's own checkout
   GTM, not the partner page.
6. **GA4 side**: Custom Event triggers exist for the event names; cross-domain
   measurement configured if the partner expects session stitching between
   their domain and the iframe.

## "Cron failing"

1. **401 Unauthorized**: `CRON_SECRET` mismatch or missing. The route fails
   closed — production with no `CRON_SECRET` configured refuses every run
   (`app/api/cron/warm-discovery/route.ts:39-45`). Check the Vercel env var
   and that Vercel cron sends `Authorization: Bearer $CRON_SECRET`.
2. **Bond rate limits**: run the cron manually (curl above) and inspect
   `bondApi` in the JSON response (`serverErrors`, request counts). Scope
   grouping should keep request volume low; many slugs sharing one scope
   produce one Bond fetch.
3. **Timeouts**: route `maxDuration` is 300s; check Vercel → Project → Logs →
   Cron for the `/api/cron/warm-discovery` invocations and any
   `[warm-discovery]` error lines.
4. **Partial failures**: per-slug `details[]` in the response and the
   `errors` array in `discovery:cron:lastRun` name the failing slugs.

## "Admin can't log in / locked out"

Auth is NextAuth Google + allowlist (`lib/admin-auth.ts`):

- The signed-in Google email must be in `ADMIN_ALLOWED_EMAILS`
  (comma-separated, case-insensitive). 401 = no session; 403 = signed in but
  not allowlisted.
- Required env vars (check in Vercel project settings; `npm run check:env`
  covers the Supabase/KV/cron vars but not the auth ones): `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` (`lib/auth.ts:10-11,55`),
  `ADMIN_ALLOWED_EMAILS`.
- **Dev-only bypasses**: `ADMIN_AUTH_BYPASS=true` (server) or
  `NEXT_PUBLIC_ADMIN_AUTH_BYPASS` (`lib/admin-auth-bypass.ts`) skip auth, but
  never outside development (`NODE_ENV` guards). There is no production
  bypass by design — fix the env vars instead.
