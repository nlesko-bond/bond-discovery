import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { IReservationPageConfig } from '@/types/reservation-pages';
import {
  reservationPageAccessCookieName,
  verifyReservationPageAccessCookie,
} from '@/lib/reservation-page-access-cookie';

/**
 * When the page has a viewer password, returns 401 unless the unlock cookie is present and valid.
 */
export async function requireReservationPageViewerAccess(
  slug: string,
  config: IReservationPageConfig,
): Promise<NextResponse | null> {
  if (!config.hasViewerPassword) {
    return null;
  }
  const cookieStore = await cookies();
  const raw = cookieStore.get(reservationPageAccessCookieName(slug))?.value;
  if (!verifyReservationPageAccessCookie(slug, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
