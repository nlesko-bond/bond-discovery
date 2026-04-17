'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ProgramGrid } from '@/components/discovery/ProgramGrid';
import { ScheduleView } from '@/components/discovery/ScheduleView';
import { Program, DiscoveryConfig, DiscoveryFilters, ViewMode, CalendarEvent, ProgramType } from '@/types';
import { buildWeekSchedules } from '@/lib/transformers';
import { getSportGradient } from '@/lib/utils';
import {
  eventMatchesDateRange,
  eventMatchesDaysOfWeek,
  eventMatchesSpaceNames,
} from '@/lib/schedule-event-filters';
import { scheduleViewParamFromPageSearchParams } from '@/lib/schedule-view-resolution';
import { isLeagueScheduleTableContext } from '@/lib/league-schedule-context';
import { Calendar, Grid3X3, Filter } from 'lucide-react';

const HorizontalFilterBar = dynamic(
  () => import('@/components/discovery/HorizontalFilterBar').then(m => ({ default: m.HorizontalFilterBar }))
);

const EMPTY_EVENTS: any[] = [];

interface EmbedDiscoveryPageProps {
  initialPrograms: Program[];
  initialScheduleEvents?: any[];
  initialEventsFetched?: boolean;
  initialTotalServerEvents?: number;
  config: DiscoveryConfig;
  initialViewMode?: ViewMode;
  searchParams: { [key: string]: string | string[] | undefined };
}

