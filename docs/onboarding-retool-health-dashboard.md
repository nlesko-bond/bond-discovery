# Onboarding: Retool, CS health dashboard, and Slack

## Layout: source of truth

| Source | Best for |
|--------|----------|
| **Supabase `orgs`, `step_progress`, `templates`** | Ground truth for launch date, timestamps, completion %, stall logic, CSV metadata. Queryable and stable. |
| **Discovery admin / API you add later** | Retool or the health app can call a small read-only HTTP API (Bearer token) instead of sharing the service role key. |
| **Slack alerts** | Human workflow, @mentions, lightweight automations. OK as a **secondary** signal if you parse `org_id` from the notification text/blocks. |

**Recommendation:** drive the CS health dashboard from **Postgres (or a discovery read API)**, not from Slack alone. Slack text is lossy (formatting changes, edits, threading) and parsing is brittle.

Slack remains valuable for reps; messages now include **`org_id`** and **slug** in both the Block Kit payload and the **plain-text fallback** (`org_id:<uuid> slug:<slug>`) for simple regex extraction if you still want Slack-to-dashboard wiring.

## Retool + new org provisioning

Typical pattern after your Postgres script creates the Bond-side org row:

1. **Option A — Retool HTTP resource** calls a guarded Discovery endpoint (e.g. `POST /api/internal/onboarding/bootstrap-org` with a shared secret) that mirrors `createOrg`: insert `orgs`, seed `step_progress` from template, return slug + onboarding URL.
2. **Option B — SQL-only in Retool** against the same Supabase project: `INSERT INTO orgs ...` and bulk `INSERT INTO step_progress` using the template’s step count (keep in sync with app logic or call a RPC).
3. **Option C — Manual** in Discovery admin for low volume.

Option A avoids drift between Retool scripts and app rules.

## CS health dashboard integration

**Preferred:**

- Read **`orgs`** (e.g. `id`, `name`, `expected_launch_date`, `status`, `spaces_uploaded_at`, `completed_at`, `assigned_rep`).
- Join **`staff`** for rep attribution.
- Derive milestones from **`step_progress`** + template `meta` (pre-kickoff boundary) if you need “Part 1 complete” semantics in SQL or in the dashboard app.

**If the health app only listens to Slack:**

- Match `org_id` with regex on the fallback line or the `Org ID` field in blocks, e.g. `org_id:([0-9a-f-]{36})`.
- Prefer **Slack Workflow / Outgoing webhook** forwarding structured fields into your health pipeline over screen-scraping the channel history.

## Environment & webhooks checklist

- `SLACK_ONBOARDING_WEBHOOK_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
- Supabase: `step_progress` UPDATE → `/api/webhooks/step-completed`
- Supabase: `orgs` UPDATE → `/api/webhooks/org-updated` (launch date changes)
