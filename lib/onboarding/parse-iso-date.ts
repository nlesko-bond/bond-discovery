const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseOptionalIsoDate(raw: string): { value: string | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null };
  }
  if (!ISO_DATE_PATTERN.test(trimmed)) {
    return { value: null, error: 'Date must be YYYY-MM-DD or left blank.' };
  }
  return { value: trimmed };
}

/**
 * Normalizes an ISO timestamp or date string to YYYY-MM-DD for Health key-dates payloads.
 */
export function toIsoDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
