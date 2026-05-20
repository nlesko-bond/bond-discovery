import { NextResponse } from 'next/server';
import { getConfigBySlug } from '@/lib/config';
import {
  embedKitCorsHeaders,
  isEmbedKitBrowserRequestAllowed,
} from '@/lib/embed-cors';
import { consumeEmbedRateLimit } from '@/lib/embed-rate-limit';
import { buildHostBootstrapPayload } from '@/lib/host-shell/bootstrap';

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
      {
        status: 403,
        headers: embedKitCorsHeaders(request, config, {
          reflectRequestOriginForErrorResponse: true,
        }),
      },
    );
  }

  const rate = consumeEmbedRateLimit(request, slug);
  if (rate.blocked) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          ...embedKitCorsHeaders(request, config, {
            reflectRequestOriginForErrorResponse: true,
          }),
          'Retry-After': String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const origin = new URL(request.url).origin;
  const body = buildHostBootstrapPayload(config, origin);

  return NextResponse.json(body, {
    headers: {
      ...embedKitCorsHeaders(request, config),
      'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
    },
  });
}
