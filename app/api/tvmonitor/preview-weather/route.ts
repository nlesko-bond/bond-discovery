import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/admin-auth';
import { requireStudioSession, TV_STUDIO_COOKIE_NAME } from '@/lib/tvmonitor-access';
import { getTvMonitorWeather } from '@/lib/tvmonitor-weather';

export const dynamic = 'force-dynamic';

/**
 * Weather fetch for the builder's live preview. Not org-scoped (weather
 * isn't sensitive data) — just gated to signed-in admins/studio users so it
 * isn't an open proxy for arbitrary geocode lookups.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = (searchParams.get('location') || '').trim();
  if (!location) {
    return NextResponse.json({ error: 'location is required' }, { status: 400 });
  }

  const adminDenied = await requireAdmin();
  if (adminDenied) {
    const cookieStore = cookies();
    const session = await requireStudioSession(cookieStore.get(TV_STUDIO_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const weather = await getTvMonitorWeather(location);
  return NextResponse.json({ weather }, { headers: { 'Cache-Control': 'no-store' } });
}
