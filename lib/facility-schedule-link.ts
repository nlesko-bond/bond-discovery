import { createHash } from 'crypto';
import { cachedSWR, cachedSWRPeek } from '@/lib/cache';
import { FACILITY_EVENT_ID_PREFIX } from '@/lib/facility-slot-events';
import type { DiscoveryConfig } from '@/types';
import type { IDiscoveryApiEvent } from '@/lib/host-shell/portal-schedule-events';

/**
 * Facility-schedule link: consumes the versioned slots feed exposed by
 * facility-schedule-v2 (`GET /api/schedule/{slug}/slots?types=...`,
 * FEED_VERSION 1) and maps slots into discovery schedule events.
 *
 * The feed arrives with fsv2's data rules already applied (approval
 * filtering, space rollups, private-event hide/placeholder, title
 * overrides) — never re-derive or relax those here. Discovery only adds
 * presentation on top.
 */

const SUPPORTED_FEED_VERSION = 1;
const DEFAULT_SLOT_TYPES = ['reservation'];
// program/league are deliberately not accepted: those slots would
// double-render against discovery's own program pipeline (dedup is by id,
// and fsched-* ids never match program event ids).
const VALID_SLOT_TYPES = new Set(['reservation', 'maintenance']);
const FEED_FETCH_TIMEOUT_MS = 10_000;

/** Cache the mapped events briefly; keep a stale shadow so an fsv2 outage degrades to stale slots. */
const FEED_CACHE_TTL_SECONDS = 300;
const FEED_STALE_TTL_SECONDS = 60 * 60 * 4;

interface FeedSlot {
  id: string;
  title: string;
  eventType: string;
  startAt: string;
  endAt: string;
  timezone: string;
  spaceName?: string;
  facilityId?: number;
  facilityName?: string;
  publicNotes?: string;
}

interface SlotsFeed {
  version: number;
  slug: string;
  slots: FeedSlot[];
}

function feedBaseUrl(): string {
  return (process.env.FACILITY_SCHEDULE_BASE_URL || 'https://schedule.bondsports.co').replace(/\/+$/, '');
}

export function resolveFacilityScheduleLink(
  config: DiscoveryConfig
): { slug: string; types: string[] } | null {
  const slug = config.features.facilityScheduleSlug?.trim();
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;
  const requested = (config.features.facilityScheduleSlotTypes ?? DEFAULT_SLOT_TYPES)
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => VALID_SLOT_TYPES.has(t));
  if (requested.length === 0) return null;
  return { slug, types: requested };
}

/**
 * fsv2 slot event types pass through as the discovery `type`; 'reservation'
 * renders a "Reservation" chip via getProgramTypeLabel's label map.
 */
function toDiscoveryEventType(feedEventType: string): string {
  return feedEventType;
}

function toDiscoveryEvent(slot: FeedSlot): IDiscoveryApiEvent | null {
  if (!slot.id || !slot.startAt || !slot.endAt) return null;
  return {
    // Prefix avoids id collisions with program events (schedule views dedup by
    // id) and marks the event for isFacilityScheduleEvent checks in the views.
    id: `${FACILITY_EVENT_ID_PREFIX}${slot.id}`,
    title: slot.title || 'Reserved',
    startDate: slot.startAt,
    endDate: slot.endAt,
    timezone: slot.timezone,
    facilityId: slot.facilityId !== undefined ? String(slot.facilityId) : undefined,
    facilityName: slot.facilityName,
    spaceName: slot.spaceName,
    type: toDiscoveryEventType(slot.eventType),
  };
}

async function fetchFeed(slug: string, types: string[]): Promise<IDiscoveryApiEvent[]> {
  const url = `${feedBaseUrl()}/api/schedule/${encodeURIComponent(slug)}/slots?types=${types.join(',')}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FEED_FETCH_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`facility-schedule feed ${slug}: HTTP ${response.status}`);
  }
  const feed = (await response.json()) as SlotsFeed;
  if (feed?.version !== SUPPORTED_FEED_VERSION || !Array.isArray(feed.slots)) {
    throw new Error(`facility-schedule feed ${slug}: unsupported payload (version ${feed?.version})`);
  }
  return feed.slots
    .map(toDiscoveryEvent)
    .filter((event): event is IDiscoveryApiEvent => event !== null);
}

interface FeedCachePayload {
  events: IDiscoveryApiEvent[];
  /** True when this payload was carried over an empty fresh fetch (one generation max). */
  preserved?: boolean;
}

/**
 * Mapped facility-schedule events for a discovery page, or [] when the page
 * has no link configured. Errors surface to the caller (the API route turns
 * them into an empty 503 so the schedule tab degrades to programs-only).
 */
export async function getFacilityScheduleEvents(
  config: DiscoveryConfig
): Promise<IDiscoveryApiEvent[]> {
  const link = resolveFacilityScheduleLink(config);
  if (!link) return [];
  // Production KV is shared with preview/local deployments, so the key must
  // discriminate on the feed origin — otherwise a local run pointed at a
  // staging fsv2 would poison the production cache for the same slug.
  const baseHash = createHash('sha1').update(feedBaseUrl()).digest('hex').slice(0, 8);
  const cacheKey = `facilitysched:events:${baseHash}:${link.slug}:${link.types.join(',')}`;
  const payload = await cachedSWR<FeedCachePayload>(
    cacheKey,
    async () => {
      const fresh = await fetchFeed(link.slug, link.types);
      if (fresh.length > 0) return { events: fresh };
      // Empty-write guard (same philosophy as the discovery:response warm
      // pipeline): a single empty-200 from fsv2 must not wipe the stale
      // shadow. Carry the previous non-empty payload for one generation, so
      // a genuinely emptied schedule still converges to [] on the next cycle.
      const previous = await cachedSWRPeek<FeedCachePayload>(cacheKey);
      if (previous && previous.events.length > 0 && !previous.preserved) {
        console.warn(
          `[facility-schedule-link] ${link.slug}: empty feed, preserving previous ${previous.events.length} events for one cycle`
        );
        return { events: previous.events, preserved: true };
      }
      return { events: [] };
    },
    { ttl: FEED_CACHE_TTL_SECONDS, staleTtl: FEED_STALE_TTL_SECONDS }
  );
  return payload.events;
}
