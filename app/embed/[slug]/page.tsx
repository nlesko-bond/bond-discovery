import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getConfigBySlug, getAllPageConfigs } from '@/lib/config';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cached, programsCacheKey, cacheGet } from '@/lib/cache';
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
 * Read pre-computed events from KV (populated by the cron job or write-through).
 * Returns null on miss so the client falls back to fetching via /api/events.
 */
async function getPrecomputedEvents(slug: string): Promise<{
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
    // KV miss -- client will fetch
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
    getPrecomputedEvents(slug),
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

// Pre-build all known embed pages so ISR always has a stale version to serve
// while revalidating in the background (prevents the server-side fallback from
// blocking the first visitor's page render).
export async function generateStaticParams() {
  const configs = await getAllPageConfigs();
  return configs.map((config) => ({
    slug: config.slug,
  }));
}

// Enable ISR with 5-minute revalidation
export const revalidate = 300;

// Generate metadata for embed
export async function generateMetadata({ params }: PageProps) {
  const config = await getConfigBySlug(params.slug);
  
  return {
    title: config?.branding.companyName || 'Discovery',
    ...(config?.branding.favicon && {
      icons: { icon: config.branding.favicon },
    }),
    robots: 'noindex, nofollow',
  };
}
