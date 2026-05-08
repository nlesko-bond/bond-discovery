/**
 * Space on a reservation slot: read `spaceId` / `SpaceId` and the nested `space` / `Space`
 * object from the API payload (same shape Bond returns on the slot).
 * For instructors later: read the slot’s `instructors` array the same way—no extra guessing.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function coerceNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function embeddedSpace(raw: Record<string, unknown>): Record<string, unknown> | null {
  const s = raw.space ?? raw.Space;
  return isRecord(s) ? s : null;
}

export function readSpaceDisplayNameFromReservationSlotRaw(raw: Record<string, unknown>): string | null {
  const s = embeddedSpace(raw);
  if (!s) {
    return null;
  }
  const n = s.name ?? s.Name;
  if (typeof n === 'string' && n.trim()) {
    return n.trim();
  }
  return null;
}

export function readSpaceIdFromReservationSlotRaw(raw: Record<string, unknown>): number | null {
  const top = coerceNumericId(raw.spaceId ?? raw.SpaceId);
  if (top != null) {
    return top;
  }
  const s = embeddedSpace(raw);
  if (!s) {
    return null;
  }
  return coerceNumericId(s.id ?? s.Id);
}
