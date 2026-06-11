'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { LayoutGrid, Calendar, ArrowLeft } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, Program, ViewMode } from '@/types';
import { GoogleTagManager, gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { resolvePortalBrandColors } from '@/lib/host-shell/portal-branding';
import { buildHostPortalSessionCards } from '@/lib/host-shell/session-card-model';
import { filterProgramsForPortalSessions } from '@/lib/host-shell/portal-session-filters';
import { buildPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import {
  buildPortalScheduleWeeks,
  filterPortalScheduleEvents,
  resolvePortalScheduleLinkTarget,
  type IDiscoveryApiEvent,
} from '@/lib/host-shell/portal-schedule-events';
import {
  resolveEffectivePortalDisplayMode,
  resolvePortalCardMinWidth,
  resolvePortalCardStyle,
  resolvePortalDisplayMode,
} from '@/lib/host-shell/portal-v2';
import { HostPortalLayoutEnum, PortalSessionLayoutEnum } from '@/types';
import { HostPortalSessionsListView } from '../list/HostPortalSessionsListView';
import { isPortalSessionLayoutToggleAllowed } from '@/lib/host-shell/portal-session-layout';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { HostPortalScheduleTab } from '../HostPortalScheduleTab';
import { useHostPortalEmbedResize } from '../useHostPortalEmbedResize';
import { HostPortalV2SessionsView } from './HostPortalV2SessionsView';
import { HostPortalV2FilterBar } from './HostPortalV2FilterBar';
import {
  HostPortalV2EmptyState,
  HostPortalV2ZeroEventsState,
} from './HostPortalV2States';

const EMPTY_EVENTS: IDiscoveryApiEvent[] = [];
const EVENTS_PAGE_LIMIT = 200;

interface IHostPortalV2PageProps {
  initialPrograms: Program[];
  initialScheduleEvents?: IDiscoveryApiEvent[];
  initialEventsFetched?: boolean;
  initialTotalServerEvents?: number;
  config: DiscoveryConfig;
  initialViewMode: ViewMode;
  searchParams: { [key: string]: string | string[] | undefined };
}

/**
 * Redesigned ("v2") discovery template — plan 009. Activity chips are the hero
 * filter; cards lead with a tinted sport-glyph panel; everything renders in-flow
 * (no 100vh / position:fixed) so the iframe resize contract keeps working.
 */
export function HostPortalV2Page({
  initialPrograms,
  initialScheduleEvents = EMPTY_EVENTS,
  initialEventsFetched = false,
  initialTotalServerEvents = 0,
  config,
  initialViewMode,
  searchParams,
}: IHostPortalV2PageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  const currentSearchString = useMemo(
    () => urlSearchParams.toString(),
    [urlSearchParams],
  );

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  // Only used by the 'list' card style (the mirrored v1 sessions-list shell).
  const [listSessionLayout, setListSessionLayout] = useState(PortalSessionLayoutEnum.LIST);
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
      ? ((searchParams.programTypes as string).split('_') as DiscoveryFilters['programTypes'])
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

  const brand = resolvePortalBrandColors(config);
  const accentColor = config.branding.accentColor?.trim() || brand.primaryColor;
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const cardStyle = resolvePortalCardStyle(config.features.portalCardStyle);
  const displayMode = resolveEffectivePortalDisplayMode(
    resolvePortalDisplayMode(config.features.portalDisplayMode),
    initialPrograms.length,
  );
  const cardLayoutMode =
    config.features.hostPortalLayout === HostPortalLayoutEnum.SESSIONS_LIST
      ? 'list'
      : 'cards';
  const cardMinWidthPx = resolvePortalCardMinWidth(
    config.features.portalCardMinWidth,
    cardLayoutMode,
  );

  const enabledTabs = config.features.enabledTabs || ['programs', 'schedule'];
  const showProgramsTab = enabledTabs.includes('programs');
  const showScheduleTab = enabledTabs.includes('schedule');
  const showTabToggle =
    config.features.allowViewToggle && showProgramsTab && showScheduleTab;

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

  // Unfiltered card set: anchors per-card accent colors so filtering never
  // recolors the cards that remain visible.
  const allSessionCards = useMemo(
    () => buildHostPortalSessionCards(initialPrograms, config),
    [initialPrograms, config],
  );
  const hasAnyCards = allSessionCards.length > 0;

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

  useEffect(() => {
    bondAnalytics.pageView({
      pageSlug: config.slug,
      viewMode,
    });
    // Single GTM page_view per load (partner GTM contract)
    gtmEvent.pageView(window.location.pathname, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.slug]);

  const isEmbedded = useHostPortalEmbedResize(embedRootRef, {
    slug: config.slug,
    remeasureKeys: [viewMode, eventsFetched, sessionCards.length, filters],
  });

  useEffect(() => {
    // 'list' style needs events eagerly — its rows render per-session time
    // chips from the events feed (same behavior as the v1 sessions-list shell).
    if (eventsFetched || (viewMode !== 'schedule' && cardStyle !== 'list')) {
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
  }, [viewMode, eventsFetched, config.slug, cardStyle]);

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
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(`${response.status}`)),
      )
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
      const params = new URLSearchParams(currentSearchString);
      params.set('viewMode', mode);
      // The "View schedule" jump narrows to one session via programIds/sessionIds.
      // Leaving that narrowing active on the programs tab silently hides every
      // other program with no visible filter — clear it when tabbing back.
      if (mode === 'programs') {
        params.delete('programIds');
        params.delete('sessionIds');
        setFilters((previous) =>
          previous.programIds?.length || previous.sessionIds?.length
            ? { ...previous, programIds: [], sessionIds: [] }
            : previous,
        );
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, currentSearchString],
  );

  const handleFiltersChange = useCallback((next: DiscoveryFilters) => {
    setFilters(next);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters((previous) => ({
      ...previous,
      search: '',
      programIds: [],
      sessionIds: [],
      facilityIds: [],
      programTypes: [],
      sports: [],
      dateRange: {},
      ageRange: {},
      ageBucketIds: [],
      gender: 'all',
      genders: [],
      availability: 'all',
      availabilityModes: [],
      spaceNames: undefined,
    }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(currentSearchString);
    const modeParam = params.get('viewMode');
    if (modeParam === 'schedule' || modeParam === 'programs') {
      setViewMode(modeParam);
    }

    const programIdsParam = params.get('programIds');
    const sessionIdsParam = params.get('sessionIds');
    if (programIdsParam || sessionIdsParam) {
      setFilters((previous) => ({
        ...previous,
        programIds: programIdsParam ? programIdsParam.split('_').filter(Boolean) : [],
        sessionIds: sessionIdsParam ? sessionIdsParam.split('_').filter(Boolean) : [],
      }));
    }
  }, [currentSearchString]);

  // "View schedule" affordance on session cards: narrow the schedule tab to the
  // session (same contract as the existing sessions-first portal shell).
  const openScheduleForSession = useCallback(
    (programId: string, sessionId: string) => {
      setFilters((previous) => ({
        ...previous,
        programIds: [programId],
        sessionIds: [sessionId],
      }));
      setViewMode('schedule');

      const params = new URLSearchParams(currentSearchString);
      params.set('viewMode', 'schedule');
      params.delete('scheduleView');
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
    [pathname, router, currentSearchString, viewMode],
  );

  // 'list' card style mirrors the original sessions-list portal exactly: the
  // v1 HostPortalSessionsListView (hero banner, facility/age filter bar,
  // colored-rail rows with time chips) replaces the v2 header + filter bar.
  if (cardStyle === 'list') {
    return (
      <div
        ref={embedRootRef}
        className={cn('bg-gray-50', !isEmbedded && 'min-h-screen')}
        style={{ fontFamily: config.branding.fontFamily || 'inherit' }}
      >
        <GoogleTagManager gtmId={config.gtmId} pageSlug={config.slug} />
        <main className="pb-8">
          <HostPortalSessionsListView
            cards={sessionCards}
            config={config}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            filterOptions={filterOptions}
            apiEvents={apiEvents}
            eventsFetched={eventsFetched}
            viewMode={viewMode}
            sessionLayout={listSessionLayout}
            onSessionLayoutChange={setListSessionLayout}
            showSessionLayoutToggle={isPortalSessionLayoutToggleAllowed(config)}
            onOpenSchedule={showScheduleTab ? openScheduleForSession : undefined}
            onBackToSessions={() => handleViewModeChange('programs')}
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
        </main>
      </div>
    );
  }

  return (
    <div
      ref={embedRootRef}
      className={cn('bg-gray-50', !isEmbedded && 'min-h-screen')}
      style={{ fontFamily: config.branding.fontFamily || 'inherit' }}
    >
      <GoogleTagManager gtmId={config.gtmId} pageSlug={config.slug} />

      <header
        className="border-b px-3 py-3 sm:px-4"
        style={{
          backgroundColor: brand.headerBackgroundColor,
          borderColor: brand.headerTextLight
            ? 'rgba(255,255,255,0.15)'
            : `${brand.primaryColor}18`,
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {config.branding.logo && <BrandLogo config={config} size="sm" className="h-8" />}
            <h1
              className="truncate text-sm font-semibold"
              style={{ color: brand.headerTextLight ? '#ffffff' : brand.primaryColor }}
            >
              {config.branding.companyName}
            </h1>
          </div>

          {showTabToggle && (
            <div
              className="flex shrink-0 rounded-lg p-0.5"
              style={{
                backgroundColor: brand.headerTextLight
                  ? 'rgba(255,255,255,0.15)'
                  : `${brand.secondaryColor}12`,
              }}
            >
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  viewMode !== 'programs' &&
                    (brand.headerTextLight ? 'text-white/70' : 'text-gray-600'),
                )}
                style={
                  viewMode === 'programs'
                    ? {
                        backgroundColor: brand.headerTextLight
                          ? 'rgba(255,255,255,0.25)'
                          : '#ffffff',
                        color: brand.headerTextLight ? '#ffffff' : brand.primaryColor,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      }
                    : undefined
                }
                onClick={() => handleViewModeChange('programs')}
              >
                <LayoutGrid size={14} aria-hidden />
                Programs
              </button>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  viewMode !== 'schedule' &&
                    (brand.headerTextLight ? 'text-white/70' : 'text-gray-600'),
                )}
                style={
                  viewMode === 'schedule'
                    ? {
                        backgroundColor: brand.headerTextLight
                          ? 'rgba(255,255,255,0.25)'
                          : '#ffffff',
                        color: brand.headerTextLight ? '#ffffff' : brand.primaryColor,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      }
                    : undefined
                }
                onClick={() => handleViewModeChange('schedule')}
              >
                <Calendar size={14} aria-hidden />
                Schedule
              </button>
            </div>
          )}
        </div>
      </header>

      <HostPortalV2FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        options={filterOptions}
        programs={initialPrograms}
        config={config}
        accentColor={accentColor}
        resultCount={viewMode === 'schedule' ? filteredEvents.length : sessionCards.length}
        isScheduleView={viewMode === 'schedule'}
      />

      <main className="mx-auto max-w-7xl px-3 pb-8 sm:px-4">
        {viewMode === 'schedule' ? (
          <>
            {showProgramsTab && (
              <button
                type="button"
                data-testid="portal-v2-back-button"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
                onClick={() => handleViewModeChange('programs')}
              >
                <ArrowLeft size={15} aria-hidden />
                {displayMode === 'sessions' ? 'Back to sessions' : 'Back to programs'}
              </button>
            )}
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
          </>
        ) : !hasAnyCards ? (
          <HostPortalV2ZeroEventsState companyName={config.branding.companyName} />
        ) : sessionCards.length === 0 ? (
          <HostPortalV2EmptyState accentColor={accentColor} onClearFilters={clearFilters} />
        ) : (
          <div data-testid="portal-v2-grid">
            <HostPortalV2SessionsView
              cards={sessionCards}
              accentCards={allSessionCards}
              config={config}
              filters={filters}
              accentColor={accentColor}
              cardStyle={cardStyle}
              displayMode={displayMode}
              cardMinWidthPx={cardMinWidthPx}
              onOpenSchedule={showScheduleTab ? openScheduleForSession : undefined}
            />
          </div>
        )}
      </main>

      {!isEmbedded && (
        <footer className="mt-4 border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl justify-between px-3 py-3 text-xs text-gray-500">
            <span style={{ color: brand.primaryColor }}>{config.branding.companyName}</span>
            <span>Powered by Bond Sports</span>
          </div>
        </footer>
      )}
    </div>
  );
}
