import { tryFetchFacilityDisplayName, tryFetchSpaceDisplayName } from '@/lib/reservations-client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSpaceIdFromNode(node: Record<string, unknown>): number | null {
  if (typeof node.spaceId === 'number') return node.spaceId;
  if (typeof node.spaceId === 'string' && /^\d+$/.test(node.spaceId.trim())) {
    return Number(node.spaceId.trim());
  }
  const so = isRecord(node.space) ? node.space : isRecord(node.Space) ? node.Space : null;
  if (so) {
    const sid = so.id ?? so.Id;
    if (typeof sid === 'number') return sid;
    if (typeof sid === 'string' && /^\d+$/.test(sid.trim())) return Number(sid.trim());
  }
  return null;
}

function readSpaceNameFromSlot(slot: Record<string, unknown>): string | null {
  const spaceObj = isRecord(slot.space) ? slot.space : isRecord(slot.Space) ? slot.Space : null;
  if (spaceObj) {
    const n =
      spaceObj.name ??
      spaceObj.Name ??
      spaceObj.displayName ??
      spaceObj.DisplayName ??
      spaceObj.internalName ??
      spaceObj.InternalName;
    if (typeof n === 'string' && n.trim()) return n.trim();
  }
  const displayName = slot.displayName ?? slot.internalName;
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  return null;
}

export function collectSpaceIdsDeep(reservation: unknown): number[] {
  const ids = new Set<number>();

  const visit = (node: unknown) => {
    if (!isRecord(node)) return;
    const sid = readSpaceIdFromNode(node);
    if (sid != null) ids.add(sid);
    const nestedKeys = ['segments', 'series', 'slots', 'maintenance'] as const;
    for (const key of nestedKeys) {
      const arr = node[key];
      if (Array.isArray(arr)) {
        for (const item of arr) visit(item);
      }
    }
  };

  visit(reservation);
  return [...ids].sort((a, b) => a - b);
}

export async function buildReservationDisplayMeta(
  organizationId: number,
  reservation: unknown,
): Promise<{ facilityName: string; spaceNameBySpaceId: Record<number, string> }> {
  let facilityName = '';
  if (isRecord(reservation)) {
    if (isRecord(reservation.facility) && typeof reservation.facility.name === 'string') {
      facilityName = reservation.facility.name.trim();
    }
    const facilityId = reservation.facilityId;
    if (!facilityName && typeof facilityId === 'number') {
      const resolved = await tryFetchFacilityDisplayName(organizationId, facilityId);
      facilityName = resolved?.trim() || `Facility ${facilityId}`;
    }
  }

  const spaceNameBySpaceId: Record<number, string> = {};
  const walkSlots = (node: unknown) => {
    if (!isRecord(node)) return;
    const sid = readSpaceIdFromNode(node);
    if (sid != null) {
      const fromSlot = readSpaceNameFromSlot(node);
      if (fromSlot) spaceNameBySpaceId[sid] = fromSlot;
    }
    const nestedKeys = ['segments', 'series', 'slots', 'maintenance'] as const;
    for (const key of nestedKeys) {
      const arr = node[key];
      if (Array.isArray(arr)) {
        for (const item of arr) walkSlots(item);
      }
    }
  };
  walkSlots(reservation);

  const missing = collectSpaceIdsDeep(reservation).filter((id) => !spaceNameBySpaceId[id]);
  const BATCH_SIZE = 5;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (spaceId) => {
        const name = await tryFetchSpaceDisplayName(organizationId, spaceId);
        return { spaceId, name: name?.trim() || null };
      }),
    );
    for (const { spaceId, name } of results) {
      if (name) spaceNameBySpaceId[spaceId] = name;
    }
  }

  for (const id of collectSpaceIdsDeep(reservation)) {
    if (!spaceNameBySpaceId[id]) {
      spaceNameBySpaceId[id] = `Space ${id}`;
    }
  }

  return { facilityName: facilityName || '', spaceNameBySpaceId };
}
