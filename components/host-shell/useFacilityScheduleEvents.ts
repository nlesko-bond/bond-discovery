'use client';

import { useEffect, useRef, useState } from 'react';
import type { DiscoveryConfig } from '@/types';
import type { IDiscoveryApiEvent } from '@/lib/host-shell/portal-schedule-events';

/**
 * Facility-schedule link overlay: fetches linked fsv2 reservation events for
 * the schedule tab. Returns [] until loaded, on pages without a link, and on
 * any fetch failure — the schedule degrades to programs-only, never breaks.
 * Kept in separate state (not merged into apiEvents) so /api/events
 * pagination offsets stay correct.
 *
 * `enabled` lets shells defer the fetch until the schedule surface is
 * actually shown (mirroring how the primary /api/events fetch is gated);
 * once fetched, events are kept when the viewer switches tabs.
 */
export function useFacilityScheduleEvents(
  config: DiscoveryConfig,
  enabled: boolean = true
): IDiscoveryApiEvent[] {
  const [events, setEvents] = useState<IDiscoveryApiEvent[]>([]);
  const fetchedForRef = useRef<string | null>(null);
  const linkedSlug = config.features.facilityScheduleSlug?.trim() || '';

  useEffect(() => {
    if (!linkedSlug) {
      fetchedForRef.current = null;
      setEvents((prev) => (prev.length ? [] : prev));
      return;
    }
    if (fetchedForRef.current && fetchedForRef.current !== linkedSlug) {
      // Link retargeted mid-session (admin preview): drop the old slots.
      fetchedForRef.current = null;
      setEvents((prev) => (prev.length ? [] : prev));
    }
    if (!enabled || fetchedForRef.current === linkedSlug) return;
    fetchedForRef.current = linkedSlug;

    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('slug', config.slug);

    fetch(`/api/facility-slots?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Facility slots API error: ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (Array.isArray(payload?.data)) {
          setEvents(payload.data as IDiscoveryApiEvent[]);
        }
      })
      .catch((error) => {
        // Allow a retry on the next enable/remount rather than pinning failure.
        fetchedForRef.current = null;
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        console.error('Facility schedule fetch error:', error);
      });

    return () => controller.abort();
  }, [linkedSlug, enabled, config.slug]);

  return events;
}
