import { Suspense } from 'react';
import { DiscoveryPage } from '@/components/discovery/DiscoveryPage';
import { ProgramGridSkeleton } from '@/components/ui/Skeletons';
import { getConfig } from '@/lib/config';
import { createBondClient, DEFAULT_API_KEY, DEFAULT_ORG_IDS } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cached, programsCacheKey } from '@/lib/cache';
import { Program } from '@/types';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getPrograms(orgIds: string[]): Promise<Program[]> {
  const client = createBondClient(DEFAULT_API_KEY);
  const allPrograms: Program[] = [];
  
  // Fetch programs from all organizations in parallel
  const promises = orgIds.map(async (orgId) => {
    try {
      const cacheKey = programsCacheKey(orgId);
      
      const response = await cached(
        cacheKey,
        () => client.getPrograms(orgId),
        { ttl: 300 } // 5 minutes
      );
      
      // Transform and add org ID
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
  
  return allPrograms;
}

export default async function Home({ searchParams }: PageProps) {
  // Get configuration
  const config = await getConfig('default');
  
  // Parse org IDs from URL or use config defaults
  const orgIdsParam = typeof searchParams.orgIds === 'string' 
    ? searchParams.orgIds 
    : searchParams.orgIds?.[0];
  
  const orgIds = orgIdsParam 
    ? orgIdsParam.split(/[_,]/).filter(Boolean)
    : config.organizationIds;
  
  // Get view mode from URL or config default
  const viewMode = (searchParams.viewMode as string) || config.features.defaultView;
  
  // Fetch programs
  const programs = await getPrograms(orgIds);
  
  return (
    <Suspense fallback={<LoadingState />}>
      <DiscoveryPage 
        initialPrograms={programs}
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

// Enable ISR with 5-minute revalidation
export const revalidate = 300;
