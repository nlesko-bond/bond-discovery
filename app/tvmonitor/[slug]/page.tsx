import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TvMonitorDisplay from '@/components/tvmonitor/TvMonitorDisplay';
import { getTvMonitorPageBySlugCached } from '@/lib/tvmonitor-config';
import { getTvMonitorSchedule } from '@/lib/tvmonitor-schedule';
import { getTvMonitorWeather } from '@/lib/tvmonitor-weather';
import type { TvMonitorSchedulePayload } from '@/types/tvmonitor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await getTvMonitorPageBySlugCached(params.slug);
  return {
    title: page ? `${page.name} — TV Monitor` : 'TV Monitor',
    robots: { index: false, follow: false },
  };
}

export default async function TvMonitorPage({ params }: { params: { slug: string } }) {
  const page = await getTvMonitorPageBySlugCached(params.slug);
  if (!page || !page.is_active) {
    notFound();
  }

  // First paint comes with data (cached; never blocks long) — the client then
  // polls the schedule route on the configured interval.
  let initialSchedule: TvMonitorSchedulePayload | null = null;
  try {
    initialSchedule = await getTvMonitorSchedule(
      page.organization_id,
      page.facility_id,
      page.config.schedule.resourceIds,
      page.config.schedule.futureHoursLimit,
    );
  } catch (error) {
    console.error('[TvMonitor] initial schedule fetch failed:', error);
  }

  const { weather } = page.config.header;
  const initialWeather = weather.enabled && weather.location ? await getTvMonitorWeather(weather.location) : null;

  return (
    <TvMonitorDisplay
      slug={page.slug}
      initialConfig={page.config}
      initialSchedule={initialSchedule}
      initialWeather={initialWeather}
    />
  );
}
