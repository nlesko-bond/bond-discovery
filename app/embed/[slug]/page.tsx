import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getConfigBySlug } from '@/lib/config';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cached, programsCacheKey, cacheGet, cacheSet } from '@/lib/cache';
import {
  getDiscoveryEvents,
  filterEventsForResponse,
  type FullDiscoveryEvent,
} from '@/lib/discovery-events';
import { Program, DiscoveryConfig } from '@/types';
import { EmbedDiscoveryPage } from './EmbedDiscoveryPage';

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getPrograms(config: DiscoveryConfig): Promise<Program[]> {
  const apiKey = config.apiKey || DEFAULT_API_KEY;
  const client = createBondClient(apiKey);
  const allPrograms: Program[] = [];
  const orgIds = config.organizationIds;
  
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
      
      return programs;
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
 * Read pre-computed events from KV. When KV is empty, fall back to running the
 * events pipeline server-side so ISR always caches a complete page.
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
    if (precomputed?.data && Array.isArray(precomputed.data)) {
      return {
        events: precomputed.data,
        total: precomputed.meta?.totalFiltered ?? precomputed.data.length,
      };
    }
  } catch {
    // KV read failed -- fall through to server-side pipeline
  }

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

    console.log(`[embed] server-side fallback for ${slug}: ${filtered.length} events`);
    return { events: filtered, total: filtered.length };
  } catch (err) {
    console.error(`[embed] server-side events fallback failed for ${slug}:`, err);
  }

  return null;
}

export default async function EmbedPage({ params, searchParams }: PageProps) {
  const { slug } = params;
  
  const config = await getConfigBySlug(slug);
  
  if (!config) {
    notFound();
  }
  
  const viewMode = (searchParams.viewMode as string) || config.features.defaultView;

  const [programs, eventsResult] = await Promise.all([
    getPrograms(config),
    getPrecomputedEvents(slug, config),
  ]);
  
  return (
    <Suspense fallback={<EmbedLoadingState />}>
      <EmbedDiscoveryPage 
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

function EmbedLoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-toca-purple"></div>
    </div>
  );
}

// Enable ISR with 5-minute revalidation
export const revalidate = 300;

// Generate metadata for embed
export async function generateMetadata({ params }: PageProps) {
  const config = await getConfigBySlug(params.slug);
  
  return {
    title: config?.branding.companyName || 'Discovery',
    // Prevent indexing of embed pages
    robots: 'noindex, nofollow',
  };
}
