# Bond Discovery

Next.js app that renders sports-program **discovery pages** for Bond Sports
customers — on partner sites via the host kit (`public/bond-host/v1.js`, one
script tag + one div), as direct links (`/{slug}`), and through an `/admin`
editor. Event data comes from the Bond Public API through a cron-warmed
Vercel KV cache; page configs live in Supabase (`discovery_pages`).

- **Agent/contributor onboarding:** [`CLAUDE.md`](./CLAUDE.md)
- **Documentation index:** [`docs/README.md`](./docs/README.md)
- **Architecture:** [`docs/architecture-discovery.md`](./docs/architecture-discovery.md)
- **Ops runbook:** [`docs/runbook-discovery.md`](./docs/runbook-discovery.md)
- **Environments & env vars:** [`docs/environments.md`](./docs/environments.md)

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase (staging!) values — see docs/environments.md
npm run check:env            # reports which env vars are set (never prints values)
npm run dev                  # http://localhost:3000
```

Local dev uses an in-process memory cache (no KV needed) and supports an
admin-auth bypass (`ADMIN_AUTH_BYPASS=true`, development only).

## Commands

| Command | What |
|---|---|
| `npm run dev` | Next.js dev server (port 3000) |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:run` | Vitest unit/integration suite |
| `npm run test:e2e` | Playwright |
| `npm run lint` | ESLint (next lint) |
| `npm run check:env` | Environment variable report |

## Surfaces

| Route | What |
|---|---|
| `/{slug}` | Direct-link discovery page |
| `/portal/{slug}` | Discovery UI rendered inside the partner-site iframe (host kit) |
| `/embed/{slug}` | **Deprecated** embed-kit page (pending removal) |
| `/admin` | Page management (NextAuth Google + `ADMIN_ALLOWED_EMAILS`) |
| `/api/events`, `/api/programs`, `/api/schedule` | Public data APIs (cached) |
| `/api/cron/warm-discovery` | Cache warm cron (every 15 min, `CRON_SECRET`-gated) |

## Deployment

Vercel. Crons come from `vercel.json` (production deployments only).
Required env vars per environment: see
[`docs/environments.md`](./docs/environments.md) — Supabase URL/keys, KV
URL/token, `CRON_SECRET`, NextAuth Google credentials, `ADMIN_ALLOWED_EMAILS`.

## Onboarding product (separate surface in this repo)

- **Public checklist:** `/onboard/[slug]` — orgs use the slug from Supabase `orgs.slug`.
- **Staff admin:** `/admin/onboarding/*` — requires NextAuth (Google) and a row in `staff` with the same email as the signed-in user.
- **Schema:** apply the files under `supabase/migrations/` in order (confirm no naming clash with existing `staff` / `orgs` / `templates` tables first).
- **Env:** `SUPABASE_SERVICE_KEY` (server), `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client + Realtime), `SLACK_ONBOARDING_WEBHOOK_URL` (Slack Incoming Webhook for step-completion alerts), `NEXT_PUBLIC_APP_URL` for links in Slack messages and webhook docs in UI.
- **Webhook:** point a Supabase Database Webhook on `step_progress` UPDATE to `POST https://<your-domain>/api/webhooks/step-completed`.
- **First admin:** insert a `staff` row for your `@bondsports.co` email before using `/admin/onboarding`.

## License

Proprietary — Bond Sports.
