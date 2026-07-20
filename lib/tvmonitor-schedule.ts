/**
 * Bond v4 slots-schedule fetch for TV Monitor pages.
 *
 * Uses the same public endpoint the official Bond monitor screens use:
 *   GET https://api.bondsports.co/v4/facilities/{facilityId}/organization/{orgId}/slots-schedule
 *       ?spacesIds=1,2,3&futureHoursLimit=9
 *
 * No auth required. Responses are cached via cachedSWR so a wall of TVs
 * polling the same page hits Bond at most ~once per minute per unique scope —
 * never once per TV.
 */

import { cachedSWR } from '@/lib/cache';
import type { TvMonitorSchedulePayload, TvMonitorSlot, TvMonitorSpace } from '@/types/tvmonitor';

const BOND_V4_BASE = 'https://api.bondsports.co/v4';
const FETCH_TIMEOUT_MS = 20_000;
const SCHEDULE_CACHE_TTL_SECONDS = 60;
// Keep a stale shadow long enough to ride out a Bond outage without blanking TVs.
const SCHEDULE_STALE_TTL_SECONDS = 60 * 30;

function normalizeSlot(raw: Record<string, unknown>): TvMonitorSlot {
  return {
    slotId: Number(raw.slotId) || 0,
    parentSlotId: raw.parentSlotId != null ? Number(raw.parentSlotId) : null,
    reservationId: raw.reservationId != null ? Number(raw.reservationId) : null,
    reservationName: typeof raw.reservationName === 'string' ? raw.reservationName : '',
    date: typeof raw.date === 'string' ? raw.date : '',
    endDate: typeof raw.endDate === 'string' ? raw.endDate : (typeof raw.date === 'string' ? raw.date : ''),
    startTime: typeof raw.startTime === 'string' ? raw.startTime : '',
    endTime: typeof raw.endTime === 'string' ? raw.endTime : '',
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes : null,
    spaceId: Number(raw.spaceId) || 0,
    slotType: typeof raw.slotType === 'string' ? raw.slotType : 'internal',
    isPrivate: raw.isPrivate === true,
  };
}

async function fetchSlotsScheduleFromBond(
  organizationId: number,
  facilityId: number,
  spaceIds: number[],
  futureHoursLimit: number,
): Promise<TvMonitorSchedulePayload> {
  const params = new URLSearchParams({
    spacesIds: spaceIds.join(','),
    futureHoursLimit: String(futureHoursLimit),
  });
  const url = `${BOND_V4_BASE}/facilities/${facilityId}/organization/${organizationId}/slots-schedule?${params}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Bond slots-schedule returned ${response.status}`);
    }
    const json = (await response.json()) as { data?: Record<string, unknown> };
    const data = json.data ?? {};
    const rawSpaces = Array.isArray(data.spaces) ? data.spaces : [];

    const spaces: TvMonitorSpace[] = rawSpaces.map((rawSpace) => {
      const rec = rawSpace as Record<string, unknown>;
      const rawSlots = Array.isArray(rec.slots) ? rec.slots : [];
      return {
        id: Number(rec.id) || 0,
        name: typeof rec.name === 'string' ? rec.name : `Space ${rec.id}`,
        slots: rawSlots.map((slot) => normalizeSlot(slot as Record<string, unknown>)),
      };
    });

    // Preserve the order the page asked for (Bond returns its own ordering).
    const orderIndex = new Map(spaceIds.map((id, i) => [id, i]));
    spaces.sort((a, b) => (orderIndex.get(a.id) ?? 99) - (orderIndex.get(b.id) ?? 99));

    return {
      facilityId: Number(data.facilityId) || facilityId,
      facilityName: typeof data.facilityName === 'string' ? data.facilityName : '',
      spaces,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function tvMonitorScheduleCacheKey(
  organizationId: number,
  facilityId: number,
  spaceIds: number[],
  futureHoursLimit: number,
): string {
  const sortedIds = [...spaceIds].sort((a, b) => a - b).join(',');
  return `tvmonitor:schedule:${organizationId}:${facilityId}:${sortedIds}:${futureHoursLimit}`;
}

/**
 * Cached slots-schedule fetch. Serves stale data during Bond hiccups so live
 * TVs degrade to "slightly old schedule" instead of an error screen.
 */
export async function getTvMonitorSchedule(
  organizationId: number,
  facilityId: number,
  spaceIds: number[],
  futureHoursLimit: number,
): Promise<TvMonitorSchedulePayload> {
  if (!spaceIds.length) {
    return {
      facilityId,
      facilityName: '',
      spaces: [],
      fetchedAt: new Date().toISOString(),
    };
  }
  const key = tvMonitorScheduleCacheKey(organizationId, facilityId, spaceIds, futureHoursLimit);
  return cachedSWR(key, () => fetchSlotsScheduleFromBond(organizationId, facilityId, spaceIds, futureHoursLimit), {
    ttl: SCHEDULE_CACHE_TTL_SECONDS,
    staleTtl: SCHEDULE_STALE_TTL_SECONDS,
  });
}
