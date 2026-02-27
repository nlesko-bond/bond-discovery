import { NextRequest, NextResponse } from 'next/server';
import { getMembershipConfigBySlug } from '@/lib/membership-config';
import { getAllMemberships } from '@/lib/membership-client';
import { transformMemberships } from '@/lib/membership-transformer';
import {
  cacheGet,
  cacheSet,
  membershipsCacheKey,
  membershipsLastGoodKey,
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

    const lastGoodKey = membershipsLastGoodKey(slug);
    await cacheSet(cacheKey, pageData, { ttl: config.cache_ttl });
    await cacheSet(lastGoodKey, pageData, { ttl: 7 * 24 * 60 * 60 });
    await markMembershipsRefreshed(slug);

    return NextResponse.json({ data: pageData, cached: false });
  } catch (error) {
    console.error('[API/memberships] Error:', error);

    const lastGoodKey = membershipsLastGoodKey(slug);
    const lastGood = await cacheGet<MembershipPageData>(lastGoodKey);
    if (lastGood) {
      console.log(`[API/memberships] Serving stale data for ${slug}`);
      return NextResponse.json({ data: lastGood, cached: true, stale: true });
    }

    return NextResponse.json(
      { error: 'Failed to fetch memberships' },
      { status: 500 }
    );
  }
}
