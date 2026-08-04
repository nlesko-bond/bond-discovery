import { NextRequest, NextResponse } from 'next/server';
import { getTvMonitorPageBySlug } from '@/lib/tvmonitor-config';
import { getTvMonitorSchedule } from '@/lib/tvmonitor-schedule';
import { getTvMonitorWeather } from '@/lib/tvmonitor-weather';

export const dynamic = 'force-dynamic';

/**
 * Live payload polled by TVs: the page config (so builder edits go live
 * without touching the TV) plus the cached Bond slots-schedule.
 */
export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const page = await getTvMonitorPageBySlug(params.slug);
    if (!page || !page.is_active) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { schedule: scheduleBlock, header } = page.config;
    const schedule = await getTvMonitorSchedule(
      page.organization_id,
      page.facility_id,
      scheduleBlock.resourceIds,
      scheduleBlock.futureHoursLimit,
    );
    const weather =
      header.weather.enabled && header.weather.location ? await getTvMonitorWeather(header.weather.location) : null;

    return NextResponse.json(
      {
        config: page.config,
        schedule,
        weather,
        serverTime: new Date().toISOString(),
        // Lets long-running TVs detect a new deployment and self-reload.
        buildId: process.env.NEXT_PUBLIC_TVMONITOR_BUILD ?? 'dev',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[TvMonitor/Schedule] GET error:', error);
    return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 });
  }
}
