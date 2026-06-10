import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getConfigBySlug, getAllPageConfigs } from '@/lib/config';
import { getPrecomputedDiscoveryEvents } from '@/lib/discovery-precomputed-events';
import { Program, DiscoveryConfig } from '@/types';
import { EmbedDiscoveryPage } from './EmbedDiscoveryPage';
import { fetchProgramsForDiscoveryPage } from '@/lib/embed-discovery-programs';

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getPrograms(config: DiscoveryConfig): Promise<Program[]> {
  return fetchProgramsForDiscoveryPage(config);
}

async function getPrecomputedEvents(
  slug: string,
  config: DiscoveryConfig,
): Promise<{
  events: unknown[];
  total: number;
} | null> {
  return getPrecomputedDiscoveryEvents(slug, config);
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
