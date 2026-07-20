'use client';

import { useEffect, useRef, useState } from 'react';
import TvMonitorScreen from '@/components/tvmonitor/TvMonitorScreen';
import type { TvMonitorConfig, TvMonitorSchedulePayload } from '@/types/tvmonitor';

// Hard reload daily so long-running lobby TVs never accumulate leaks or
// stale JS bundles after a deploy.
const FULL_RELOAD_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Live TV wrapper: polls /api/tvmonitor/{slug}/schedule on the configured
 * interval and re-renders with fresh config + schedule. On fetch failures the
 * last good payload stays on screen — a TV should never show an error wall
 * because of a network blip.
 */
export default function TvMonitorDisplay({
  slug,
  initialConfig,
  initialSchedule,
}: {
  slug: string;
  initialConfig: TvMonitorConfig;
  initialSchedule: TvMonitorSchedulePayload | null;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [schedule, setSchedule] = useState(initialSchedule);
  const refreshSecondsRef = useRef(initialConfig.refreshSeconds);
  refreshSecondsRef.current = config.refreshSeconds;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/tvmonitor/${encodeURIComponent(slug)}/schedule`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as {
            config?: TvMonitorConfig;
            schedule?: TvMonitorSchedulePayload;
          };
          if (!cancelled) {
            if (data.config) setConfig(data.config);
            if (data.schedule) setSchedule(data.schedule);
          }
        }
      } catch {
        // Keep showing the last good payload.
      } finally {
        if (!cancelled) {
          timer = setTimeout(poll, Math.max(30, refreshSecondsRef.current) * 1000);
        }
      }
    }

    timer = setTimeout(poll, Math.max(30, refreshSecondsRef.current) * 1000);
    const reload = setTimeout(() => window.location.reload(), FULL_RELOAD_AFTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(reload);
    };
  }, [slug]);

  return <TvMonitorScreen config={config} schedule={schedule} />;
}
