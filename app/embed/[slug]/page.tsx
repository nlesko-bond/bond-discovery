import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getConfigBySlug } from '@/lib/config';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cached, programsCacheKey } from '@/lib/cache';
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

const SSR_PAGE_SIZE = 200;

export default async function EmbedPage({ params, searchParams }: PageProps) {
  const { slug } = params;
  
  const config = await getConfigBySlug(slug);
  
  if (!config) {
    notFound();
  }
  
  const viewMode = (searchParams.viewMode as string) || config.features.defaultView;
  const programs = await getPrograms(config);

  let initialScheduleEvents: FullDiscoveryEvent[] = [];
  let initialEventsFetched = false;
  let initialTotalServerEvents = 0;

  if (viewMode === 'schedule') {
    try {
      const result = await getDiscoveryEvents({
        slug: config.slug,
        mode: 'full',
        config,
      });
      const horizonMonths = config.features.eventHorizonMonths ?? 3;
      const today = new Date().toISOString().split('T')[0];
      const filtered = filterEventsForResponse(
        result.payload.data as FullDiscoveryEvent[],
        horizonMonths,
        today,
      );
      initialTotalServerEvents = filtered.length;
      initialScheduleEvents = filtered.slice(0, SSR_PAGE_SIZE);
      initialEventsFetched = true;
    } catch (error) {
      console.error(`[SSR] Failed to pre-fetch events for ${slug}:`, error);
    }
  }
  
  return (
    <Suspense fallback={<EmbedLoadingState />}>
      <EmbedDiscoveryPage 
        initialPrograms={programs}
        initialScheduleEvents={initialScheduleEvents}
        initialEventsFetched={initialEventsFetched}
        initialTotalServerEvents={initialTotalServerEvents}
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
