/**
 * Normalize staff_lock_to_default_questionnaire from DB, JSON, or API bodies.
 * Handles drivers that stringify booleans and avoids Boolean("false") === true.
 */
export function parseStaffLockBoolean(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v === null || v === undefined) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 't' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'f' || s === 'no' || s === '') return false;
  }
  return Boolean(v);
}
