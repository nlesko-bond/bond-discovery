import { NextRequest, NextResponse } from 'next/server';
import { getActiveMembershipConfigs } from '@/lib/membership-config';
import { getAllMemberships } from '@/lib/membership-client';
import { transformMemberships } from '@/lib/membership-transformer';
import {
  cacheSet,
  membershipsCacheKey,
  shouldRefreshMemberships,
  markMembershipsRefreshed,
} from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const configs = await getActiveMembershipConfigs();
    const results: { slug: string; status: string }[] = [];

    for (const config of configs) {
      try {
        const needsRefresh = await shouldRefreshMemberships(
          config.slug,
          config.cache_ttl
        );

        if (!needsRefresh) {
          results.push({ slug: config.slug, status: 'skipped (fresh)' });
          continue;
        }

        const apiResponse = await getAllMemberships(config.organization_id);
        const pageData = transformMemberships(apiResponse.data, config);

        await cacheSet(membershipsCacheKey(config.slug), pageData, {
          ttl: config.cache_ttl,
        });
        await markMembershipsRefreshed(config.slug);

        results.push({
          slug: config.slug,
          status: `refreshed (${pageData.totalCount} memberships)`,
        });
      } catch (error) {
        console.error(`[CronMemberships] Error for ${config.slug}:`, error);
        results.push({ slug: config.slug, status: `error: ${error}` });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('[CronMemberships] Error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
