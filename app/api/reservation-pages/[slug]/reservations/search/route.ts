import { NextResponse } from 'next/server';
import { getReservationPageConfigBySlug } from '@/lib/reservation-pages-config';
import { fetchOrganizationReservationsSearch } from '@/lib/reservations-client';
import { parseReservationSearchResponse } from '@/lib/reservation-search-parse';

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
  const search = typeof body.search === 'string' ? body.search.trim() : '';
  if (!Number.isFinite(organizationId) || !search) {
    return NextResponse.json({ error: 'organizationId and search are required' }, { status: 400 });
  }

  if (!config.organization_ids.includes(organizationId)) {
    return NextResponse.json({ error: 'Organization is not allowed for this page' }, { status: 403 });
  }

  const page = Number(body.page);
  const itemsPerPage = Number(body.itemsPerPage);
  const bondQuery = parseBondQuery(body.bondQuery);

  try {
    const raw = await fetchOrganizationReservationsSearch(organizationId, {
      search,
      page: Number.isFinite(page) && page > 0 ? page : undefined,
      itemsPerPage: Number.isFinite(itemsPerPage) && itemsPerPage > 0 ? itemsPerPage : undefined,
      extraQuery: bondQuery,
    });
    const { hits, meta } = parseReservationSearchResponse(raw);
    return NextResponse.json({ hits, meta });
  } catch (error) {
    console.error('[reservation-pages search]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 502 },
    );
  }
}
