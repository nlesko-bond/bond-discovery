'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { LayoutGrid, Calendar } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, Program, ViewMode } from '@/types';
import { GoogleTagManager } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';
import { resolvePortalBrandColors } from '@/lib/host-shell/portal-branding';
import { cn } from '@/lib/utils';
import { buildHostPortalSessionCards } from '@/lib/host-shell/session-card-model';
import { filterProgramsForPortalSessions } from '@/lib/host-shell/portal-session-filters';
import { buildPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import {
  buildPortalScheduleWeeks,
  filterPortalScheduleEvents,
  resolvePortalScheduleLinkTarget,
  type IDiscoveryApiEvent,
} from '@/lib/host-shell/portal-schedule-events';
import { HorizontalFilterBar } from '@/components/discovery/HorizontalFilterBar';
import { HostPortalSessionList } from './HostPortalSessionList';
import { HostPortalScheduleTab } from './HostPortalScheduleTab';
import { BrandLogo } from '@/components/ui/BrandLogo';

const MobileFilters = dynamic(
  () => import('@/components/discovery/MobileFilters').then((module) => ({ default: module.MobileFilters })),
);

const EMPTY_EVENTS: IDiscoveryApiEvent[] = [];
const EVENTS_PAGE_LIMIT = 200;

interface IHostPortalDiscoveryPageProps {
  initialPrograms: Program[];
  initialScheduleEvents?: IDiscoveryApiEvent[];
  initialEventsFetched?: boolean;
  initialTotalServerEvents?: number;
  config: DiscoveryConfig;
  initialViewMode: ViewMode;
  searchParams: { [key: string]: string | string[] | undefined };
}

export function HostPortalDiscoveryPage({
  initialPrograms,
  initialScheduleEvents = EMPTY_EVENTS,
  initialEventsFetched = false,
  initialTotalServerEvents = 0,
  config,
  initialViewMode,
  searchParams,
}: IHostPortalDiscoveryPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [filters, setFilters] = useState<DiscoveryFilters>(() => ({
    search: (searchParams.search as string) || '',
    programIds: searchParams.programIds
      ? (searchParams.programIds as string).split('_')
      : [],
    sessionIds: searchParams.sessionIds
      ? (searchParams.sessionIds as string).split('_')
      : [],
    facilityIds: searchParams.facilityIds
      ? (searchParams.facilityIds as string).split('_')
      : [],
    programTypes: searchParams.programTypes
      ? (searchParams.programTypes as string).split('_') as DiscoveryFilters['programTypes']
      : [],
    sports: searchParams.sports ? (searchParams.sports as string).split('_') : [],
    dateRange: {
      start: searchParams.startDate as string,
      end: searchParams.endDate as string,
    },
    ageRange: {},
    gender: 'all',
    availability: 'all',
    membershipRequired: null,
  }));

  const [apiEvents, setApiEvents] = useState<IDiscoveryApiEvent[]>(initialScheduleEvents);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsFetched, setEventsFetched] = useState(initialEventsFetched);
  const [totalServerEvents, setTotalServerEvents] = useState(initialTotalServerEvents);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const brand = resolvePortalBrandColors(config);
  const linkTarget = resolvePortalScheduleLinkTarget(config);

  const enabledTabs = config.features.enabledTabs || ['programs', 'schedule'];
  const showSessionsTab = enabledTabs.includes('programs');
  const showScheduleTab = enabledTabs.includes('schedule');
  const showTabToggle =
    config.features.allowViewToggle && showSessionsTab && showScheduleTab;

  const scheduleThemeStyle =
    (config.features.scheduleThemeStyle as 'gradient' | 'solid') || 'solid';

  const filterOptions = useMemo(
    () => buildPortalFilterOptions(initialPrograms),
    [initialPrograms],
  );

  const filteredPrograms = useMemo(
    () => filterProgramsForPortalSessions(initialPrograms, filters),
    [initialPrograms, filters],
  );

  const sessionCards = useMemo(
    () => buildHostPortalSessionCards(filteredPrograms, config),
    [filteredPrograms, config],
  );

  const filteredEvents = useMemo(
    () =>
      filterPortalScheduleEvents(
        apiEvents,
        filters,
        initialPrograms,
        config.features.showScheduleTableDateFilters === true,
      ),
    [apiEvents, filters, initialPrograms, config.features.showScheduleTableDateFilters],
  );

  const scheduleData = useMemo(() => {
    if (viewMode !== 'schedule') {
      return null;
    }
    return buildPortalScheduleWeeks(filteredEvents);
  }, [filteredEvents, viewMode]);

  const scheduleSpaceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    apiEvents.forEach((event) => {
      const spaceName = (event.spaceName || '').trim();
      if (spaceName) {
        counts.set(spaceName, (counts.get(spaceName) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: id, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [apiEvents]);

  const horizontalFilterOptions = useMemo(
    () => ({
      facilities: filterOptions.facilities.map((facility) => ({
        id: facility.id,
        name: facility.name,
        count: filteredPrograms.filter(
          (program) =>
            program.facilityId === facility.id ||
            program.sessions?.some(
              (session) => String(session.facility?.id) === facility.id,
            ),
        ).length,
      })),
      programTypes: filterOptions.programTypes.map((typeOption) => ({
        id: typeOption.id,
        name: typeOption.label,
        count: filteredPrograms.filter((program) => program.type === typeOption.id).length,
      })),
      sports: filterOptions.sports.map((sportOption) => ({
        id: sportOption.id,
        name: sportOption.label,
        count: filteredPrograms.filter((program) => program.sport === sportOption.id).length,
      })),
      programs: filterOptions.programs.filter((programOption) =>
        filteredPrograms.some((program) => program.id === programOption.id),
      ),
      sessions: filterOptions.sessions,
      ages: [] as { min: number; max: number }[],
      hasMultipleFacilities: filterOptions.hasMultipleFacilities,
      spaces: scheduleSpaceOptions,
    }),
    [filterOptions, filteredPrograms, scheduleSpaceOptions],
  );

  useEffect(() => {
    bondAnalytics.pageView({
      pageSlug: config.slug,
      viewMode,
    });
  }, [config.slug]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.self === window.top) {
      return;
    }

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const sendHeight = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const height = document.documentElement.scrollHeight;
        window.parent.postMessage(
          {
            type: 'discovery-resize',
            height,
            slug: config.slug,
          },
          '*',
        );
      }, 100);
    };

    setTimeout(sendHeight, 500);
    const resizeObserver = new ResizeObserver(sendHeight);
    resizeObserver.observe(document.body);
    window.addEventListener('resize', sendHeight);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', sendHeight);
    };
  }, [config.slug]);

  useEffect(() => {
    if (viewMode !== 'schedule' || eventsFetched) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setEventsLoading(true);
    setEventsError(null);

    const params = new URLSearchParams();
    params.set('slug', config.slug);

    fetch(`/api/events?${params.toString()}`, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (abortController.signal.aborted) {
          return;
        }
        if (data && Array.isArray(data.data)) {
          setApiEvents(data.data);
          setTotalServerEvents(data.meta?.totalFiltered ?? data.data.length);
          setEventsFetched(true);
        } else {
          setEventsError('Unexpected response from server');
          setEventsFetched(true);
        }
      })
      .catch((error) => {
        if (abortController.signal.aborted || error?.name === 'AbortError') {
          return;
        }
        setEventsError('Failed to load events');
        setEventsFetched(true);
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setEventsLoading(false);
        }
      });

    return () => abortController.abort();
  }, [viewMode, eventsFetched, config.slug]);

  const loadMoreEvents = useCallback(() => {
    if (loadingMore || apiEvents.length >= totalServerEvents) {
      return;
    }
    setLoadingMore(true);
    const params = new URLSearchParams();
    params.set('slug', config.slug);
    params.set('limit', String(EVENTS_PAGE_LIMIT));
    params.set('offset', String(apiEvents.length));

    fetch(`/api/events?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${response.status}`))))
      .then((data) => {
        if (data && Array.isArray(data.data)) {
          setApiEvents((previous) => [...previous, ...data.data]);
        }
      })
      .catch((error) => console.error('Error loading more events:', error))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, apiEvents.length, totalServerEvents, config.slug]);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      const params = new URLSearchParams(urlSearchParams.toString());
      params.set('viewMode', mode);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, urlSearchParams],
  );

  const handleFiltersChange = useCallback((next: DiscoveryFilters) => {
    setFilters(next);
  }, []);

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: config.branding.fontFamily || 'inherit' }}
    >
      {config.gtmId && <GoogleTagManager gtmId={config.gtmId} pageSlug={config.slug} />}

      <header
        className="border-b px-3 py-3 sm:px-4"
        style={{
          backgroundColor: brand.headerBackgroundColor,
          borderColor: brand.headerTextLight ? 'rgba(255,255,255,0.15)' : `${brand.primaryColor}18`,
        }}
      >
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            {config.branding.logo && <BrandLogo config={config} size="sm" className="h-8" />}
            <h1
              className="font-semibold text-sm truncate"
              style={{ color: brand.headerTextLight ? '#ffffff' : brand.primaryColor }}
            >
              {config.branding.companyName}
            </h1>
          </div>

          {showTabToggle && (
            <div
              className="flex rounded-lg p-0.5 shrink-0"
              style={{
                backgroundColor: brand.headerTextLight
                  ? 'rgba(255,255,255,0.15)'
                  : `${brand.secondaryColor}12`,
              }}
            >
              {showSessionsTab && (
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                    viewMode !== 'programs' &&
                      (brand.headerTextLight ? 'text-white/70' : 'text-gray-600'),
                  )}
                  style={
                    viewMode === 'programs'
                      ? {
                          backgroundColor: brand.headerTextLight ? 'rgba(255,255,255,0.25)' : '#ffffff',
                          color: brand.headerTextLight ? '#ffffff' : brand.primaryColor,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        }
                      : undefined
                  }
                  onClick={() => handleViewModeChange('programs')}
                >
                  <LayoutGrid size={14} />
                  Sessions
                </button>
              )}
              {showScheduleTab && (
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                    viewMode !== 'schedule' &&
                      (brand.headerTextLight ? 'text-white/70' : 'text-gray-600'),
                  )}
                  style={
                    viewMode === 'schedule'
                      ? {
                          backgroundColor: brand.headerTextLight ? 'rgba(255,255,255,0.25)' : '#ffffff',
                          color: brand.headerTextLight ? '#ffffff' : brand.primaryColor,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        }
                      : undefined
                  }
                  onClick={() => handleViewModeChange('schedule')}
                >
                  <Calendar size={14} />
                  Schedule
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="w-full px-3 sm:px-4 lg:px-6 py-2 bg-gray-50 border-b border-gray-200">
        <HorizontalFilterBar
          filters={filters}
          onFilterChange={handleFiltersChange}
          filterOptions={horizontalFilterOptions}
          config={config}
          isScheduleView={viewMode === 'schedule'}
          hideMobileFilterGroups={[]}
          hideMobileActiveChipsFor={[]}
          onOpenMobileFilters={() => setShowMobileFilters(true)}
        />
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 pb-8">
        {viewMode === 'programs' ? (
          <HostPortalSessionList cards={sessionCards} config={config} />
        ) : (
          <HostPortalScheduleTab
            schedule={scheduleData}
            config={config}
            scheduleThemeStyle={scheduleThemeStyle}
            isLoading={eventsLoading}
            error={eventsError}
            totalEvents={filteredEvents.length}
            totalServerEvents={totalServerEvents}
            onLoadMore={loadMoreEvents}
            loadingMore={loadingMore}
            hasMultipleFacilities={filterOptions.hasMultipleFacilities}
            filters={config.features.showScheduleTableDateFilters ? filters : undefined}
            onScheduleFiltersChange={
              config.features.showScheduleTableDateFilters ? handleFiltersChange : undefined
            }
            searchParams={searchParams}
            programs={initialPrograms}
            linkTarget={linkTarget}
          />
        )}
      </main>

      <MobileFilters
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        options={{ ...filterOptions, spaces: scheduleSpaceOptions }}
        enabledFilters={config.features.enableFilters}
        isScheduleView={viewMode === 'schedule'}
        resultCount={viewMode === 'schedule' ? filteredEvents.length : sessionCards.length}
        showSearch={config.features.showSearch !== false}
        brandColor={brand.secondaryColor}
        spaceFilterLabel={config.features.spaceColumnLabel?.trim() || 'Space'}
      />

      <footer className="border-t border-gray-200 bg-white mt-4">
        <div className="max-w-7xl mx-auto px-3 py-3 text-xs text-gray-500 flex justify-between">
          <span style={{ color: brand.primaryColor }}>{config.branding.companyName}</span>
          <span>Powered by Bond Sports</span>
        </div>
      </footer>
    </div>
  );
}
