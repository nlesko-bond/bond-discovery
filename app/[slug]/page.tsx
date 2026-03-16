import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DiscoveryPage } from '@/components/discovery/DiscoveryPage';
import { ProgramGridSkeleton } from '@/components/ui/Skeletons';
import { getConfigBySlug, getAllPageConfigs } from '@/lib/config';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cached, programsCacheKey, cacheGet, cacheSet } from '@/lib/cache';
import {
  getDiscoveryEvents,
  filterEventsForResponse,
  type FullDiscoveryEvent,
} from '@/lib/discovery-events';
import { Program, DiscoveryConfig } from '@/types';

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getPrograms(config: DiscoveryConfig): Promise<Program[]> {
  const apiKey = config.apiKey || DEFAULT_API_KEY;
  const client = createBondClient(apiKey);
  const allPrograms: Program[] = [];
  const orgIds = config.organizationIds;
  const today = new Date().toISOString().split('T')[0];
  
  const promises = orgIds.map(async (orgId) => {
    try {
      const cacheKey = programsCacheKey(orgId, undefined, apiKey);
      
      const response = await cached(
        cacheKey,
        () => client.getPrograms(orgId),
        { ttl: Math.max(config.cacheTtl || 0, 4 * 60 * 60) }
      );
      
      const programs = (response.data || []).map(raw => ({
        ...transformProgram(raw),
        organizationId: orgId,
      }));
      
      programs.forEach(program => {
        if (program.sessions) {
          program.sessions = program.sessions.filter(session => {
            if (!session.endDate) return true;
            return session.endDate >= today;
          });
        }
      });
      
      return programs.filter(p => !p.sessions || p.sessions.length > 0);
    } catch (error) {
      console.error(`Error fetching programs for org ${orgId}:`, error);
      return [];
    }
  });
  
  const results = await Promise.all(promises);
  results.forEach(programs => allPrograms.push(...programs));
  
  if (config.facilityIds && config.facilityIds.length > 0) {
    return allPrograms.filter(p => 
      p.facilityId && config.facilityIds!.includes(p.facilityId)
    );
  }
  
  return allPrograms;
}

/**
 * Read pre-computed events from KV. When KV is empty (cron hasn't warmed this
 * slug, TTL expired, etc.) fall back to running the events pipeline server-side
 * so ISR always caches a complete page. A 12-second timeout prevents the
 * serverless function from hanging indefinitely.
 */
async function getPrecomputedEvents(
  slug: string,
  config: DiscoveryConfig,
): Promise<{
  events: any[];
  total: number;
} | null> {
  try {
    const precomputed = await cacheGet<any>(`discovery:response:${slug}`);
    if (precomputed?.data && Array.isArray(precomputed.data) && precomputed.data.length > 0) {
      return {
        events: precomputed.data,
        total: precomputed.meta?.totalFiltered ?? precomputed.data.length,
      };
    }
  } catch {
    // KV read failed -- fall through to server-side pipeline
  }

  // KV miss (or cached empty result) — run the pipeline server-side so ISR
  // caches a complete page. During normal ISR revalidation this runs in the
  // background (no user waits).
  try {
    const result = await Promise.race([
      getDiscoveryEvents({ slug, mode: 'full', config }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('server-side events timeout')), 12_000),
      ),
    ]);

    const horizonMonths = config.features?.eventHorizonMonths ?? 3;
    const today = new Date().toISOString().split('T')[0];
    const filtered = filterEventsForResponse(
      result.payload.data as FullDiscoveryEvent[],
      horizonMonths,
      today,
    );

    // Never cache empty results -- they're almost certainly from rate-limiting
    // or a transient pipeline failure. Let the client retry instead.
    if (filtered.length === 0) {
      console.warn(`[page] server-side fallback returned 0 events for ${slug}, skipping cache`);
      return null;
    }

    const responsePayload = {
      ...result.payload,
      data: filtered,
      meta: {
        ...result.payload.meta,
        totalFiltered: filtered.length,
        precomputedAt: new Date().toISOString(),
      },
    };
    cacheSet(`discovery:response:${slug}`, responsePayload, {
      ttl: 4 * 60 * 60,
    }).catch(() => {});

    console.log(`[page] server-side fallback for ${slug}: ${filtered.length} events`);
    return { events: filtered, total: filtered.length };
  } catch (err) {
    console.error(`[page] server-side events fallback failed for ${slug}:`, err);
  }

  return null;
}

export default async function DiscoverySlugPage({ params, searchParams }: PageProps) {
  const { slug } = params;
  
  const config = await getConfigBySlug(slug);
  
  if (!config) {
    notFound();
  }
  
  const viewMode = (searchParams.viewMode as string) || config.features.defaultView;
  
  // Fetch programs and pre-computed events in parallel
  const [programs, eventsResult] = await Promise.all([
    getPrograms(config),
    getPrecomputedEvents(slug, config),
  ]);
  
  return (
    <Suspense fallback={<LoadingState />}>
      <DiscoveryPage 
        initialPrograms={programs}
        initialScheduleEvents={eventsResult?.events}
        initialEventsFetched={!!eventsResult}
        initialTotalServerEvents={eventsResult?.total ?? 0}
        config={config}
        initialViewMode={viewMode as 'programs' | 'schedule'}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
      </header>
      <main className="max-w-7xl mx-auto">
        <ProgramGridSkeleton count={6} />
      </main>
    </div>
  );
}

// Generate static params for known pages
export async function generateStaticParams() {
  const configs = await getAllPageConfigs();
  return configs.map((config) => ({
    slug: config.slug,
  }));
}

// Enable ISR with 5-minute revalidation
export const revalidate = 300;

// Generate metadata dynamically
export async function generateMetadata({ params }: PageProps) {
  const config = await getConfigBySlug(params.slug);
  
  if (!config) {
    return { title: 'Not Found' };
  }
  
  return {
    title: `${config.branding.companyName} - Programs`,
    description: config.branding.tagline || `Find programs at ${config.branding.companyName}`,
    ...(config.branding.favicon && {
      icons: { icon: config.branding.favicon },
    }),
    openGraph: {
      title: config.branding.companyName,
      description: config.branding.tagline,
    },
  };
}
