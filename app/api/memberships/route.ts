import { NextRequest, NextResponse } from 'next/server';
import { getMembershipConfigBySlug } from '@/lib/membership-config';
import { getAllMemberships } from '@/lib/membership-client';
import { transformMemberships } from '@/lib/membership-transformer';
import {
  cacheGet,
  cacheSet,
  membershipsCacheKey,
  markMembershipsRefreshed,
} from '@/lib/cache';
import { MembershipPageData } from '@/types/membership';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  const force = request.nextUrl.searchParams.get('force') === 'true';

  if (!slug) {
    return NextResponse.json({ error: 'slug parameter required' }, { status: 400 });
  }

  try {
    const config = await getMembershipConfigBySlug(slug);
    if (!config) {
      return NextResponse.json({ error: 'Membership page not found' }, { status: 404 });
    }

    if (!config.is_active) {
      return NextResponse.json({ error: 'Membership page is inactive' }, { status: 404 });
    }

    const cacheKey = membershipsCacheKey(slug);

    if (!force) {
      const cached = await cacheGet<MembershipPageData>(cacheKey);
      if (cached) {
        return NextResponse.json({ data: cached, cached: true });
      }
    }

    const apiResponse = await getAllMemberships(config.organization_id);
    const pageData = transformMemberships(apiResponse.data, config);

    await cacheSet(cacheKey, pageData, { ttl: config.cache_ttl });
    await markMembershipsRefreshed(slug);

    return NextResponse.json({ data: pageData, cached: false });
  } catch (error) {
    console.error('[API/memberships] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memberships' },
      { status: 500 }
    );
  }
}
