import { NextResponse } from 'next/server';
import { getConfigBySlug } from '@/lib/config';
import {
  embedKitCorsHeaders,
  isEmbedKitBrowserRequestAllowed,
} from '@/lib/embed-cors';
import { consumeEmbedRateLimit } from '@/lib/embed-rate-limit';
import { resolveEmbedPortalTemplate } from '@/lib/embed-portal-template';

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

  const origin = new URL(request.url).origin;
  const linkBehavior = config.features.linkBehavior || 'new_tab';
  const portalTemplate = resolveEmbedPortalTemplate(
    searchParams.get('portal'),
    config.features.embedPortalTemplate,
  );
  const enabledTabs = config.features.enabledTabs || ['programs', 'schedule'];
  const includedIds =
    config.includedProgramIds && config.includedProgramIds.length > 0
      ? config.includedProgramIds
      : config.features.includedProgramIds || [];
  const singleProgramInclude =
    config.features.programFilterMode === 'include' && includedIds.length === 1;

  const customRegistrationUrl =
    singleProgramInclude && config.features.customRegistrationUrl
      ? config.features.customRegistrationUrl
      : undefined;

  const body = {
    slug: config.slug,
    origin,
    branding: {
      primaryColor: config.branding.primaryColor,
      secondaryColor: config.branding.secondaryColor,
      accentColor: config.branding.accentColor,
      companyName: config.branding.companyName,
      logo: config.branding.logo,
    },
    features: {
      linkBehavior,
      defaultView: config.features.defaultView,
      embedPortalTemplate: portalTemplate,
      hideRegistrationLinks: config.features.hideRegistrationLinks === true,
      enabledTabs,
      customRegistrationUrl,
    },
    paths: {
      fullDiscoveryUrl: `${origin}/${config.slug}`,
      embedIframeUrl: `${origin}/embed/${config.slug}`,
      programsApi: `${origin}/api/embed/programs?slug=${encodeURIComponent(config.slug)}`,
      eventsApi: `${origin}/api/events?slug=${encodeURIComponent(config.slug)}`,
    },
  };

  return NextResponse.json(body, {
    headers: {
      ...embedKitCorsHeaders(request, config),
      'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
    },
  });
}
