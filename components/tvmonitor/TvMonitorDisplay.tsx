'use client';

import { useEffect, useRef, useState } from 'react';
import TvMonitorScreen from '@/components/tvmonitor/TvMonitorScreen';
import type { TvMonitorConfig, TvMonitorSchedulePayload } from '@/types/tvmonitor';

// Hard reload daily so long-running lobby TVs never accumulate leaks —
// the safety net behind the build-aware reload below.
const FULL_RELOAD_AFTER_MS = 24 * 60 * 60 * 1000;

// This client's deployment fingerprint (inlined at build time). When the
// schedule API starts answering with a different one, a new deploy is live
// and this TV reloads itself — jittered so a fleet doesn't stampede.
const CLIENT_BUILD = process.env.NEXT_PUBLIC_TVMONITOR_BUILD ?? 'dev';

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
    let reloadScheduled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/tvmonitor/${encodeURIComponent(slug)}/schedule`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as {
            config?: TvMonitorConfig;
            schedule?: TvMonitorSchedulePayload;
            buildId?: string;
          };
          if (!cancelled) {
            if (data.config) setConfig(data.config);
            if (data.schedule) setSchedule(data.schedule);
            // New deployment detected: reload within 0–90s (jittered).
            if (
              !reloadScheduled &&
              data.buildId &&
              data.buildId !== 'dev' &&
              CLIENT_BUILD !== 'dev' &&
              data.buildId !== CLIENT_BUILD
            ) {
              reloadScheduled = true;
              setTimeout(() => window.location.reload(), Math.random() * 90_000);
            }
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
