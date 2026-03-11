import { NextResponse } from 'next/server';
import { getDiscoveryEvents, type DiscoveryEventsMode, type FullDiscoveryEvent } from '@/lib/discovery-events';

export const dynamic = 'force-dynamic';

function getEventLocalDate(event: FullDiscoveryEvent): string {
  if (event.timezone) {
    try {
      const d = new Date(event.startDate);
      return d.toLocaleDateString('en-CA', { timeZone: event.timezone });
    } catch {
      // fall through
    }
  }
  return event.startDate.split('T')[0];
}

/**
 * GET /api/events
 * Returns full schedule payload or availability overlay.
 * Always reads from cache (cacheOnly). Only the cron job calls Bond API.
 *
 * Optional query params `startDate` / `endDate` (YYYY-MM-DD) trim the
 * response without affecting the cache key the cron warms.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedMode = searchParams.get('mode');
  const mode: DiscoveryEventsMode = requestedMode === 'availability' ? 'availability' : 'full';

  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  try {
    const result = await getDiscoveryEvents({
      slug: searchParams.get('slug') || undefined,
      apiKey: searchParams.get('apiKey') || undefined,
      orgIds: searchParams.get('orgIds')
        ? searchParams.get('orgIds')!.split(/[_,]/).filter(Boolean)
        : undefined,
      facilityId: searchParams.get('facilityId') || undefined,
      includePast: searchParams.get('includePast') === 'true',
      mode,
    });

    let data = result.payload.data;

    if (mode === 'full' && (startDate || endDate)) {
      data = (data as FullDiscoveryEvent[]).filter((event) => {
        const localDate = getEventLocalDate(event);
        if (startDate && localDate < startDate) return false;
        if (endDate && localDate > endDate) return false;
        return true;
      });
    }

    const cacheControl =
      mode === 'availability'
        ? 's-maxage=20, stale-while-revalidate=60'
        : 's-maxage=60, stale-while-revalidate=300';

    return NextResponse.json(
      { ...result.payload, data },
      {
        headers: {
          'Cache-Control': cacheControl,
          'X-Bond-Events-Cache': result.cacheStatus,
          'X-Bond-Events-Mode': mode,
          'X-Bond-Events-Cache-Key': result.cacheKey,
        },
      }
    );
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
