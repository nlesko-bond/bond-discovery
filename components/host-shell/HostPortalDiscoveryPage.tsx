'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { LayoutGrid, Calendar } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, Program, ViewMode } from '@/types';
import { GoogleTagManager } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';
import {
  isHostPortalSessionLayout,
} from '@/lib/host-shell/portal-config';
import { derivePortalEventHorizonMonths } from '@/lib/host-shell/portal-list-layout';
import {
  isPortalSessionLayoutToggleAllowed,
  PORTAL_SESSION_LAYOUT_QUERY_KEY,
  resolvePortalSessionLayout,
  resolvePortalSessionLayoutDefault,
} from '@/lib/host-shell/portal-session-layout';
import { PortalSessionLayoutEnum } from '@/types';
import { HostPortalSessionsListView } from './list/HostPortalSessionsListView';
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
import { HostPortalFilterBar } from './HostPortalFilterBar';
import { HostPortalSessionList } from './HostPortalSessionList';
import { HostPortalScheduleTab } from './HostPortalScheduleTab';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useHostPortalEmbedResize } from './useHostPortalEmbedResize';

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const embedRootRef = useRef<HTMLDivElement>(null);
  const useSessionPortalShell = isHostPortalSessionLayout(config);
  const sessionLayout = resolvePortalSessionLayout(
    config,
    urlSearchParams.get(PORTAL_SESSION_LAYOUT_QUERY_KEY),
  );
  const showSessionLayoutToggle = isPortalSessionLayoutToggleAllowed(config);
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

  useEffect(() => {
    bondAnalytics.pageView({
      pageSlug: config.slug,
      viewMode,
    });
  }, [config.slug]);

  const isEmbedded = useHostPortalEmbedResize(embedRootRef, {
    slug: config.slug,
    remeasureKeys: [
      viewMode,
      eventsFetched,
      sessionCards.length,
      filters,
      useSessionPortalShell,
      sessionLayout,
    ],
  });

  useEffect(() => {
    if (eventsFetched) {
      return;
    }
    if (viewMode !== 'schedule' && !(useSessionPortalShell && sessionLayout === PortalSessionLayoutEnum.LIST)) {
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
    if (useSessionPortalShell && sessionLayout === PortalSessionLayoutEnum.LIST && sessionCards.length > 0) {
      params.set('horizonMonths', String(derivePortalEventHorizonMonths(sessionCards)));
    }

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
  }, [viewMode, eventsFetched, config.slug, useSessionPortalShell, sessionLayout, sessionCards]);

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

  useEffect(() => {
    const modeParam = urlSearchParams.get('viewMode');
    if (modeParam === 'schedule' || modeParam === 'programs') {
      setViewMode(modeParam);
    }

    const programIdsParam = urlSearchParams.get('programIds');
    const sessionIdsParam = urlSearchParams.get('sessionIds');
    if (programIdsParam || sessionIdsParam) {
      setFilters((previous) => ({
        ...previous,
        programIds: programIdsParam ? programIdsParam.split('_').filter(Boolean) : [],
        sessionIds: sessionIdsParam ? sessionIdsParam.split('_').filter(Boolean) : [],
      }));
    }
  }, [urlSearchParams]);

  const openScheduleForSession = useCallback(
    (programId: string, sessionId: string) => {
      const nextFilters: DiscoveryFilters = {
        ...filters,
        programIds: [programId],
        sessionIds: [sessionId],
      };
      setFilters(nextFilters);
      setViewMode('schedule');

      const params = new URLSearchParams(urlSearchParams.toString());
      params.set('viewMode', 'schedule');
      params.set('scheduleView', 'list');
      params.set('programIds', programId);
      params.set('sessionIds', sessionId);
      const nextUrl = `${pathname}?${params.toString()}`;
      if (viewMode === 'programs') {
        router.push(nextUrl, { scroll: false });
      } else {
        router.replace(nextUrl, { scroll: false });
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    },
    [filters, pathname, router, urlSearchParams, viewMode],
  );

  const setSessionLayout = useCallback(
    (layout: PortalSessionLayoutEnum) => {
      const params = new URLSearchParams(urlSearchParams.toString());
      const defaultLayout = resolvePortalSessionLayoutDefault(config);
      if (layout === defaultLayout) {
        params.delete(PORTAL_SESSION_LAYOUT_QUERY_KEY);
      } else {
        params.set(PORTAL_SESSION_LAYOUT_QUERY_KEY, layout);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [config, pathname, router, urlSearchParams],
  );

  const backToSessionsList = useCallback(() => {
    const nextFilters: DiscoveryFilters = {
      ...filters,
      programIds: [],
      sessionIds: [],
    };
    setFilters(nextFilters);
    setViewMode('programs');

    const params = new URLSearchParams(urlSearchParams.toString());
    params.set('viewMode', 'programs');
    params.delete('programIds');
    params.delete('sessionIds');
    params.delete('scheduleView');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [filters, pathname, router, urlSearchParams]);

  return (
    <div
      ref={embedRootRef}
      className={cn('bg-gray-50', !isEmbedded && 'min-h-screen')}
      style={{ fontFamily: config.branding.fontFamily || 'inherit' }}
    >
      {config.gtmId && <GoogleTagManager gtmId={config.gtmId} pageSlug={config.slug} />}

      {!useSessionPortalShell && (
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
      )}

      {!useSessionPortalShell && (
      <HostPortalFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        options={filterOptions}
        config={config}
        resultCount={viewMode === 'schedule' ? filteredEvents.length : sessionCards.length}
        isScheduleView={viewMode === 'schedule'}
        scheduleSpaces={scheduleSpaceOptions}
      />
      )}

      <main className={useSessionPortalShell ? 'pb-8' : 'max-w-7xl mx-auto px-3 sm:px-4 pb-8'}>
        {useSessionPortalShell ? (
          <HostPortalSessionsListView
            cards={sessionCards}
            config={config}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            filterOptions={filterOptions}
            apiEvents={apiEvents}
            eventsFetched={eventsFetched}
            viewMode={viewMode}
            sessionLayout={sessionLayout}
            onSessionLayoutChange={setSessionLayout}
            showSessionLayoutToggle={showSessionLayoutToggle}
            onOpenSchedule={openScheduleForSession}
            onBackToSessions={backToSessionsList}
            scheduleContent={
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
            }
          />
        ) : viewMode === 'programs' ? (
          <HostPortalSessionList
            cards={sessionCards}
            config={config}
            onOpenSchedule={openScheduleForSession}
          />
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

      {!isEmbedded && (
      <footer className="border-t border-gray-200 bg-white mt-4">
        <div className="max-w-7xl mx-auto px-3 py-3 text-xs text-gray-500 flex justify-between">
          <span style={{ color: brand.primaryColor }}>{config.branding.companyName}</span>
          <span>Powered by Bond Sports</span>
        </div>
      </footer>
      )}
    </div>
  );
}
