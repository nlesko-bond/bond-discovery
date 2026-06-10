# Bond Discovery — documentation index

Agent/contributor onboarding lives at the repo root: [`CLAUDE.md`](../CLAUDE.md).

## Operating the system

| Doc | Audience |
|-----|----------|
| [architecture-discovery.md](./architecture-discovery.md) | Engineering — request flow, cache layers, key formats, TTLs, cron warm |
| [runbook-discovery.md](./runbook-discovery.md) | On-call / support — stale pages, zero events, missing conversions, cron failures, admin lockout |
| [environments.md](./environments.md) | Operators — env vars, local/preview/production matrix, staging setup, `npm run check:env` |

## Partner-facing integration

| Doc | Audience |
|-----|----------|
| [documentation/website/discovery/guide.html](./documentation/website/discovery/guide.html) | Partners — Discovery + checkout + analytics (live: `/documentation/website/discovery/guide`) |
| [customer-setup-discovery-checkout-analytics.md](./customer-setup-discovery-checkout-analytics.md) | Same guide in Markdown + publish notes for Bond team. **The GTM/analytics event contract lives here.** |
| [partner-host-integration.md](./partner-host-integration.md) | Partners / Webflow — host kit (`bond-host/v1.js`) setup |
| [analytics-discovery-and-host-shell.md](./analytics-discovery-and-host-shell.md) | Engineering + analytics — events, GTM, internal tracking |

> **Embed kit is deprecated.** The legacy in-page embed kit
> (`public/embed-kit/v1.js`, `/embed/{slug}`, `/api/embed/*`) is still
> deployed but pending removal (plan 007). New integrations must use the host
> kit per [partner-host-integration.md](./partner-host-integration.md). The
> old operator guide is [`public/docs/webflow-embed-kit.md`](../public/docs/webflow-embed-kit.md)
> (banner-marked deprecated).

## Design / roadmap

| Doc | Status |
|-----|--------|
| [portal-session-first-design-spec.md](./portal-session-first-design-spec.md) | Phase 2 portal UI spec — still the reference for portal card/filter behavior (page templates, plan 009, not yet executed) |
| [portal-session-card-hero-design.md](./portal-session-card-hero-design.md) | Session card hero design notes |

Proposals and other notes live under [`proposals/`](./proposals/).
Superseded docs are moved to [`archive/`](./archive/) with a tombstone note.
Onboarding-product docs (`onboard_docs/`, `onboarding-retool-health-dashboard.md`) are out of discovery scope.
