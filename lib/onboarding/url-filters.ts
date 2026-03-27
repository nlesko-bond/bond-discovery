/**
 * Helpers for onboarding admin list pages (orgs, dashboard) — URL params and row filters.
 */

import type { OrgDashboardRow } from '@/lib/onboarding/types';

/** Next.js searchParams values may be string | string[]; normalize to one trimmed string. */
export function searchParamString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  const raw = Array.isArray(v) ? v[0] : v;
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t === '' ? undefined : t;
}

/** Compare UUIDs / ids from PostgREST vs URL (case-insensitive). */
export function idEquals(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/** Read assigned rep id from a view row (PostgREST is snake_case; guard for stray shapes). */
export function rowAssignedRepId(row: OrgDashboardRow): string | null {
  const rec = row as OrgDashboardRow & Record<string, unknown>;
  const raw = rec.rep_id ?? rec.repId;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

/** Assigned-rep filter: when a rep is selected, only rows with that rep_id match. */
export function passesRepFilter(
  rowRepId: string | null | undefined,
  filterRepId: string | undefined
): boolean {
  if (!filterRepId) return true;
  if (rowRepId == null || String(rowRepId).trim() === '') return false;
  return idEquals(rowRepId, filterRepId);
}

/** Completion % bucket filter (dashboard / orgs). */
export function matchesCompletionRange(row: OrgDashboardRow, range: string | undefined): boolean {
  if (!range) return true;
  const pct = Number(row.completion_pct ?? 0);
  switch (range) {
    case '0-25':
      return pct >= 0 && pct <= 25;
    case '25-50':
      return pct > 25 && pct <= 50;
    case '50-75':
      return pct > 50 && pct <= 75;
    case '75-100':
      return pct > 75 && pct <= 100;
    default:
      return true;
  }
}

/** Shared org_dashboard row filter (server or client — client should use URL from useSearchParams). */
export function filterOrgDashboardRows(
  rows: OrgDashboardRow[],
  opts: { repId?: string; statusFilter?: string; completionRange?: string },
): OrgDashboardRow[] {
  return rows.filter((r) => {
    if (!passesRepFilter(rowAssignedRepId(r), opts.repId)) return false;
    if (opts.statusFilter && r.status !== opts.statusFilter) return false;
    if (!matchesCompletionRange(r, opts.completionRange)) return false;
    return true;
  });
}

/** Organizations list: optional name search + same filters as dashboard. */
export function filterOnboardingOrgListRows(
  rows: OrgDashboardRow[],
  opts: { q?: string; repId?: string; statusFilter?: string; completionRange?: string },
): OrgDashboardRow[] {
  let out = rows;
  const q = opts.q?.trim();
  if (q) {
    const ql = q.toLowerCase();
    out = out.filter((r) => r.name.toLowerCase().includes(ql));
  }
  return filterOrgDashboardRows(out, {
    repId: opts.repId,
    statusFilter: opts.statusFilter,
    completionRange: opts.completionRange,
  });
}

/** Read one query key from `URLSearchParams` (browser or Request). */
export function searchParamFromUrl(sp: URLSearchParams, key: string): string | undefined {
  return searchParamString(sp.get(key) ?? undefined);
}

/** Build list URL with optional page (page 1 omits `page` param). */
export function onboardingListUrl(base: string, qs: URLSearchParams, page?: number): string {
  const next = new URLSearchParams(qs);
  if (page != null && page > 1) {
    next.set('page', String(page));
  } else {
    next.delete('page');
  }
  const s = next.toString();
  return s ? `${base}?${s}` : base;
}
