import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireStudioSession, TV_STUDIO_COOKIE_NAME } from '@/lib/tvmonitor-access';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireStudioSession(cookies().get(TV_STUDIO_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ organizationIds: session.organizationIds });
}
