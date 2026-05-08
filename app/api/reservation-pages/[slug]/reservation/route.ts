import { NextResponse } from 'next/server';
import { getReservationPageConfigBySlug } from '@/lib/reservation-pages-config';
import { fetchOrganizationReservation } from '@/lib/reservations-client';
import { buildReservationDisplayMeta } from '@/lib/reservation-display-meta';
import { requireReservationPageViewerAccess } from '@/lib/reservation-page-viewer-auth';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBondQuery(raw: unknown): Record<string, string> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v !== '') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const config = await getReservationPageConfigBySlug(slug);
  if (!config || !config.is_active) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const authError = await requireReservationPageViewerAccess(slug, config);
  if (authError) {
    return authError;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const organizationId = Number(body.organizationId);
  const reservationId = Number(body.reservationId);
  if (!Number.isFinite(organizationId) || !Number.isFinite(reservationId)) {
    return NextResponse.json({ error: 'organizationId and reservationId are required' }, { status: 400 });
  }

  if (!config.organization_ids.includes(organizationId)) {
    return NextResponse.json({ error: 'Organization is not allowed for this page' }, { status: 403 });
  }

  const bondQuery = parseBondQuery(body.bondQuery);

  try {
    const reservation = await fetchOrganizationReservation(organizationId, reservationId, bondQuery);
    if (!isRecord(reservation)) {
      return NextResponse.json({ error: 'Unexpected reservation response' }, { status: 502 });
    }

    const resOrg = reservation.organizationId;
    if (typeof resOrg === 'number' && resOrg !== organizationId) {
      return NextResponse.json({ error: 'Reservation does not belong to the requested organization' }, { status: 403 });
    }

    const meta = await buildReservationDisplayMeta(organizationId, reservation);
    return NextResponse.json({ reservation, meta });
  } catch (error) {
    console.error('[reservation-pages reservation]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load reservation' },
      { status: 502 },
    );
  }
}
