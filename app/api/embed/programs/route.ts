import { NextResponse } from 'next/server';
import { getConfigBySlug } from '@/lib/config';
import { fetchProgramsForDiscoveryPage } from '@/lib/embed-discovery-programs';
import {
  embedKitCorsHeaders,
  isEmbedKitBrowserRequestAllowed,
} from '@/lib/embed-cors';
import { consumeEmbedRateLimit } from '@/lib/embed-rate-limit';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const config = slug ? await getConfigBySlug(slug) : null;
  return new NextResponse(null, {
    status: 204,
    headers: embedKitCorsHeaders(request, config),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json(
      { error: 'Missing slug' },
      { status: 400, headers: embedKitCorsHeaders(request, null) },
    );
  }

  const config = await getConfigBySlug(slug);
  if (!config) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: embedKitCorsHeaders(request, null) },
    );
  }

  if (!isEmbedKitBrowserRequestAllowed(request, config)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403, headers: embedKitCorsHeaders(request, config) },
    );
  }

  const rate = consumeEmbedRateLimit(request, slug);
  if (rate.blocked) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          ...embedKitCorsHeaders(request, config),
          'Retry-After': String(rate.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const programs = await fetchProgramsForDiscoveryPage(config);
    return NextResponse.json(
      {
        data: programs,
        meta: {
          slug: config.slug,
          totalPrograms: programs.length,
          cachedAt: new Date().toISOString(),
        },
      },
      {
        headers: {
          ...embedKitCorsHeaders(request, config),
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('[api/embed/programs]', error);
    return NextResponse.json(
      { error: 'Failed to fetch programs' },
      { status: 500, headers: embedKitCorsHeaders(request, config) },
    );
  }
}
