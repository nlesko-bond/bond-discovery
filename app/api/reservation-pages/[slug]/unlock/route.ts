import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getReservationPageUnlockContext } from '@/lib/reservation-pages-config';
import { verifyViewerPassword } from '@/lib/reservation-page-password';
import {
  createReservationPageAccessCookieValue,
  reservationPageAccessCookieName,
} from '@/lib/reservation-page-access-cookie';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }
  const ctx = await getReservationPageUnlockContext(slug);
  if (!ctx.found || !ctx.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!ctx.passwordHash) {
    return NextResponse.json({ error: 'Not password protected' }, { status: 400 });
  }
  if (!verifyViewerPassword(body.password, ctx.passwordHash)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }
  try {
    const { value, maxAgeSeconds } = createReservationPageAccessCookieValue(slug);
    const cookieStore = await cookies();
    cookieStore.set(reservationPageAccessCookieName(slug), value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });
  } catch (error) {
    console.error('[reservation-pages unlock]', error);
    return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
