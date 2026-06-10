# Plan 001: Require authentication on the page-config API

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- app/api/pages lib/admin-auth* middleware.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (locking out the admin UI itself is the main hazard — mitigated by a bypass env var that already exists)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

The discovery pages are live in production, and the API that creates, updates, and deletes their configurations is completely unauthenticated. Anyone who discovers the URL can `POST /api/pages` to create pages, `PATCH /api/pages/{slug}` to change a live customer's branding/registration URLs/GTM ID, or `DELETE /api/pages/{slug}` to take a live page down. The page config controls what JavaScript-adjacent settings (GTM container IDs, registration URLs) are served to end users, so this is also an injection vector into customer sites. This is the single highest-leverage security fix in the repo.

## Current state

- `app/api/pages/route.ts` — GET (list) + POST (create). POST has the comment at line 24: `// Note: Auth temporarily disabled for easier setup` / `// TODO: Re-enable when Google OAuth is configured`.
- `app/api/pages/[slug]/route.ts` — GET, PATCH (line 34: `// Note: Auth temporarily disabled for easier setup`), DELETE (line 64, same comment). PATCH also logs the full request body features at lines 38–39 (`console.log('[PATCH] Received features:', ...)`) — remove these debug logs while here.
- The repo already depends on `next-auth@^4.24.13` (see `package.json`). Search for existing auth wiring before building anything new: run `grep -rn "next-auth\|getServerSession\|NEXTAUTH" app lib --include="*.ts" --include="*.tsx" -l`. The admin UI may already have a session provider and/or a `NEXT_PUBLIC_ADMIN_AUTH_BYPASS` dev flag (referenced in docs) — reuse whatever exists.
- The admin UI at `app/admin/pages/**` calls these routes with plain `fetch` (no auth header), so cookie/session-based auth (next-auth) is the right mechanism — a static bearer token would require touching every admin fetch call.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Install   | `npm install`        | exit 0              |
| Typecheck | `npm run typecheck`  | exit 0, no errors   |
| Tests     | `npm run test:run`   | all pass            |
| Lint      | `npm run lint`       | exit 0              |
| Build     | `npm run build`      | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `app/api/pages/route.ts`
- `app/api/pages/[slug]/route.ts`
- `lib/admin-auth.ts` (create — shared guard helper)
- `__tests__/api/pages-auth.test.ts` (create)
- Any existing next-auth route/config file you find during Step 1 (extend, don't replace)

**Out of scope** (do NOT touch):
- `app/api/events/route.ts`, `app/api/host/bootstrap/route.ts`, `app/api/programs/route.ts` — these are public, consumed by partner sites cross-origin; adding auth to them breaks live pages.
- The admin UI pages themselves (`app/admin/**`) beyond what login wiring strictly requires.
- `app/api/cron/warm-discovery/route.ts` — its auth is handled in plan 002.

## Git workflow

- Branch: `advisor/001-secure-pages-api`
- Commit style: conventional commits, e.g. `fix(api): require admin session on page-config mutations` (matches repo history: `feat(onboarding): ...`, `fix(onboarding): ...`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory existing auth

Run `grep -rn "next-auth\|getServerSession\|NEXTAUTH\|ADMIN_AUTH_BYPASS" app lib middleware.ts 2>/dev/null`. Record what exists:
- If a next-auth route (`app/api/auth/[...nextauth]/route.ts`) and provider config already exist, reuse them.
- If nothing exists, create a minimal next-auth setup with the Google provider, restricted to a configured email domain/allowlist via env vars `ADMIN_ALLOWED_EMAILS` (comma-separated) — do NOT hardcode emails.

**Verify**: the grep output is recorded in your final report; `npm run typecheck` → exit 0.

### Step 2: Create the shared guard

Create `lib/admin-auth.ts` exporting:

```ts
import { getServerSession } from 'next-auth';

/** Returns null when authorized; a NextResponse 401/403 otherwise. */
export async function requireAdmin(): Promise<Response | null> {
  if (process.env.ADMIN_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return null; // local development bypass — never active in production
  }
  const session = await getServerSession(/* your authOptions from step 1 */);
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const allowed = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(session.user.email.toLowerCase())) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
```

The production guard must fail closed: if auth config is missing in production, mutations return 401 — never silently allow.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Guard the mutation handlers

In `app/api/pages/route.ts` POST and `app/api/pages/[slug]/route.ts` PATCH and DELETE, add as the first statement:

```ts
const denied = await requireAdmin();
if (denied) return denied;
```

Remove the `// Note: Auth temporarily disabled` comments and the two `console.log('[PATCH] ...')` debug lines at `app/api/pages/[slug]/route.ts:38-39`. Leave both GET handlers unauthenticated for now (the admin UI reads them pre-login and they expose no secrets beyond config; tightening reads is a follow-up — see Maintenance notes).

**Verify**: `npm run typecheck` → exit 0; `grep -rn "Auth temporarily disabled" app/` → no matches.

### Step 4: Tests

Create `__tests__/api/pages-auth.test.ts` (vitest; model the mocking style on `__tests__/lib/config.test.ts`). Mock `next-auth`'s `getServerSession`. Cases:
1. POST /api/pages with no session → 401.
2. PATCH /api/pages/[slug] with no session → 401.
3. DELETE /api/pages/[slug] with no session → 401.
4. PATCH with a session whose email is in `ADMIN_ALLOWED_EMAILS` → handler proceeds (mock `updatePageConfig` to avoid Supabase).
5. Session email NOT in allowlist → 403.
6. `ADMIN_AUTH_BYPASS=true` + `NODE_ENV=production` → still 401 (bypass must not work in production).

**Verify**: `npm run test:run` → all pass including 6 new tests.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run test:run` exits 0; 6 new auth tests pass
- [ ] `grep -rn "Auth temporarily disabled" app/` returns nothing
- [ ] `grep -n "console.log('\[PATCH\]" app/api/pages/[slug]/route.ts` returns nothing
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- You find an existing, *different* auth mechanism (e.g. middleware-based) already protecting `/api/pages` — the finding may be stale.
- Wiring next-auth requires changing more than ~3 admin UI files (login flow redesign is out of scope — report what's needed instead).
- The admin UI cannot reach the API at all after the change with the dev bypass enabled (`ADMIN_AUTH_BYPASS=true npm run dev` should still allow editing locally).
- The code at the cited lines doesn't match the excerpts.

## Maintenance notes

- Follow-up (deferred): also guard GET list/detail once the admin UI always has a session, and add CSRF notes if any non-admin surface starts calling these routes.
- Deployment requires env vars in Vercel: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, Google OAuth client ID/secret, `ADMIN_ALLOWED_EMAILS`. List these in the PR description.
- Reviewer should scrutinize: the bypass must be impossible in production (test 6).
