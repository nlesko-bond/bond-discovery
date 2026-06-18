# Bond Labs — Setup & Capabilities Guide

*For humans and AI agents. Self-contained: everything you need is on this page.*

**Bond Labs** (https://labs.bondsports.co) is Bond's internal platform for building and hosting tools, dashboards, prototypes, and demos. Drop a folder of HTML, get a live SSO-protected site with zero-config APIs: a database, file storage, AI, realtime channels, and read-only access to Bond's data.

---

## What it CAN do

| Capability | How |
|---|---|
| Host a site from a folder or single HTML file | Drag onto the homepage, or `labs deploy` via CLI, or `deploy_site` via MCP |
| Keep every deploy as a version, roll back in one click | Site page → Version history |
| Share a site publicly (no Bond login) | Site page → Visibility → Make public. Default is private (Bond SSO only) |
| Let anyone at Bond edit any site | Edit button → Text mode (click text and type; click images to replace; drag-drop images; select text to add links). Every edit = attributed version |
| Store JSON data per site | `labs.db.collection('items').create({...})` in any page — no keys needed |
| Upload/serve files | `labs.fs.upload(file)` |
| Call Claude from any page | `await labs.ai.chat({messages:[...]})` — key lives server-side |
| Realtime multiplayer/presence | `labs.realtime.channel('room')` |
| Query Sigma (governed warehouse data) | `labs.data.sigma.workbooks() / elements(wb) / query(wb, el)` — results cached 10 min |
| Query production Postgres read-only | `labs.data.pg.query('SELECT ...')` + `labs.data.pg.schema()` — SELECT-only enforced by parser AND a read-only DB role AND the Aurora reader endpoint |
| **Generate SQL from plain English** | `labs.data.ask("top facilities by registrations this quarter")` → `{sql, explanation, grounding}` — grounded in the live schema + knowledge mined from Bond's backend code (camelCase columns, soft-delete filters, enum meanings, the LineItems→Invoices org join). Never auto-executes |

## What it CANNOT do

- **Write to any production system.** The Postgres path is read-only three times over; there is no write API to Bond data.
- **Be reached by non-Bond users** unless a site owner explicitly flips that site to public.
- **Run server code you upload.** Sites are static files + the platform APIs. (Apps needing custom backends use `labs.db`/`labs.ai` instead.)
- **Exceed limits**: 50 MB/file, 100 MB/site, 500 files; AI 50 req/h/person; data queries 30/h; ask 20/h. Everything data-related is audit-logged per person.

---

## Setup — Human (2 minutes)

1. Open https://labs.bondsports.co and sign in with your Bond Google account.
2. Drag any folder containing an `index.html` (or a single HTML file) onto the page. That's it — your site is live at a private URL.
3. Optional, for CLI/agents: mint a token at https://labs.bondsports.co/token and keep it safe.

## Setup — AI agent (Claude Code, Cursor, any MCP client)

Run once (replace `<token>` with one from https://labs.bondsports.co/token):

```bash
claude mcp add --transport http bond-labs https://labs.bondsports.co/api/mcp \
  --header "Authorization: Bearer <token>" -s user
```

Verify: `claude mcp list` should show **bond-labs** with 13 tools:
`whoami`, `list_sites`, `get_site`, `deploy_site`, `site_history`, `rollback_site`, `set_visibility`, `sigma_workbooks`, `sigma_elements`, `sigma_query`, `pg_query`, `pg_schema`, `ask_data`.

Then just talk: *"Build me a one-page dashboard of registrations by program type using ask_data to write the SQL, then deploy it to Labs as 'reg-dashboard'."* The agent can generate the SQL, build the page against `labs.data`, deploy it, and hand back the live URL.

For Cursor: run `labs connect cursor` in a project, or see https://labs.bondsports.co/connect for all editors.

---

## Test drive checklist (10 minutes, in order)

1. **Deploy**: drag a folder/HTML file onto the homepage → live URL appears.
2. **Share**: site page → Make public → open the link in an incognito window.
3. **Edit together**: site page → Edit → Text mode → click a sentence and retype it → Save → see v2 in Version history with your name → Roll back → roll forward.
4. **Ask your data** (works today, no DB connection needed):
   ```bash
   curl -s -X POST https://labs.bondsports.co/api/data/ask \
     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -d '{"question": "monthly registrations by program type this year"}'
   ```
   You get back `{sql, explanation, grounding}`. `grounding: "knowledge-only"` means generated from Bond's codebase knowledge; `"live-schema"` means verified against the connected database.
5. **Run real queries** (once `LABS_PG_URL` is configured — see below):
   ```bash
   curl -s -X POST https://labs.bondsports.co/api/data/pg/query \
     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -d '{"sql": "SELECT COUNT(*) AS orgs FROM \"Organizations\""}'
   ```
6. **Agent loop**: with the MCP server added, ask Claude Code to list your sites, then build and deploy something using `ask_data`.

---

## Data sources at a glance

| Source | Status | What it is |
|---|---|---|
| **Sigma** | Live when `SIGMA_CLIENT_ID/SECRET` env vars are set | Governed reporting data (same engine as Bond's Sigma reports). Cached 10 min; deploys never trigger queries |
| **Postgres (production reader)** | Live when `LABS_PG_URL` is set | Direct read-only SQL against the Aurora *reader* endpoint. Connection string format: `postgresql://labs_ro:<URL-ENCODED-password>@bond-prod-2024-07-cluster.cluster-ro-c0xj0bub6kzi.us-east-2.rds.amazonaws.com:5432/<dbname>?sslmode=require` — note special characters in the password must be percent-encoded (`!` → `%21`) |
| **Snowflake** | Future | Planned; use Sigma for warehouse data today |

Safety model for all data access: SELECT-only SQL parser gate → read-only database role → (for pg) a reader endpoint that physically cannot write → per-user rate limits → full audit log (`who asked what, when, how many rows`).

## Key URLs

- Platform: https://labs.bondsports.co · Sites gallery: /explore · Docs: /docs · Editor setup: /connect · Tokens: /token
- Code: https://github.com/nlesko-bond/bond-labs (private). Local dev: `npm i && LABS_AUTH_BYPASS=true npm run dev` (runs fully in-memory).
- Sister app: Bondy's Burrow (drop-and-share for decks/clips) — https://burrow.bondsports.co
