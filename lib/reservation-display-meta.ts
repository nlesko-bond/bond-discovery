import { tryFetchFacilityDisplayName, tryFetchSpaceDisplayName } from '@/lib/reservations-client';
import {
  readSpaceDisplayNameFromReservationSlotRaw,
  readSpaceIdFromReservationSlotRaw,
} from '@/lib/reservation-slot-space';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSpaceIdFromNode(node: Record<string, unknown>): number | null {
  return readSpaceIdFromReservationSlotRaw(node);
}

function readSpaceNameFromSlot(slot: Record<string, unknown>): string | null {
  return readSpaceDisplayNameFromReservationSlotRaw(slot);
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
