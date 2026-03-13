import { NextResponse } from 'next/server';
import {
  getDiscoveryEvents,
  filterEventsForResponse,
  type DiscoveryEventsMode,
  type FullDiscoveryEvent,
} from '@/lib/discovery-events';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * GET /api/events
 * Returns full schedule payload or availability overlay.
 * Always reads from cache (cacheOnly). Only the cron job calls Bond API.
 *
 * The response is automatically trimmed to the config's eventHorizonMonths
 * (default 3). Optional query params `startDate` / `endDate` (YYYY-MM-DD)
 * can further narrow the window.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedMode = searchParams.get('mode');
  const mode: DiscoveryEventsMode = requestedMode === 'availability' ? 'availability' : 'full';

  const startDate = searchParams.get('startDate') || undefined;
  const explicitEndDate = searchParams.get('endDate') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

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

    if (mode === 'full') {
      const horizonMonths = result.context?.config?.features?.eventHorizonMonths ?? 3;
      data = filterEventsForResponse(
        data as FullDiscoveryEvent[],
        horizonMonths,
        startDate,
        explicitEndDate,
      );
    }

    const totalFiltered = data.length;

    if (limit) {
      data = data.slice(offset, offset + limit);
    }

    const cacheControl =
      mode === 'availability'
        ? 's-maxage=20, stale-while-revalidate=60'
        : 's-maxage=60, stale-while-revalidate=300';

    return NextResponse.json(
      { ...result.payload, data, meta: { ...result.payload.meta, totalFiltered } },
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
