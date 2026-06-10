import { NextRequest, NextResponse } from 'next/server';
import { getAllPageConfigs } from '@/lib/config';
import {
  shouldRefreshDiscovery,
  cacheSet,
  type DiscoveryRefreshPolicy,
} from '@/lib/cache';
import { warmScopeGroup, type WarmDetail } from '@/lib/discovery-warm';
import { DEFAULT_API_KEY, resetBondApiStats, getBondApiStats } from '@/lib/bond-client';
import {
  getDiscoveryExcludedProgramIds,
  getDiscoveryIncludedProgramIds,
} from '@/lib/discovery-program-scope';
import type { DiscoveryConfig } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Compute a deterministic key representing the data-fetching scope of a
 * config.  Configs that share the same scope hit the exact same Bond API
 * endpoints, so we only need to fetch once per scope.
 */
function computeDataScope(config: DiscoveryConfig): string {
  const orgIds = config.organizationIds.slice().sort().join(',');
  const apiKey = config.apiKey || DEFAULT_API_KEY;
  const filterMode = config.features?.programFilterMode || 'all';
  const excluded = getDiscoveryExcludedProgramIds(config).slice().sort().join(',');
  const included = getDiscoveryIncludedProgramIds(config).slice().sort().join(',');
  const bondEnv = config.features.bondEnv || 'production';
  return `${orgIds}|${apiKey}|${bondEnv}|${filterMode}|${excluded}|${included}`;
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.error('[warm-discovery] CRON_SECRET not configured; refusing to run');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  resetBondApiStats();

  try {
    const configs = await getAllPageConfigs();
    const activeConfigs = configs.filter(
      (config) =>
        config.isActive !== false &&
        config.features.discoveryCacheEnabled !== false
    );

    const toWarm: DiscoveryConfig[] = [];
    const skipped: string[] = [];

    for (const config of activeConfigs) {
      const policy = (config.features.discoveryRefreshPolicy || '15min') as DiscoveryRefreshPolicy;
      const needsRefresh = await shouldRefreshDiscovery(config.slug, policy);
      if (needsRefresh) {
        toWarm.push(config);
      } else {
        skipped.push(config.slug);
      }
    }

    // Group configs by data scope so we fetch from Bond API only once per
    // unique org+filter combination. This prevents rate-limiting when
    // multiple slugs (e.g. pbsz / pbsz-copy) share the same orgs.
    const scopeGroups = new Map<string, DiscoveryConfig[]>();
    for (const config of toWarm) {
      const scope = computeDataScope(config);
      const group = scopeGroups.get(scope) || [];
      group.push(config);
      scopeGroups.set(scope, group);
    }

    const details: WarmDetail[] = [];

    // Process one scope group at a time to avoid cross-scope rate-limiting
    for (const [, groupConfigs] of scopeGroups) {
      details.push(...(await warmScopeGroup(groupConfigs)));
    }

    // Persist a compact last-run record so cache staleness is diagnosable
    // after the fact (24h TTL; read by admin tooling / runbooks).
    await cacheSet('discovery:cron:lastRun', {
      at: new Date().toISOString(),
      warmed: details.filter((d) => d.status === 'warmed' || d.status === 'shared').length,
      errors: details.filter((d) => d.status === 'error').map((d) => d.slug),
      skipped: skipped.length,
      bondApi: getBondApiStats(),
      elapsedMs: Date.now() - start,
    }, { ttl: 24 * 60 * 60 });

    return NextResponse.json({
      success: true,
      totalActive: activeConfigs.length,
      warmed: details.filter((d) => d.status === 'warmed' || d.status === 'shared').length,
      skipped: skipped.length,
      elapsedMs: Date.now() - start,
      bondApi: getBondApiStats(),
      details,
    });
  } catch (error) {
    console.error('[warm-discovery] Cron error:', error);
    return NextResponse.json(
      {
        error: 'Failed to warm discovery cache',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
