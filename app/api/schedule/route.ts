import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY, DEFAULT_ORG_IDS } from '@/lib/bond-client';
import { transformProgram, programsToCalendarEvents, buildWeekSchedules } from '@/lib/transformers';
import { cached, programsCacheKey, scheduleCacheKey } from '@/lib/cache';
import { Program, CalendarEvent, WeekSchedule } from '@/types';
import { format, addWeeks } from 'date-fns';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const orgIdsParam = searchParams.get('orgIds');
  const orgIds = orgIdsParam 
    ? orgIdsParam.split(/[_,]/).filter(Boolean)
    : DEFAULT_ORG_IDS;
  
  const weeks = parseInt(searchParams.get('weeks') || '4');
  const facilityId = searchParams.get('facilityId') || undefined;

  // Create date range for caching
  const today = new Date();
  const startDate = format(today, 'yyyy-MM-dd');
  const endDate = format(addWeeks(today, weeks), 'yyyy-MM-dd');

  try {
    const client = createBondClient(DEFAULT_API_KEY);
    const allPrograms: Program[] = [];

    // Fetch programs from all organizations in parallel
    const promises = orgIds.map(async (orgId) => {
      try {
        const cacheKey = programsCacheKey(orgId, facilityId);
        
        const response = await cached(
          cacheKey,
          () => client.getPrograms(orgId, { 
            expand: 'sessions,sessions.products,sessions.products.prices,sessions.events,facility',
            facilityId 
          }),
          { ttl: 300 }
        );

        const programs = (response.data || []).map(raw => ({
          ...transformProgram(raw),
          organizationId: orgId,
        }));

        return programs;
      } catch (error) {
        console.error(`Error fetching programs for org ${orgId}:`, error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(programs => allPrograms.push(...programs));

    // Convert to calendar events and build week schedule
    const calendarEvents = programsToCalendarEvents(allPrograms);
    const schedule = buildWeekSchedules(calendarEvents, weeks);

    // Calculate stats
    const totalEvents = schedule.reduce(
      (sum, week) => sum + week.days.reduce((daySum, day) => daySum + day.events.length, 0),
      0
    );

    return NextResponse.json({
      data: {
        schedule,
        events: calendarEvents,
      },
      meta: {
        startDate,
        endDate,
        weeks,
        totalEvents,
        totalPrograms: allPrograms.length,
        cachedAt: new Date().toISOString(),
      }
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error building schedule:', error);
    return NextResponse.json(
      { error: 'Failed to build schedule' },
      { status: 500 }
    );
  }
}
