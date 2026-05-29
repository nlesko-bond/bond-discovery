const BOND_ORG_ID_MIN = 1;

/**
 * Parses Bond back-office organization id from admin / Retool form input.
 */
export function parseBondOrganizationId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < BOND_ORG_ID_MIN) {
    return null;
  }
  return parsed;
}

/**
 * Parses comma-, space-, or semicolon-separated facility ids.
 */
export function parseFacilityIdsList(raw: string): number[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  const ids = trimmed
    .split(/[,;\s]+/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => Number.isFinite(id) && id >= BOND_ORG_ID_MIN);
  return [...new Set(ids)];
}

/**
 * Formats facility ids for comma-separated admin inputs.
 */
export function formatFacilityIdsList(ids: number[] | null | undefined): string {
  if (!ids?.length) {
    return '';
  }
  return ids.join(', ');
}
