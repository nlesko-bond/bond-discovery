import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DiscoveryPage } from '@/components/discovery/DiscoveryPage';
import { ProgramGridSkeleton } from '@/components/ui/Skeletons';
import { getConfigBySlug, getAllPageConfigs } from '@/lib/config';
import { cacheGet, discoveryResponseCacheKey } from '@/lib/cache';
import { getAvailabilityMap, mergeAvailabilityIntoEvents } from '@/lib/availability-cache';
import { Program, DiscoveryConfig } from '@/types';
import { fetchProgramsForDiscoveryPage } from '@/lib/embed-discovery-programs';

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getPrograms(config: DiscoveryConfig): Promise<Program[]> {
  return fetchProgramsForDiscoveryPage(config);
}

/**
 * Read pre-computed events from KV (populated by the cron job or write-through).
 * Returns null on miss so the client falls back to fetching via /api/events.
 */
async function getPrecomputedEvents(
  slug: string,
  config: DiscoveryConfig,
): Promise<{
  events: any[];
  total: number;
} | null> {
  if (config.features.discoveryCacheEnabled === false) {
    return null;
  }
  try {
    const precomputed = await cacheGet<any>(
      discoveryResponseCacheKey(slug, config.features.bondEnv)
    );
    if (precomputed?.data && Array.isArray(precomputed.data) && precomputed.data.length > 0) {
      // Overlay fresh availability (KV SWR, <=180s stale) onto the precomputed
      // full payload so SSR first paint has correct spotsLeft / maxParticipants.
      // Failures are non-fatal — we fall through to the precomputed values.
      let events = precomputed.data;
      try {
        const availabilityById = await getAvailabilityMap(slug);
        if (availabilityById.size > 0) {
          events = mergeAvailabilityIntoEvents(events, availabilityById);
        }
      } catch (err) {
        console.error('[page] availability overlay failed', { slug, err });
      }
      return {
        events,
        total: precomputed.meta?.totalFiltered ?? events.length,
      };
    }
  } catch {
    // KV miss -- client will fetch
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
