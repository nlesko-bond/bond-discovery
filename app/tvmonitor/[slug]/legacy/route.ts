import { NextRequest, NextResponse } from 'next/server';
import { getTvMonitorPageBySlugCached } from '@/lib/tvmonitor-config';
import { getTvMonitorSchedule } from '@/lib/tvmonitor-schedule';
import { getTvMonitorWeather } from '@/lib/tvmonitor-weather';
import { renderTvMonitorLegacyHtml } from '@/lib/tvmonitor-legacy-render';
import type { TvMonitorSchedulePayload } from '@/types/tvmonitor';

export const dynamic = 'force-dynamic';

/**
 * Zero-client-JS render for old signage browsers — see
 * lib/tvmonitor-legacy-render.ts for why this exists as a Route Handler
 * (returning a raw HTML Response) rather than a normal App Router page: a
 * page always ships Next's client runtime for hydration, which is exactly
 * what old Chromium can't survive.
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const page = await getTvMonitorPageBySlugCached(params.slug);
  if (!page || !page.is_active) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Stay in sync with the toggle: if it's been turned back off, bounce to
  // the normal page instead of serving this static render forever.
  if (!page.config.legacyBrowserMode) {
    return NextResponse.redirect(new URL(`/tvmonitor/${page.slug}`, request.url));
  }

  const { schedule: scheduleBlock, header } = page.config;
  let schedule: TvMonitorSchedulePayload | null = null;
  try {
    schedule = await getTvMonitorSchedule(
      page.organization_id,
      page.facility_id,
      scheduleBlock.resourceIds,
      scheduleBlock.futureHoursLimit,
    );
  } catch (error) {
    console.error('[TvMonitorLegacy] schedule fetch failed:', error);
  }

  const weather =
    header.weather.enabled && header.weather.location ? await getTvMonitorWeather(header.weather.location) : null;

  const html = renderTvMonitorLegacyHtml({
    config: page.config,
    schedule,
    weather,
    now: new Date(),
    pageName: page.name,
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
