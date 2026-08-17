import { NextRequest, NextResponse } from 'next/server';
import { getConfigBySlug } from '@/lib/config';
import { getFacilityScheduleEvents, resolveFacilityScheduleLink } from '@/lib/facility-schedule-link';

export const dynamic = 'force-dynamic';

/**
 * GET /api/facility-slots?slug={discoveryPageSlug}
 *
 * Facility-schedule reservation events for a discovery page's schedule tab,
 * sourced from the linked facility-schedule-v2 feed. Separate from
 * /api/events by design: the discovery events contract and the
 * discovery:response warm pipeline stay untouched. Returns { data: [] }
 * envelopes; on upstream failure the client degrades to programs-only.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  const config = await getConfigBySlug(slug);
  if (!config || config.isActive === false) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  if (!resolveFacilityScheduleLink(config)) {
    return NextResponse.json(
      { data: [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  }

  try {
    const events = await getFacilityScheduleEvents(config);
    return NextResponse.json(
      { data: events },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    );
  } catch (error) {
    console.error(`[facility-slots] feed error for ${slug}:`, error);
    return NextResponse.json({ data: [] }, { status: 503 });
  }
}