export function EmbedDiscoveryPage({
  initialPrograms,
  initialScheduleEvents = EMPTY_EVENTS,
  initialEventsFetched = false,
  initialTotalServerEvents = 0,
  config,
  initialViewMode = 'programs',
  searchParams,
}: EmbedDiscoveryPageProps) {
  const linkBehavior = config.features.linkBehavior || 'new_tab';
  const linkTarget = linkBehavior === 'same_window' ? '_top' : linkBehavior === 'in_frame' ? '_self' : '_blank';

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [filters, setFilters] = useState<DiscoveryFilters>({
    search: (searchParams.search as string) || '',
    programIds: searchParams.programIds 
      ? (searchParams.programIds as string).split('_') 
      : [],
    facilityIds: searchParams.facilityIds 
      ? (searchParams.facilityIds as string).split('_') 
      : [],
    programTypes: searchParams.programTypes 
      ? (searchParams.programTypes as string).split('_') as any[]
      : [],
    sports: searchParams.sports 
      ? (searchParams.sports as string).split('_') 
      : [],
    dateRange: {
      start: searchParams.startDate as string | undefined,
      end: searchParams.endDate as string | undefined,
    },
    daysOfWeek: searchParams.daysOfWeek
      ? (searchParams.daysOfWeek as string)
          .split('_')
          .map((n) => parseInt(n, 10))
          .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6)
      : undefined,
    spaceNames: searchParams.spaceNames
      ? (typeof searchParams.spaceNames === 'string'
          ? searchParams.spaceNames.split('|').map((s) => decodeURIComponent(s)).filter(Boolean)
          : [])
      : undefined,
  });

  // Filter programs
  const filteredPrograms = useMemo(() => {
    let result = [...initialPrograms];

    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    if (filters.programIds && filters.programIds.length > 0) {
      result = result.filter(p => filters.programIds!.includes(p.id));
    }

    if (filters.facilityIds && filters.facilityIds.length > 0) {
      result = result.filter(p => {
        if (p.facilityId && filters.facilityIds!.includes(p.facilityId)) {
          return true;
        }
        if (p.sessions) {
          return p.sessions.some(s => 
            s.facility && filters.facilityIds!.includes(String(s.facility.id))
          );
        }
        return false;
      });
    }

    if (filters.programTypes && filters.programTypes.length > 0) {
      result = result.filter(p =>
        p.type && filters.programTypes!.includes(p.type as any)
      );
    }

    if (filters.sports && filters.sports.length > 0) {
      result = result.filter(p =>
        p.sport && filters.sports!.includes(p.sport)
      );
    }

    return result;
  }, [initialPrograms, filters]);

  // Extract filter options
  const filterOptions = useMemo(() => {
    const facilities = new Map<string, { id: string; name: string; count: number }>();
    const sports = new Map<string, number>();
    const programTypes = new Map<string, number>();
    const programs: { id: string; name: string }[] = [];

    initialPrograms.forEach(p => {
      programs.push({ id: p.id, name: p.name });
      
      let facilityId = p.facilityId;
      let facilityName = p.facilityName;
      
      if (!facilityId && p.sessions && p.sessions.length > 0) {
        const sessionWithFacility = p.sessions.find(s => s.facility);
        if (sessionWithFacility?.facility) {
          facilityId = String(sessionWithFacility.facility.id);
          facilityName = sessionWithFacility.facility.name;
        }
      }
      
      if (facilityId) {
        const existing = facilities.get(facilityId);
        if (existing) {
          existing.count++;
        } else {
          facilities.set(facilityId, {
            id: facilityId,
            name: facilityName || facilityId,
            count: 1,
          });
        }
      }
      if (p.sport) {
        sports.set(p.sport, (sports.get(p.sport) || 0) + 1);
      }
      if (p.type) {
        programTypes.set(p.type, (programTypes.get(p.type) || 0) + 1);
      }
    });

    const facilitiesList = Array.from(facilities.values()).sort((a, b) => a.name.localeCompare(b.name));
    return {
      facilities: facilitiesList,
      hasMultipleFacilities: facilitiesList.length > 1,
      sports: Array.from(sports.entries())
        .map(([id, count]) => ({ id, label: id, count }))
        .sort((a, b) => b.count - a.count),
      programTypes: Array.from(programTypes.entries())
        .map(([id, count]) => ({ id, label: id, count }))
        .sort((a, b) => b.count - a.count),
      programs: programs.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [initialPrograms]);

  const handleFiltersChange = useCallback((newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
  }, []);

  // --- Schedule events state & fetching (mirrors DiscoveryPage) ---
  const [apiEvents, setApiEvents] = useState<any[]>(initialScheduleEvents);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsFetched, setEventsFetched] = useState(initialEventsFetched);
  const [totalServerEvents, setTotalServerEvents] = useState(initialTotalServerEvents);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const contentTimedRef = useRef(false);
  useEffect(() => {
    if (contentTimedRef.current) return;
    const hasContent = viewMode === 'schedule' ? eventsFetched : initialPrograms.length > 0;
    if (hasContent) {
      contentTimedRef.current = true;
      const ttc = Math.round(performance.now());
      console.log(`[perf] time-to-content: ${ttc}ms (${viewMode} embed, ${config.slug})`);
    }
  }, [viewMode, eventsFetched, initialPrograms.length, config.slug]);

  useEffect(() => {
    if (viewMode !== 'schedule' || eventsFetched) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;
    setEventsLoading(true);
    setEventsError(null);

    const params = new URLSearchParams();
    params.set('slug', config.slug);
    const fetchStart = performance.now();
    fetch(`/api/events?${params.toString()}`, { signal: ac.signal })
      .then(res => { if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); })
      .then(data => {
        if (ac.signal.aborted) return;
        const total = data?.meta?.totalFiltered ?? data?.data?.length ?? 0;
        const fetchMs = Math.round(performance.now() - fetchStart);
        console.log(`[perf] embed events fetch: ${fetchMs}ms (${data?.data?.length ?? 0}/${total} events)`);
        if (data && Array.isArray(data.data)) {
          setApiEvents(data.data);
          setTotalServerEvents(total);
          setEventsFetched(true);
        }
      })
      .catch(err => {
        if (ac.signal.aborted || err?.name === 'AbortError') return;
        setEventsError('Failed to load events');
        setEventsFetched(true);
      })
      .finally(() => { if (!ac.signal.aborted) setEventsLoading(false); });

    return () => ac.abort();
  }, [viewMode, eventsFetched, config.slug]);

  const loadMoreEvents = useCallback(() => {
    if (loadingMore || apiEvents.length >= totalServerEvents) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    params.set('slug', config.slug);
    params.set('limit', '200');
    params.set('offset', String(apiEvents.length));
    fetch(`/api/events?${params.toString()}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`${res.status}`)))
      .then(data => {
        if (data && Array.isArray(data.data)) {
          setApiEvents(prev => [...prev, ...data.data]);
        }
      })
      .catch(err => console.error('Error loading more events:', err))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, apiEvents.length, totalServerEvents, config.slug]);

  const cacheV2Enabled = config.features.discoveryCacheEnabled !== false;
  const eventsCount = apiEvents.length;
  useEffect(() => {
    if (!cacheV2Enabled || eventsCount === 0) return;

    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('slug', config.slug);
    params.set('mode', 'availability');

    fetch(`/api/events?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Availability API error: ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (!payload?.data || !Array.isArray(payload.data)) return;
        const byId = new Map<string, any>();
        payload.data.forEach((item: any) => byId.set(String(item.id), item));

        setApiEvents((prev) =>
          prev.map((event) => {
            const a = byId.get(String(event.id));
            if (!a) return event;
            return {
              ...event,
              ...(a.spotsRemaining !== undefined ? { spotsRemaining: a.spotsRemaining } : {}),
              ...(a.maxParticipants !== undefined ? { maxParticipants: a.maxParticipants } : {}),
              ...(a.currentParticipants !== undefined ? { currentParticipants: a.currentParticipants } : {}),
              ...(a.isWaitlistEnabled !== undefined ? { isWaitlistEnabled: a.isWaitlistEnabled } : {}),
              ...(a.waitlistCount !== undefined ? { waitlistCount: a.waitlistCount } : {}),
            };
          })
        );
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        console.error('Availability refresh error:', error);
      });

    return () => controller.abort();
  }, [cacheV2Enabled, config.slug, eventsCount]);

  const scheduleSpaceOptions = useMemo(() => {
    const m = new Map<string, number>();
    apiEvents.forEach((e: { spaceName?: string }) => {
      const sn = (e.spaceName || '').trim();
      if (sn) m.set(sn, (m.get(sn) || 0) + 1);
    });
    return Array.from(m.entries())
      .map(([id, count]) => ({ id, name: id, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [apiEvents]);

  const filteredEvents = useMemo(() => {
    let result = [...apiEvents];
    if (filters.programIds && filters.programIds.length > 0) {
      const selectedPrograms = initialPrograms.filter(p => filters.programIds!.includes(p.id));
      result = result.filter(event => {
        if (filters.programIds!.includes(event.programId)) return true;
        const eventName = (event.programName || '').toLowerCase().trim();
        return selectedPrograms.some(p => p.name.toLowerCase().trim() === eventName);
      });
    }
    if (filters.sports && filters.sports.length > 0) {
      result = result.filter(e => e.sport && filters.sports!.includes(e.sport));
    }
    if (filters.facilityIds && filters.facilityIds.length > 0) {
      result = result.filter(e => {
        if (!e.facilityName) return false;
        return filters.facilityIds!.some(fid =>
          initialPrograms.some(p =>
            (p.facilityId === fid || p.sessions?.some((s: any) => String(s.facility?.id) === fid)) &&
            p.name.toLowerCase().trim() === (e.programName || '').toLowerCase().trim()
          )
        );
      });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.programName?.toLowerCase().includes(q) ||
          e.sessionName?.toLowerCase().includes(q) ||
          e.facilityName?.toLowerCase().includes(q) ||
          (e.spaceName && e.spaceName.toLowerCase().includes(q)),
      );
    }
    if (filters.spaceNames && filters.spaceNames.length > 0) {
      result = result.filter((e) => eventMatchesSpaceNames(e, filters.spaceNames));
    }
    if (filters.programTypes && filters.programTypes.length > 0) {
      result = result.filter(
        (e) => e.type && filters.programTypes!.includes(e.type as ProgramType),
      );
    }
    if (config.features.showScheduleTableDateFilters) {
      if (filters.dateRange?.start || filters.dateRange?.end) {
        result = result.filter((e) => eventMatchesDateRange(e, filters.dateRange));
      }
      if (filters.daysOfWeek && filters.daysOfWeek.length > 0) {
        result = result.filter((e) => eventMatchesDaysOfWeek(e, filters.daysOfWeek));
      }
    }
    return result;
  }, [apiEvents, filters, initialPrograms, config.features.showScheduleTableDateFilters]);

  const leagueTableMode = useMemo(
    () => isLeagueScheduleTableContext(config, filters, initialPrograms),
    [config, filters, initialPrograms],
  );

  const scheduleData = useMemo(() => {
    if (viewMode !== 'schedule') return null;
    const calendarEvents = filteredEvents.map(event => {
      const getLocal = (utc: string, tz?: string) => {
        try {
          const d = new Date(utc);
          return { date: d.toLocaleDateString('en-CA', { timeZone: tz || 'America/New_York' }), time: utc };
        } catch { return { date: utc.split('T')[0], time: utc }; }
      };
      const start = getLocal(event.startDate, event.timezone);
      const end = getLocal(event.endDate, event.timezone);
      return {
        id: event.id, programId: event.programId || '', programName: event.programName || event.title,
        sessionId: event.sessionId || '', sessionName: event.sessionName || '',
        title: event.title || event.sessionName || event.programName,
        date: start.date, startTime: start.time, endTime: end.time,
        timezone: event.timezone, facilityId: '', facilityName: event.facilityName || '',
        spaceName: event.spaceName || '', sport: event.sport,
        programType: event.type as ProgramType | undefined,
        type: event.type,
        linkSEO: event.linkSEO, color: getSportGradient(event.sport || ''),
        maxParticipants: event.maxParticipants, currentParticipants: event.currentParticipants,
        spotsRemaining: event.spotsRemaining, startingPrice: event.startingPrice,
        memberPrice: event.memberPrice, registrationWindowStatus: event.registrationWindowStatus,
        isWaitlistEnabled: event.isWaitlistEnabled, waitlistCount: event.waitlistCount,
        segmentId: event.segmentId, segmentName: event.segmentName, isSegmented: event.isSegmented,
        hasPunchPassProduct: Boolean(event.hasPunchPassProduct),
      };
    });
    return buildWeekSchedules(calendarEvents, 8);
  }, [filteredEvents, viewMode]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header for Embed */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200">
        <div className="px-4 py-2 flex items-center justify-between">
          {/* View Toggle */}
          {config.features.allowViewToggle && (
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('programs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'programs'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid3X3 size={14} />
                Programs
              </button>
              <button
                onClick={() => setViewMode('schedule')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar size={14} />
                Schedule
              </button>
            </div>
          )}
          
          <span className="text-sm text-gray-500">
            {filteredPrograms.length} programs
          </span>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <HorizontalFilterBar
          filters={filters}
          onFilterChange={handleFiltersChange}
          filterOptions={{
            facilities: filterOptions.facilities.map(f => ({ 
              id: f.id, 
              name: f.name, 
              count: filteredPrograms.filter(p => 
                p.facilityId === f.id || 
                p.sessions?.some(s => String(s.facility?.id) === f.id)
              ).length 
            })),
            programTypes: filterOptions.programTypes.map(t => ({ 
              id: t.id, 
              name: t.label, 
              count: filteredPrograms.filter(p => p.type === t.id).length 
            })),
            sports: filterOptions.sports.map(s => ({ 
              id: s.id, 
              name: s.label, 
              count: filteredPrograms.filter(p => p.sport === s.id).length 
            })),
            programs: filterOptions.programs.filter(p => 
              filteredPrograms.some(fp => fp.id === p.id)
            ),
            ages: [],
            hasMultipleFacilities: filterOptions.hasMultipleFacilities,
            spaces: scheduleSpaceOptions,
          }}
          config={config}
          isScheduleView={viewMode === 'schedule'}
        />
      </div>

      {/* Content */}
      <main className="px-4">
        {viewMode === 'programs' ? (
          <ProgramGrid
            programs={filteredPrograms}
            config={config}
          />
        ) : (
          <ScheduleView
            schedule={scheduleData || []}
            config={config}
            isLoading={eventsLoading}
            error={eventsError}
            totalEvents={filteredEvents.length}
            totalServerEvents={totalServerEvents}
            onLoadMore={loadMoreEvents}
            loadingMore={loadingMore}
            hasMultipleFacilities={filterOptions.hasMultipleFacilities}
            linkTarget={linkTarget}
            hideRegistrationLinks={config.features.hideRegistrationLinks}
            customRegistrationUrl={config.features.customRegistrationUrl}
            filters={config.features.showScheduleTableDateFilters ? filters : undefined}
            onScheduleFiltersChange={
              config.features.showScheduleTableDateFilters ? handleFiltersChange : undefined
            }
            initialUrlScheduleView={scheduleViewParamFromPageSearchParams(searchParams)}
            leagueTableMode={leagueTableMode}
          />
        )}
      </main>
    </div>
  );
}
