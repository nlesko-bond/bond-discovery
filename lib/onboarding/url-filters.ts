/**
 * Helpers for onboarding admin list pages (orgs, dashboard) — URL params and row filters.
 */

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

/** Assigned-rep filter: when a rep is selected, only rows with that rep_id match. */
export function passesRepFilter(
  rowRepId: string | null | undefined,
  filterRepId: string | undefined
): boolean {
  if (!filterRepId) return true;
  if (rowRepId == null || String(rowRepId).trim() === '') return false;
  return idEquals(rowRepId, filterRepId);
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
