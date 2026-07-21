'use client';

import { useEffect, useRef, useState } from 'react';
import TvMonitorScreen from '@/components/tvmonitor/TvMonitorScreen';
import type { TvMonitorConfig, TvMonitorSchedulePayload } from '@/types/tvmonitor';

/** Base render resolution per screen ratio; the preview scales it to fit. */
export const BASE_SIZES: Record<string, { w: number; h: number }> = {
  fill: { w: 1920, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
  '4:3': { w: 1440, h: 1080 },
  '21:9': { w: 2520, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
};

/**
 * Live, to-scale preview of a draft config. Renders the real TvMonitorScreen
 * at TV resolution and scales it down; schedule data comes from the
 * builder-gated preview endpoint (debounced as the data source changes).
 */
export default function MonitorPreview({
  config,
  organizationId,
  facilityId,
}: {
  config: TvMonitorConfig;
  organizationId: number;
  facilityId: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [schedule, setSchedule] = useState<TvMonitorSchedulePayload | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const resourceKey = config.schedule.resourceIds.join(',');
  const hours = config.schedule.futureHoursLimit;

  useEffect(() => {
    if (!organizationId || !facilityId || !resourceKey) {
      setSchedule(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          orgId: String(organizationId),
          facilityId: String(facilityId),
          spaceIds: resourceKey,
          hours: String(hours),
        });
        const res = await fetch(`/api/tvmonitor/preview-schedule?${params}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setSchedule(data.schedule ?? null);
          setScheduleError(null);
        } else {
          setScheduleError(data.error || 'Could not load schedule');
        }
      } catch {
        if (!cancelled) setScheduleError('Could not load schedule');
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [organizationId, facilityId, resourceKey, hours]);

  const base = BASE_SIZES[config.screenRatio] ?? BASE_SIZES.fill;
  const scale = containerWidth > 0 ? containerWidth / base.w : 0;

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-gray-300 bg-black shadow-inner"
        style={{ height: base.h * scale || undefined, aspectRatio: !containerWidth ? `${base.w} / ${base.h}` : undefined }}
      >
        {scale > 0 && (
          <div
            style={{
              width: base.w,
              height: base.h,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <TvMonitorScreen config={config} schedule={schedule} previewMode />
          </div>
        )}
      </div>
      {scheduleError && <p className="mt-2 text-sm text-red-600">{scheduleError}</p>}
      {!resourceKey && (
        <p className="mt-2 text-sm text-gray-500">
          Add resource IDs in “Data source” to see live schedule data in the preview.
        </p>
      )}
    </div>
  );
}
