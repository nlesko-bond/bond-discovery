import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/admin-auth';
import { requireStudioSession, TV_STUDIO_COOKIE_NAME } from '@/lib/tvmonitor-access';
import { getTvMonitorSchedule } from '@/lib/tvmonitor-schedule';
import { MAX_TV_RESOURCES } from '@/lib/tvmonitor-config';

export const dynamic = 'force-dynamic';

/**
 * Schedule fetch for the builder: validates org/facility/resource IDs before a
 * page is saved and powers the live preview of unsaved drafts.
 * Access: Bond admin session, or a studio session whose grant covers the org.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = Number(searchParams.get('orgId'));
  const facilityId = Number(searchParams.get('facilityId'));
  const futureHoursLimit = Math.min(24, Math.max(1, Number(searchParams.get('hours')) || 9));
  const spaceIds = (searchParams.get('spaceIds') || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, MAX_TV_RESOURCES);

  if (!Number.isFinite(organizationId) || organizationId <= 0 || !Number.isFinite(facilityId) || facilityId <= 0) {
    return NextResponse.json({ error: 'orgId and facilityId are required' }, { status: 400 });
  }

  const adminDenied = await requireAdmin();
  if (adminDenied) {
    const cookieStore = cookies();
    const session = await requireStudioSession(cookieStore.get(TV_STUDIO_COOKIE_NAME)?.value);
    if (!session || !session.organizationIds.includes(organizationId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const schedule = await getTvMonitorSchedule(organizationId, facilityId, spaceIds, futureHoursLimit);
    return NextResponse.json({ schedule }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[TvMonitor/PreviewSchedule] GET error:', error);
    return NextResponse.json(
      { error: 'Could not reach the Bond schedule API with those IDs. Double-check org, facility, and resource IDs.' },
      { status: 502 },
    );
  }
}
