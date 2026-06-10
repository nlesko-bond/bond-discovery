# Plan 004: Trim discovery GTM events to a minimal, Bond-pattern-aligned set

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e46af2c..HEAD -- components/analytics/GoogleTagManager.tsx lib/host-shell/registration-analytics.ts lib/analytics.ts components/host-shell/`
> On mismatch with the "Current state" excerpts, treat as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (removing events partners may have built GTM triggers on; mitigated by keeping the two that matter and documenting the change)
- **Depends on**: plans/003-host-kit-gtm-conversion-bridge.md (the conversion funnel must exist before discovery-side events are trimmed, so partners never lose visibility)
- **Category**: analytics / tech-debt
- **Planned at**: commit `e46af2c`, 2026-06-10

## Why this matters

The operator's directive: keep discovery-page GA4/GTM events to a minimum — essentially clicks — and let Bond's checkout events (plan 003) carry the conversion funnel. Today `components/analytics/GoogleTagManager.tsx` defines **11 event types** (`page_view`, `view_program`, `view_session`, `click_register`, `click_redeem_pass`, `filter_applied`, `view_mode_changed`, `schedule_view_changed`, `share_link`, `click_event`, plus context pushes), all fired *inside the discovery iframe*. This bloats partner GA4 properties with low-value noise, inflates page_view counts (iframe loads count as views on the partner's container), and makes the funnel confusing next to Bond's official 15 checkout events. The target end state: the discovery surface emits exactly two GTM events — `page_view` (once, on load) and `click_register` — plus Bond-internal analytics (which is a separate, server-side system and stays unchanged).

## Current state

- `components/analytics/GoogleTagManager.tsx`:
  - Lines 25–83: `GoogleTagManager` component loads Bond's system GTM container (`NEXT_PUBLIC_BOND_GTM_ID`) AND the partner's `gtm_id` (from page config) into the **iframe document** (the discovery pages render at `/{slug}` and `/portal/{slug}`; the portal route runs inside the host-kit iframe).
  - Lines 88–231: `gtmEvent` object with the 11 push helpers listed above.
- `lib/host-shell/registration-analytics.ts:127-153` — `trackHostShellRegisterClick()` fires `gtmEvent.clickRegister(...)` + `bondAnalytics.clickRegister(...)` on register clicks; keeps working as-is.
- `lib/analytics.ts` — Bond-internal analytics (POSTs to `/api/analytics/track`). **Do not touch** — internal product analytics is intentionally richer than partner GTM.
- Call sites of `gtmEvent.*` are spread across discovery components. Find them all: `grep -rn "gtmEvent\." app components lib --include="*.ts" --include="*.tsx"`.
- The decision already made by the operator (do not re-litigate): keep `click_register` and a single `page_view`; everything else goes. `click_redeem_pass` is the one judgment call — it is a registration-intent click, equivalent to click_register for pass holders. **Keep it** (it's a click, which matches the directive).

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `npm run typecheck`  | exit 0              |
| Tests     | `npm run test:run`   | all pass            |
| Lint      | `npm run lint`       | exit 0              |
| Build     | `npm run build`      | exit 0              |

## Scope

**In scope**:
- `components/analytics/GoogleTagManager.tsx`
- All call sites of removed `gtmEvent.*` helpers (components under `components/`, `app/`)
- `__tests__/lib/host-shell/registration-analytics.test.ts` (extend if needed)
- `docs/customer-setup-discovery-checkout-analytics.md` (document the final event list)

**Out of scope**:
- `lib/analytics.ts` and `/api/analytics/track` — Bond-internal analytics keeps all its events.
- `public/bond-host/v1.js` — plan 003 owns it.
- Removing the partner-GTM-inside-iframe loading itself. That is a real architectural question (events fire on the discovery domain inside an iframe → cross-domain attribution depends on partner GA4 configuration), but moving event emission to the parent page via postMessage is a bigger change. Record it as a follow-up; do not attempt it here.

## Git workflow

- Branch: `advisor/004-minimal-gtm-events`
- Commit: `refactor(analytics): trim partner GTM events to page_view + register clicks`

## Steps

### Step 1: Inventory call sites

Run `grep -rn "gtmEvent\.\(viewProgram\|viewSession\|filterApplied\|viewModeChanged\|scheduleViewChanged\|shareLink\|clickEvent\|push\)" app components lib --include="*.tsx" --include="*.ts"` and list every call site. (Also grep `gtmEvent.pageView` to see where page_view fires today and confirm it fires once per load, not per navigation/filter.)

**Verify**: the inventory is in your report; no call site is in `app/embed/` only — if some are, note them for plan 007 instead of fixing twice.

### Step 2: Remove the noise events

In `components/analytics/GoogleTagManager.tsx`, delete the helpers `viewProgram`, `viewSession`, `filterApplied`, `viewModeChanged`, `scheduleViewChanged`, `shareLink`, `clickEvent` from `gtmEvent` (lines ~114–230). Keep: `push` (generic escape hatch), `pageView`, `clickRegister`, `clickRedeemPass`. Then remove every call site found in Step 1 — delete the `gtmEvent.X(...)` call only; if the same handler also calls `bondAnalytics.X(...)`, **leave the bondAnalytics call** (internal analytics keeps full fidelity).

**Verify**: `npm run typecheck` → exit 0; `grep -rn "gtmEvent.viewProgram\|gtmEvent.filterApplied\|gtmEvent.viewModeChanged\|gtmEvent.scheduleViewChanged\|gtmEvent.shareLink\|gtmEvent.clickEvent\|gtmEvent.viewSession" app components lib` → no matches.

### Step 3: Make page_view single-fire and clearly scoped

Confirm `gtmEvent.pageView` is called exactly once per page load (typically in the discovery page client component's mount effect). If it fires on view-mode changes or filter changes, restrict to mount. Add `page_location` and `page_referrer: document.referrer` to the payload so partner GA4 can distinguish iframe context.

**Verify**: `grep -rn "gtmEvent.pageView" app components` → call sites only in mount-effect contexts (cite them in your report).

### Step 4: Document the contract

Update `docs/customer-setup-discovery-checkout-analytics.md` with the final discovery-surface event list and parameters:
- `page_view` — `{ page_path, page_title, page_location, page_referrer }`
- `click_register` — `{ program_id, program_name, session_id?, session_name?, product_id?, price?, currency }`
- `click_redeem_pass` — `{ event_id, program_id, program_name, session_id?, session_name? }`
- Plus (from plan 003) all Bond checkout events forwarded via `BOND_GTM_EVENT`.
Include a migration note: the seven removed event names, and that any partner GTM triggers built on them stopped receiving data as of this release.

**Verify**: the doc lists exactly these events; `npm run build` → exit 0.

## Test plan

- Extend/create `__tests__/lib/host-shell/registration-analytics.test.ts` (one exists for registration-analytics — check `__tests__/lib/host-shell/`): assert `trackHostShellRegisterClick` still pushes a `click_register` dataLayer event with program/session/product ids (jsdom: set `window.dataLayer = []`, call, assert).
- Add a test asserting the removed helpers no longer exist on `gtmEvent` (type-level: `npm run typecheck` already enforces this at call sites).
- `npm run test:run` → all pass.

## Done criteria

- [ ] `npm run typecheck` && `npm run test:run` && `npm run build` all exit 0
- [ ] `gtmEvent` exports exactly: `push`, `pageView`, `clickRegister`, `clickRedeemPass`
- [ ] Grep for removed helper names across `app components lib` returns no matches
- [ ] Docs updated with the final event contract and migration note
- [ ] `lib/analytics.ts` unchanged (`git diff --stat lib/analytics.ts` → empty)
- [ ] `plans/README.md` status row updated

## STOP conditions

- A removed event turns out to feed Bond-internal reporting through GTM (i.e., Bond's own system container `NEXT_PUBLIC_BOND_GTM_ID` has tags built on `view_program` etc.). You cannot verify GTM container contents from this repo — flag this in your report and get operator confirmation BEFORE deleting; if unreachable, implement behind a config flag (`features.minimalGtmEvents`, default true) instead of hard deletion.
- Any call site is in a file with merge conflicts or mid-refactor duplicates (`* 2.ts` files) — report which copy is live before editing.

## Maintenance notes

- Follow-up (explicitly deferred): emit `page_view`/`click_register` from the **parent page** via the host kit (postMessage, same channel as plan 003) instead of loading partner GTM inside the iframe. That fixes cross-domain attribution properly; revisit after plan 003 ships and partner feedback arrives.
- Reviewer should scrutinize: that no `bondAnalytics.*` call was accidentally removed alongside a `gtmEvent.*` call.
