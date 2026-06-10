# CLAUDE.md — bond-discovery

## What this is

Bond Discovery renders sports-program **discovery pages** for Bond Sports customers. A partner site adds one script tag (the **host kit**, `public/bond-host/v1.js`) and a `data-bond-host` div; the kit mounts an iframe to `/portal/{slug}`, sizes it via postMessage, opens checkout in a new tab on the partner's own URL, and forwards Bond checkout conversion events into the partner's GTM `dataLayer`. Page configs live in Supabase (`discovery_pages`), edited via the `/admin` UI. Event data comes from the Bond Public API through a cron-warmed KV cache so live pages never wait on Bond. (A legacy **embed kit** — `public/embed-kit/v1.js`, `/embed/{slug}`, `/api/embed/*` — is still deployed but DEPRECATED; new integrations use the host kit.)

## Commands

```bash
npm run dev          # next dev (http://localhost:3000)
npm run build        # next build
npm run typecheck    # tsc --noEmit
npm run test:run     # vitest run (unit/integration)
npm run test:e2e     # playwright
npm run lint         # next lint
npm run check:env    # report which env vars are set (never prints values)
```

## Load-bearing paths

| Path | Role |
|---|---|
| `public/bond-host/v1.js` | The host kit — live on partner sites. ES5, no build step, no bundler. |
| `app/portal/[slug]/` + `components/host-shell/` | Discovery UI rendered inside the partner iframe |
| `app/[slug]/`, `app/embed/[slug]/` | Direct-link page; deprecated embed-kit page |
| `app/api/events/route.ts` | Public events API (precomputed fast path + full-pipeline fallback) |
| `lib/cache.ts` | KV/memory cache, key formats, SWR helpers, invalidation |
| `app/api/cron/warm-discovery/route.ts` + `lib/discovery-warm.ts` | Cron warm pipeline (scope-grouped, empty-write guard) |
| `app/admin/pages/[slug]/` | Admin page editor (5 sections; see `sections/`) |
| `lib/config.ts` + Supabase `discovery_pages` | Page configs; saving invalidates + re-warms discovery caches |
| `lib/admin-auth.ts` | `requireAdmin()` guard for admin API mutations |

## Invariants — do not break

1. **Discovery pages are live on partner sites.** Never break the iframe resize contract (`bond:resize` / `discovery-resize` postMessages) or the public API response shapes (`/api/events`, `/api/host/bootstrap`, `/api/programs`).
2. **`discovery:response:{slug}` is written only by the warm pipeline** (`lib/discovery-warm.ts`). Never add write-through from the `/api/events` request fallback — partial rate-limited Bond fetches would poison live pages for hours. The empty-write guard (zero filtered events never overwrites a non-empty payload) must survive any refactor.
3. **Analytics events are a documented partner contract.** The discovery surface emits only `page_view`, `click_register`, `click_redeem_pass`; the host kit forwards `BOND_GTM_EVENT` checkout conversions. Don't add/rename events without updating `docs/customer-setup-discovery-checkout-analytics.md`.

## Where to read more

- `docs/README.md` — documentation index
- `docs/architecture-discovery.md` — request flow, cache layers, key formats, TTLs
- `docs/runbook-discovery.md` — symptom-driven ops runbook (stale page, zero events, missing conversions, cron failures)
- `docs/environments.md` — env vars, staging setup, `check:env`
