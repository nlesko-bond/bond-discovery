import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DiscoveryPage } from '@/components/discovery/DiscoveryPage';
import { ProgramGridSkeleton } from '@/components/ui/Skeletons';
import { getConfigBySlug, getAllPageConfigs } from '@/lib/config';
import { cacheGet, discoveryResponseCacheKey } from '@/lib/cache';
import { getAvailabilityMap, mergeAvailabilityIntoEvents } from '@/lib/availability-cache';
import { toPortalDiscoveryConfig } from '@/lib/host-shell/portal-config';
import { Program, DiscoveryConfig } from '@/types';
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
  events: any[];
  total: number;
} | null> {
  if (config.features.discoveryCacheEnabled === false) {
    return null;
  }
  try {
    const precomputed = await cacheGet<any>(
      discoveryResponseCacheKey(slug, config.features.bondEnv),
    );
    if (precomputed?.data && Array.isArray(precomputed.data) && precomputed.data.length > 0) {
      let events = precomputed.data;
      try {
        const availabilityById = await getAvailabilityMap(slug);
        if (availabilityById.size > 0) {
          events = mergeAvailabilityIntoEvents(events, availabilityById);
        }
      } catch (err) {
        console.error('[portal page] availability overlay failed', { slug, err });
      }
      return {
        events,
        total: precomputed.meta?.totalFiltered ?? events.length,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export default async function PortalDiscoverySlugPage({ params, searchParams }: PageProps) {
  const { slug } = params;

  const config = await getConfigBySlug(slug);

  if (!config) {
    notFound();
  }

  const portalConfig = toPortalDiscoveryConfig(config);
  const viewMode = (searchParams.viewMode as string) || portalConfig.features.defaultView;

  const [programs, eventsResult] = await Promise.all([
    getPrograms(portalConfig),
    getPrecomputedEvents(slug, portalConfig),
  ]);

  return (
    <Suspense fallback={<PortalLoadingState />}>
      <DiscoveryPage
        initialPrograms={programs}
        initialScheduleEvents={eventsResult?.events}
        initialEventsFetched={!!eventsResult}
        initialTotalServerEvents={eventsResult?.total ?? 0}
        config={portalConfig}
        initialViewMode={viewMode as 'programs' | 'schedule'}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

function PortalLoadingState() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto">
        <ProgramGridSkeleton count={6} />
      </main>
    </div>
  );
}

export async function generateStaticParams() {
  const configs = await getAllPageConfigs();
  return configs.map((config) => ({
    slug: config.slug,
  }));
}

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps) {
  const config = await getConfigBySlug(params.slug);

  if (!config) {
    return { title: 'Not Found' };
  }

  return {
    title: `${config.branding.companyName} - Programs`,
    robots: 'noindex, nofollow',
    ...(config.branding.favicon && {
      icons: { icon: config.branding.favicon },
    }),
  };
}
