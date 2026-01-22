import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DiscoveryPage } from '@/components/discovery/DiscoveryPage';
import { ProgramGridSkeleton } from '@/components/ui/Skeletons';
import { getConfigBySlug, getAllPageConfigs } from '@/lib/config';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cached, programsCacheKey } from '@/lib/cache';
import { Program, DiscoveryConfig } from '@/types';

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getPrograms(config: DiscoveryConfig): Promise<Program[]> {
  const client = createBondClient(DEFAULT_API_KEY);
  const allPrograms: Program[] = [];
  const orgIds = config.organizationIds;
  
  // Fetch programs from all organizations in parallel
  const promises = orgIds.map(async (orgId) => {
    try {
      const cacheKey = programsCacheKey(orgId);
      
      const response = await cached(
        cacheKey,
        () => client.getPrograms(orgId),
        { ttl: config.cacheTtl || 300 }
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
  
  // Apply facility filter if set in config
  if (config.facilityIds && config.facilityIds.length > 0) {
    return allPrograms.filter(p => 
      p.facilityId && config.facilityIds!.includes(p.facilityId)
    );
  }
  
  return allPrograms;
}

export default async function DiscoverySlugPage({ params, searchParams }: PageProps) {
  const { slug } = params;
  
  // Get configuration by slug
  const config = await getConfigBySlug(slug);
  
  if (!config) {
    notFound();
  }
  
  // Get view mode from URL or config default
  const viewMode = (searchParams.viewMode as string) || config.features.defaultView;
  
  // Fetch programs
  const programs = await getPrograms(config);
  
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
    openGraph: {
      title: config.branding.companyName,
      description: config.branding.tagline,
    },
  };
}
