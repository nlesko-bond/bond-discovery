import { NextResponse } from 'next/server';
import { getDiscoveryEvents, type DiscoveryEventsMode } from '@/lib/discovery-events';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * GET /api/events
 * Returns full schedule payload or availability overlay.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedMode = searchParams.get('mode');
  const mode: DiscoveryEventsMode = requestedMode === 'availability' ? 'availability' : 'full';

  try {
    const result = await getDiscoveryEvents({
      slug: searchParams.get('slug') || undefined,
      apiKey: searchParams.get('apiKey') || undefined,
      orgIds: searchParams.get('orgIds')
        ? searchParams.get('orgIds')!.split(/[_,]/).filter(Boolean)
        : undefined,
      facilityId: searchParams.get('facilityId') || undefined,
      startDateFilter: searchParams.get('startDate') || undefined,
      endDateFilter: searchParams.get('endDate') || undefined,
      includePast: searchParams.get('includePast') === 'true',
      mode,
      forceFresh: searchParams.get('fresh') === 'true' || searchParams.get('bypass') === '1',
    });

    const cacheControl =
      mode === 'availability'
        ? 's-maxage=20, stale-while-revalidate=60'
        : 's-maxage=60, stale-while-revalidate=300';

    return NextResponse.json(result.payload, {
      headers: {
        'Cache-Control': cacheControl,
        'X-Bond-Events-Cache': result.cacheStatus,
        'X-Bond-Events-Mode': mode,
        'X-Bond-Events-Cache-Key': result.cacheKey,
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
