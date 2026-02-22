import { NextRequest, NextResponse } from 'next/server';
import { getAllPageConfigs } from '@/lib/config';
import {
  shouldRefreshDiscovery,
  markDiscoveryRefreshed,
  type DiscoveryRefreshPolicy,
} from '@/lib/cache';
import { getDiscoveryEvents } from '@/lib/discovery-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CONCURRENT = 2;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const configs = await getAllPageConfigs();
    const activeConfigs = configs.filter(
      (config) => config.isActive && config.features.discoveryCacheEnabled === true
    );

    const toWarm: typeof activeConfigs = [];
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

    const details: Array<{ slug: string; status: 'warmed' | 'error'; totalEvents?: number; durationMs: number }> = [];

    await runWithConcurrency(toWarm, MAX_CONCURRENT, async (config) => {
      const itemStart = Date.now();
      try {
        const full = await getDiscoveryEvents({
          slug: config.slug,
          mode: 'full',
          forceFresh: true,
        });

        await getDiscoveryEvents({
          slug: config.slug,
          mode: 'availability',
          forceFresh: true,
        });

        await markDiscoveryRefreshed(config.slug);
        details.push({
          slug: config.slug,
          status: 'warmed',
          totalEvents: full.payload.meta.totalEvents,
          durationMs: Date.now() - itemStart,
        });
      } catch (error) {
        console.error(`[warm-discovery] Failed to warm ${config.slug}:`, error);
        details.push({
          slug: config.slug,
          status: 'error',
          durationMs: Date.now() - itemStart,
        });
      }
    });

    return NextResponse.json({
      success: true,
      totalActive: activeConfigs.length,
      warmed: details.filter((d) => d.status === 'warmed').length,
      skipped: skipped.length,
      elapsedMs: Date.now() - start,
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
