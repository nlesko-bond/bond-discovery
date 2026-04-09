'use client';

import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  List,
  Clock,
  MapPin,
  Users,
  Tag,
  Shield,
  X,
  ExternalLink,
  LayoutGrid,
  Loader2,
  Download,
  FileText,
  CalendarPlus,
  FileSpreadsheet,
  Table2,
  ChevronDown,
  ChevronUp,
  Ticket
} from 'lucide-react';
import { WeekSchedule, DaySchedule, CalendarEvent, DiscoveryConfig, DiscoveryFilters } from '@/types';
import { formatDate, formatTime, formatPrice, getSportLabel, getProgramTypeLabel, buildRegistrationUrl, cn } from '@/lib/utils';
import { bondAnalytics } from '@/lib/analytics';
import { eventShowsRedeemPass, getPunchPassRedeemUrl, trackRedeemPassClick } from '@/lib/schedule-redeem';
import { format, parseISO, startOfMonth, addMonths, subMonths, isToday, isSameDay } from 'date-fns';
import { DayView, WeekGridView, MonthView } from './calendar';
import { ScheduleTableFilterBar } from './ScheduleTableFilterBar';
import {
  Skeleton,
  ScheduleViewSkeleton,
  ScheduleTableSkeleton,
  ScheduleViewportUnresolvedPlaceholder,
} from '@/components/ui/Skeleton';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import {
  isNarrowScheduleViewport,
  readAllowTableOnMobileFromFeatures,
  resolveScheduleViewMode,
  SCHEDULE_VIEW_NARROW_MEDIA_QUERY,
  shouldRewriteScheduleViewParam,
  VALID_SCHEDULE_VIEW_MODES,
} from '@/lib/schedule-view-resolution';

type ViewMode = 'list' | 'table' | 'day' | 'week' | 'month';

/** When set (including `null`), initial `scheduleView` matches the server page — avoids useSearchParams() hydration mismatch. Omit in tests to use the hook only. */
function initialScheduleViewParamForHydration(
  serverParam: string | null | undefined,
  searchParams: { get: (name: string) => string | null },
): string | null {
  if (serverParam !== undefined) {
    return serverParam;
  }
  return searchParams.get('scheduleView');
}
type TableColumn =
  | 'date'
  | 'time'
  | 'event'
  | 'program'
  | 'location'
  | 'space'
  | 'spots'
  | 'action';

function formatEventCountForHydration(n: number | undefined): string {
  return (n ?? 0).toLocaleString('en-US');
}

interface ScheduleViewProps {
  schedule: WeekSchedule[];
  config: DiscoveryConfig;
  scheduleThemeStyle?: 'gradient' | 'solid';
  isLoading?: boolean;
  error?: string | null;
  totalEvents?: number;
  totalServerEvents?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMultipleFacilities?: boolean;
  linkTarget?: '_blank' | '_top' | '_self';
  hideRegistrationLinks?: boolean;
  customRegistrationUrl?: string;
  filters?: DiscoveryFilters;
  onScheduleFiltersChange?: (next: DiscoveryFilters) => void;
  /** From page `searchParams` via `scheduleViewParamFromPageSearchParams` — keeps SSR and first client render aligned. */
  initialUrlScheduleView?: string | null;
}

export function ScheduleView({
  schedule,
  config,
  scheduleThemeStyle,
  isLoading,
  error,
  totalEvents,
  totalServerEvents,
  onLoadMore,
  loadingMore,
  hasMultipleFacilities,
  linkTarget = '_blank',
  hideRegistrationLinks = false,
  customRegistrationUrl,
  filters,
  onScheduleFiltersChange,
  initialUrlScheduleView,
}: ScheduleViewProps) {
  const searchParams = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const router = useRouter();
  const pathname = usePathname();
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [isTableAllowed, setIsTableAllowed] = useState(true);
  
  // Dynamic colors from config
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const resolvedThemeStyle = scheduleThemeStyle || config.features.scheduleThemeStyle || 'gradient';
  const themeHeaderBackground =
    resolvedThemeStyle === 'solid'
      ? primaryColor
      : `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`;
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Sticky positioning uses CSS variable --sticky-offset set by parent DiscoveryPage
  // This dynamically measures the actual header height for proper positioning

  const allowTableOnMobile = readAllowTableOnMobileFromFeatures(config.features);
  const desktopDefaultView =
    (config.features.defaultScheduleView as ViewMode) || 'list';
  const mobileDefaultRaw =
    config.features.mobileDefaultScheduleView as ViewMode | undefined;

  const scheduleResolutionOpts = useMemo(
    () => ({
      allowTableOnMobile,
      desktopDefaultView,
      mobileDefaultRaw,
    }),
    [allowTableOnMobile, desktopDefaultView, mobileDefaultRaw],
  );

  /** When table is not allowed on a narrow viewport, fall back (never table). */
  const tableEscapeFallback = useCallback((): ViewMode => {
    if (
      mobileDefaultRaw &&
      VALID_SCHEDULE_VIEW_MODES.includes(mobileDefaultRaw) &&
      mobileDefaultRaw !== 'table'
    ) {
      return mobileDefaultRaw;
    }
    if (desktopDefaultView !== 'table') {
      return desktopDefaultView;
    }
    return 'list';
  }, [mobileDefaultRaw, desktopDefaultView]);

  // Until client layout runs, avoid SSR desktop-default (e.g. table) HTML when there is no
  // explicit scheduleView — phones would see that for seconds before hydration.
  // Seed from server searchParams when provided so SSR HTML matches the first client render
  // (useSearchParams alone can disagree during hydration).
  const [scheduleViewportResolved, setScheduleViewportResolved] = useState(() => {
    const u = initialScheduleViewParamForHydration(
      initialUrlScheduleView,
      searchParams,
    );
    return !!(u && VALID_SCHEDULE_VIEW_MODES.includes(u as ViewMode));
  });

  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const u = initialScheduleViewParamForHydration(
      initialUrlScheduleView,
      searchParams,
    );
    if (u && VALID_SCHEDULE_VIEW_MODES.includes(u as ViewMode)) {
      return u as ViewMode;
    }
    return 'list';
  });

  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const scheduleViewParam = searchParams.get('scheduleView');

  const applyResolvedScheduleView = useCallback(() => {
    if (typeof window === 'undefined') return;
    const narrow = isNarrowScheduleViewport();
    const raw = searchParamsRef.current.get('scheduleView');

    const target = resolveScheduleViewMode(raw, narrow, scheduleResolutionOpts);

    setIsTableAllowed(allowTableOnMobile || !narrow);

    if (viewModeRef.current !== target) {
      viewModeRef.current = target;
      setViewModeState(target);
    }

    const p = new URLSearchParams(searchParamsRef.current.toString());
    const urlSchedule = p.get('scheduleView');
    const mayRewrite = shouldRewriteScheduleViewParam(
      raw,
      narrow,
      allowTableOnMobile,
      target,
    );
    if (mayRewrite && urlSchedule !== target) {
      p.set('scheduleView', target);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [pathname, router, scheduleViewParam, scheduleResolutionOpts]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    applyResolvedScheduleView();
    setScheduleViewportResolved(true);
    setSelectedDayDate((d) => d ?? new Date().toISOString().split('T')[0]);
    setCurrentMonth((m) => m ?? startOfMonth(new Date()));
  }, [applyResolvedScheduleView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(SCHEDULE_VIEW_NARROW_MEDIA_QUERY);
    const onChange = () => applyResolvedScheduleView();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [applyResolvedScheduleView]);

  // Update URL when view mode changes
  const setViewMode = useCallback(
    (newMode: ViewMode) => {
      const narrow =
        typeof window !== 'undefined' && isNarrowScheduleViewport();
      let next = newMode;
      if (next === 'table' && narrow && !allowTableOnMobile) {
        next = tableEscapeFallback();
      }
      setViewModeState(next);

      const params = new URLSearchParams(searchParamsRef.current.toString());
      params.set('scheduleView', next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, allowTableOnMobile, tableEscapeFallback],
  );
  
  // Defer to useLayoutEffect so server and client first paint match (Date()/timezone differs in SSR).
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  
  // Lazy loading for list view
  const [visibleDays, setVisibleDays] = useState(14); // Start with 2 weeks
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  
  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentWeek = schedule[currentWeekIndex];
  
  // Count events for this week
  const weekEventCount = currentWeek?.days.reduce((sum, day) => sum + day.events.length, 0) || 0;

  // Flatten all events for month view (deduplicated by ID)
  const allEvents = useMemo(() => {
    const all = schedule.flatMap(week => 
      week.days.flatMap(day => day.events)
    );
    // Deduplicate by event ID to prevent React key conflicts
    const seen = new Set<string>();
    return all.filter(event => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
  }, [schedule]);
  
  // Resolve the canonical IANA timezone from events (single source of truth)
  const scheduleTimezone = useMemo(() => {
    return allEvents.find(e => e.timezone)?.timezone ?? undefined;
  }, [allEvents]);

  // Friendly label for the header
  const displayTimezone = useMemo(() => {
    if (!scheduleTimezone) return null;
    const tzMap: Record<string, string> = {
      'America/New_York': 'ET',
      'America/Chicago': 'CT',
      'America/Denver': 'MT',
      'America/Los_Angeles': 'PT',
      'America/Phoenix': 'AZ',
      'America/Anchorage': 'AK',
      'Pacific/Honolulu': 'HT',
    };
    return tzMap[scheduleTimezone] || scheduleTimezone;
  }, [scheduleTimezone]);

  // Generate iCal content
  const generateICal = useCallback(() => {
    const events = allEvents;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bond Sports//Discovery//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];
    
    events.forEach(event => {
      const startDate = new Date(event.startTime || event.date);
      const endDate = event.endTime ? new Date(event.endTime) : new Date(startDate.getTime() + 60 * 60 * 1000);
      
      const formatDate = (d: Date) => {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };
      
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id}@bondsports.co`);
      lines.push(`DTSTART:${formatDate(startDate)}`);
      lines.push(`DTEND:${formatDate(endDate)}`);
      lines.push(`SUMMARY:${event.title || event.programName || 'Event'}`);
      const descParts = [event.programName, event.sessionName].filter(Boolean);
      if (descParts.length > 0) lines.push(`DESCRIPTION:${descParts.join(' - ')}`);
      if (event.facilityName) lines.push(`LOCATION:${event.facilityName}`);
      if (event.linkSEO) {
        const url = event.linkSEO.startsWith('http') ? event.linkSEO : `https://bondsports.co${event.linkSEO}`;
        lines.push(`URL:${url}`);
      }
      lines.push('END:VEVENT');
    });
    
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }, [allEvents]);
  
  // Download iCal file
  const handleExportICal = useCallback(() => {
    const icalContent = generateICal();
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [generateICal]);
  
  // Print/PDF export
  const handleExportPDF = useCallback(() => {
    setShowExportMenu(false);
    window.print();
  }, []);
  
  // CSV export
  const handleExportCSV = useCallback(() => {
    const headers = ['Date', 'Time', 'Program', 'Session', 'Location', 'Spots', 'Price', 'Registration Link'];
    const rows = allEvents.map(event => {
      const date = event.startTime ? format(new Date(event.startTime), 'yyyy-MM-dd') : event.date;
      const time = event.startTime ? format(new Date(event.startTime), 'h:mm a') : '';
      const endTime = event.endTime ? format(new Date(event.endTime), 'h:mm a') : '';
      const timeRange = endTime ? `${time} - ${endTime}` : time;
      const link = event.linkSEO ? `https://app.bondsports.co${event.linkSEO}` : '';
      const price = event.startingPrice ? `$${event.startingPrice}` : '';
      const location = [event.facilityName, event.spaceName].filter(Boolean).join(' - ');
      
      return [
        date,
        timeRange,
        event.programName || '',
        event.sessionName || '',
        location,
        event.spotsRemaining !== undefined ? `${event.spotsRemaining} available` : '',
        price,
        link
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [allEvents]);
  
  // Get all days with events (for list view), grouped by date
  const allDaysWithEvents = useMemo(() => {
    const dayMap = new Map<string, DaySchedule>();
    
    schedule.forEach(week => {
      week.days.forEach(day => {
        if (day.events.length > 0) {
          const existing = dayMap.get(day.date);
          if (existing) {
            // Add more events to existing day (will dedupe below)
            existing.events.push(...day.events);
          } else {
            // Create new day entry with a COPY of the events array
            dayMap.set(day.date, { 
              ...day, 
              events: [...day.events] 
            });
          }
        }
      });
    });
    
    // Convert to array and sort days chronologically
    const result = Array.from(dayMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Deduplicate and sort events within each day
    result.forEach(day => {
      // Deduplicate by event ID
      const seen = new Set<string>();
      day.events = day.events.filter(event => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      });
      
      // Sort by start time
      day.events.sort((a, b) => {
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      });
    });
    
    return result;
  }, [schedule]);
  
  // Visible days for lazy loading
  const visibleDaysData = useMemo(() => {
    return allDaysWithEvents.slice(0, visibleDays);
  }, [allDaysWithEvents, visibleDays]);
  
  const hasMoreDays = visibleDays < allDaysWithEvents.length;
  
  // Infinite scroll observer
  useEffect(() => {
    if (viewMode !== 'list' || !hasMoreDays) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleDays(prev => Math.min(prev + 14, allDaysWithEvents.length));
        }
      },
      { threshold: 0.1 }
    );
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    
    return () => observer.disconnect();
  }, [viewMode, hasMoreDays, allDaysWithEvents.length]);

  // Handle day click from month view
  const handleDayClick = (date: string) => {
    setSelectedDayDate(date);
    setViewMode('day');
  };

  if (!scheduleViewportResolved) {
    return (
      <div className="p-4 md:p-6" aria-busy="true">
        <ScheduleViewportUnresolvedPlaceholder />
      </div>
    );
  }

  // Loading state — match skeleton to resolved view to avoid list-shaped → table jump
  if (isLoading) {
    const showTableSkeleton =
      viewMode === 'table' && config.features.showTableView !== false;
    return (
      <div className="p-4 md:p-6">
        {showTableSkeleton ? <ScheduleTableSkeleton /> : <ScheduleViewSkeleton />}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 text-red-400 mx-auto mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Events</h3>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentWeek) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Schedule Available</h3>
          <p className="text-gray-500 text-sm">Check back later for upcoming events.</p>
        </div>
      </div>
    );
  }

  const hasEventsThisWeek = currentWeek.days.some(day => day.events.length > 0);

  return (
    <div>
      {/* Header with stats and controls */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 -mx-3 sm:-mx-4 lg:-mx-6 mb-4">
        <div className="flex items-center justify-between gap-2">
          {/* Event count and timezone - compact */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
              <span><span className="font-semibold" style={{ color: primaryColor }}>{formatEventCountForHydration(totalEvents)}</span> events</span>
            </div>
            {displayTimezone && (
              <span className="text-gray-400">All times {displayTimezone}</span>
            )}
          </div>
          
          {/* View Toggle - consistent button sizes */}
          <div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:gap-1.5 sm:px-3 sm:py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'list'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
              style={viewMode === 'list' ? { color: primaryColor } : undefined}
              title="List View"
            >
              <List size={16} />
              <span className="hidden sm:inline">List</span>
            </button>
            {/* Table View - desktop only when enabled */}
            {config.features.showTableView && isTableAllowed && (
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:gap-1.5 sm:px-3 sm:py-1.5 rounded-md text-sm font-medium transition-all',
                  viewMode === 'table'
                    ? 'bg-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
                style={viewMode === 'table' ? { color: primaryColor } : undefined}
                title="Table View"
              >
                <Table2 size={16} />
                <span className="hidden sm:inline">Table</span>
              </button>
            )}
            <button
              onClick={() => {
                // Default to today, not start of week
                setSelectedDayDate(new Date().toISOString().split('T')[0]);
                setViewMode('day');
              }}
              className={cn(
                'flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:gap-1.5 sm:px-3 sm:py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'day'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
              style={viewMode === 'day' ? { color: primaryColor } : undefined}
              title="Day View"
            >
              <Clock size={16} />
              <span className="hidden sm:inline">Day</span>
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:gap-1.5 sm:px-3 sm:py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'week'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
              style={viewMode === 'week' ? { color: primaryColor } : undefined}
              title="Week View"
            >
              <Calendar size={16} />
              <span className="hidden sm:inline">Week</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:gap-1.5 sm:px-3 sm:py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'month'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
              style={viewMode === 'month' ? { color: primaryColor } : undefined}
              title="Month View"
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Month</span>
            </button>
          </div>
          
          {/* Export Button - hidden in print */}
          <div ref={exportRef} className="relative ml-2 print:hidden">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Export schedule"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export</span>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-48 overflow-hidden print:hidden">
                <button
                  onClick={handleExportICal}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CalendarPlus size={16} style={{ color: secondaryColor }} />
                  <div className="text-left">
                    <div className="font-medium">Add to Calendar</div>
                    <div className="text-xs text-gray-500">Download .ics file</div>
                  </div>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  <FileSpreadsheet size={16} style={{ color: secondaryColor }} />
                  <div className="text-left">
                    <div className="font-medium">Export to CSV</div>
                    <div className="text-xs text-gray-500">Excel compatible</div>
                  </div>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  <FileText size={16} style={{ color: secondaryColor }} />
                  <div className="text-left">
                    <div className="font-medium">Print / PDF</div>
                    <div className="text-xs text-gray-500">Save as PDF</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Navigation - for calendar views (not table - table shows all events flat) */}
      {/* Sticky positioning uses CSS variable --sticky-offset from parent for dynamic header height */}
      <div 
        className={cn(
          viewMode !== 'list' && viewMode !== 'table' && 'sticky z-10 bg-gray-50'
        )}
        style={viewMode !== 'list' && viewMode !== 'table' ? { top: 'var(--sticky-offset, 0px)' } : undefined}
      >
      {viewMode === 'month' ? (
        currentMonth ? (
          <div
            className="flex items-center justify-between px-3 py-3 text-white rounded-t-lg"
            style={{ background: themeHeaderBackground }}
          >
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m!, 1))}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m!, 1))}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        ) : (
          <div
            className="flex items-center justify-between px-3 py-3 text-white rounded-t-lg"
            style={{ background: themeHeaderBackground }}
            aria-busy="true"
          >
            <div className="h-8 w-8 rounded-lg bg-white/20 animate-pulse" />
            <Skeleton className="h-6 w-36 rounded bg-white/25" />
            <div className="h-8 w-8 rounded-lg bg-white/20 animate-pulse" />
          </div>
        )
      ) : viewMode === 'day' ? (
        selectedDayDate ? (
          <div
            className="flex items-center justify-between px-3 py-3 text-white rounded-t-lg"
            style={{ background: themeHeaderBackground }}
          >
            <button
              onClick={() => {
                const currentDate = parseISO(selectedDayDate);
                const prevDate = new Date(currentDate);
                prevDate.setDate(prevDate.getDate() - 1);
                setSelectedDayDate(prevDate.toISOString().split('T')[0]);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-bold">{format(parseISO(selectedDayDate), 'EEE, MMM d')}</h2>
              <button type="button" onClick={() => setViewMode('list')} className="text-xs text-white/70 hover:text-white">← Back to list</button>
            </div>
            <button
              onClick={() => {
                const currentDate = parseISO(selectedDayDate);
                const nextDate = new Date(currentDate);
                nextDate.setDate(nextDate.getDate() + 1);
                setSelectedDayDate(nextDate.toISOString().split('T')[0]);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        ) : (
          <div
            className="flex items-center justify-between px-3 py-3 text-white rounded-t-lg"
            style={{ background: themeHeaderBackground }}
            aria-busy="true"
          >
            <div className="h-8 w-8 rounded-lg bg-white/20 animate-pulse" />
            <Skeleton className="h-6 w-40 rounded bg-white/25" />
            <div className="h-8 w-8 rounded-lg bg-white/20 animate-pulse" />
          </div>
        )
      ) : viewMode === 'list' || viewMode === 'table' ? null : (
        /* Week Navigation - Compact (not for list/table which show all events) */
        <div 
          className="flex items-center justify-between px-3 py-3 text-white rounded-t-lg"
          style={{ background: themeHeaderBackground }}
        >
          <button
            onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
            disabled={currentWeekIndex === 0}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="text-base font-bold">
              {format(parseISO(currentWeek.weekStart), 'MMM d')} - {format(parseISO(currentWeek.weekEnd), 'MMM d, yyyy')}
            </h2>
            <p className="text-xs text-white/70">
              Week {currentWeekIndex + 1} of {schedule.length} {weekEventCount > 0 && `• ${weekEventCount} events`}
            </p>
          </div>
          <button
            onClick={() => setCurrentWeekIndex(Math.min(schedule.length - 1, currentWeekIndex + 1))}
            disabled={currentWeekIndex === schedule.length - 1}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
      </div>

      {/* Day View */}
      {viewMode === 'day' && selectedDayDate && (
        <DayView
          events={allEvents}
          date={selectedDayDate}
          config={config}
          onEventClick={setSelectedEvent}
          linkTarget={linkTarget}
          hideRegistrationLinks={hideRegistrationLinks}
          customRegistrationUrl={customRegistrationUrl}
          scheduleTimezone={scheduleTimezone}
        />
      )}

      {/* Week Grid View */}
      {viewMode === 'week' && currentWeek && (
        <WeekGridView
          days={currentWeek.days}
          config={config}
          onEventClick={setSelectedEvent}
          onDayClick={handleDayClick}
          scheduleTimezone={scheduleTimezone}
        />
      )}

      {/* Month View */}
      {viewMode === 'month' && currentMonth && (
        <MonthView
          events={allEvents}
          currentMonth={currentMonth}
          config={config}
          onDayClick={handleDayClick}
          onEventClick={setSelectedEvent}
        />
      )}

      {/* List View - Shows ALL events with lazy loading */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Show loading if no days yet but events are still loading */}
          {isLoading && visibleDaysData.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading events...</span>
              </div>
            </div>
          )}
          
          {/* Show days with events */}
          {visibleDaysData.map((day) => (
            <ListDaySection
              key={day.date}
              day={day}
              onEventClick={setSelectedEvent}
              config={config}
              scheduleThemeStyle={resolvedThemeStyle}
              hasMultipleFacilities={hasMultipleFacilities}
              linkTarget={linkTarget}
              hideRegistrationLinks={hideRegistrationLinks}
              customRegistrationUrl={customRegistrationUrl}
            />
          ))}
          
          {/* Load More Trigger */}
          {hasMoreDays && (
            <div ref={loadMoreRef} className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading more events...</span>
              </div>
            </div>
          )}
          
          {/* End of list indicator */}
          {!hasMoreDays && allDaysWithEvents.length > 14 && (
            <div className="text-center py-4 text-sm text-gray-400">
              Showing all {allDaysWithEvents.length} days with events
            </div>
          )}
          
          {/* Empty state - only show when not loading and no events */}
          {!isLoading && visibleDaysData.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No events found</p>
            </div>
          )}
        </div>
      )}

      {/* Table View - Desktop only */}
      {viewMode === 'table' && (
        <>
          {config.features.showScheduleTableDateFilters && filters && onScheduleFiltersChange && (
            <ScheduleTableFilterBar
              config={config}
              filters={filters}
              onChange={onScheduleFiltersChange}
            />
          )}
          <TableView
            events={allDaysWithEvents.flatMap(day => day.events)}
            onEventClick={setSelectedEvent}
            config={config}
            scheduleThemeStyle={resolvedThemeStyle}
            hasMultipleFacilities={hasMultipleFacilities}
            isLoading={isLoading}
            linkTarget={linkTarget}
            hideRegistrationLinks={hideRegistrationLinks}
            customRegistrationUrl={customRegistrationUrl}
            totalServerEvents={totalServerEvents}
            onLoadMore={onLoadMore}
            loadingMore={loadingMore}
          />
        </>
      )}

      {/* Empty State - only for week mode */}
      {viewMode === 'week' && !hasEventsThisWeek && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No events scheduled this week</p>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          config={config}
          scheduleThemeStyle={resolvedThemeStyle}
          linkTarget={linkTarget}
          hideRegistrationLinks={hideRegistrationLinks}
          customRegistrationUrl={customRegistrationUrl}
        />
      )}
    </div>
  );
}

// Day Column for Calendar View
function DayColumn({
  day,
  onEventClick,
  config,
}: {
  day: DaySchedule;
  onEventClick: (event: CalendarEvent) => void;
  config: DiscoveryConfig;
}) {
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  
  return (
    <div
      className={cn(
        'min-h-[120px] md:min-h-[200px] p-1 md:p-2 border border-t-0 rounded-b-lg space-y-1 overflow-y-auto max-h-[300px] md:max-h-[400px]',
        day.isPast && 'opacity-50'
      )}
      style={day.isToday ? { 
        backgroundColor: `${secondaryColor}08`, 
        borderColor: `${secondaryColor}30` 
      } : undefined}
    >
      {day.events.slice(0, 5).map((event) => (
        <button
          key={event.id}
          onClick={() => onEventClick(event)}
          className="w-full text-left p-1.5 rounded text-xs transition-all hover:bg-gray-100 border-l-2"
          style={{ borderLeftColor: event.color || secondaryColor }}
        >
          <div className="font-medium text-gray-900 line-clamp-1 text-[10px] md:text-xs">
            {event.title || event.programName}
          </div>
          <div className="text-gray-500 text-[9px] md:text-[10px]">
            {formatTime(event.startTime, event.timezone)}
          </div>
        </button>
      ))}
      {day.events.length > 5 && (
        <button 
          className="w-full text-center text-[10px] font-medium py-1"
          style={{ color: secondaryColor }}
        >
          +{day.events.length - 5} more
        </button>
      )}
      {day.events.length === 0 && (
        <p className="text-[10px] text-gray-400 text-center py-2">-</p>
      )}
    </div>
  );
}

// List Day Section
function ListDaySection({
  day,
  onEventClick,
  config,
  scheduleThemeStyle = 'gradient',
  hasMultipleFacilities,
  linkTarget = '_blank',
  hideRegistrationLinks = false,
  customRegistrationUrl,
}: {
  day: DaySchedule;
  hasMultipleFacilities?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  config: DiscoveryConfig;
  scheduleThemeStyle?: 'gradient' | 'solid';
  linkTarget?: '_blank' | '_top' | '_self';
  hideRegistrationLinks?: boolean;
  customRegistrationUrl?: string;
}) {
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const dayHeaderBackground =
    scheduleThemeStyle === 'solid'
      ? primaryColor
      : `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`;
  
  if (day.events.length === 0) return null;

  return (
    <section 
      className="relative"
      aria-label={`Events for ${format(parseISO(day.date), 'EEEE, MMMM d')}`}
    >
      {/* Day Header - sticky with brand gradient, uses CSS variable for dynamic positioning */}
      <header 
        className="sticky z-20 flex items-center gap-3 px-4 py-3 text-white rounded-t-xl shadow-md"
        style={{ 
          top: 'var(--sticky-offset, 0px)',
          background: dayHeaderBackground,
        }}
      >
        <div className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shadow-sm bg-white/20">
          <span className="text-xs font-medium text-white/80" aria-hidden="true">
            {day.dayOfWeek?.slice(0, 3) || format(parseISO(day.date), 'EEE')}
          </span>
          <span className="text-lg font-bold text-white" aria-hidden="true">
            {format(parseISO(day.date), 'd')}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white text-base">
            {format(parseISO(day.date), 'EEEE, MMMM d')}
          </h3>
          <p className="text-sm text-white/70">
            {day.events.length} event{day.events.length !== 1 ? 's' : ''}
          </p>
        </div>
        {day.isToday && (
          <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-medium">
            Today
          </span>
        )}
      </header>
      
      {/* Events List */}
      <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 border-t-0 p-2 md:p-3 space-y-2">
        {day.events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onClick={() => onEventClick(event)}
            config={config}
            scheduleThemeStyle={scheduleThemeStyle}
            showFacility={hasMultipleFacilities}
            linkTarget={linkTarget}
            hideRegistrationLinks={hideRegistrationLinks}
            customRegistrationUrl={customRegistrationUrl}
          />
        ))}
      </div>
    </section>
  );
}

// Event Card for List View
function EventCard({
  event,
  onClick,
  config,
  scheduleThemeStyle = 'gradient',
  showFacility = true,
  linkTarget = '_blank',
  hideRegistrationLinks = false,
  customRegistrationUrl,
}: {
  event: CalendarEvent;
  onClick: () => void;
  config: DiscoveryConfig;
  scheduleThemeStyle?: 'gradient' | 'solid';
  showFacility?: boolean;
  linkTarget?: '_blank' | '_top' | '_self';
  hideRegistrationLinks?: boolean;
  customRegistrationUrl?: string;
}) {
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const accentBackground =
    scheduleThemeStyle === 'solid'
      ? secondaryColor
      : `linear-gradient(to bottom, ${primaryColor}, ${secondaryColor})`;
  
  const spotsInfo = event.spotsRemaining !== undefined;
  const isFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 0;
  const isAlmostFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 5 && !isFull;
  
  // Check registration status
  const isRegistrationOpen = event.registrationWindowStatus === 'open';
  const isRegistrationClosed = event.registrationWindowStatus === 'closed' || event.registrationWindowStatus === 'ended';
  const isRegistrationNotYetOpen = event.registrationWindowStatus === 'not_opened_yet';
  const isRegistrationUnavailable = isRegistrationClosed || isRegistrationNotYetOpen;
  const isWaitlistJoinable = Boolean(event.isWaitlistEnabled && isFull && isRegistrationOpen);

  // Get start time - try multiple sources
  const startTimeStr = formatTime(event.startTime, event.timezone) || formatTime(event.date, event.timezone) || '';
  const endTimeStr = event.endTime ? formatTime(event.endTime, event.timezone) : '';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left group transition-all',
        isFull && !isWaitlistJoinable && 'opacity-60'
      )}
    >
      {/* Card with prominent left accent */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all hover:shadow-sm">
        {/* Left accent bar - uses brand gradient */}
        <div 
          className="w-1.5 flex-shrink-0" 
          style={{ background: accentBackground }}
        />
        
        {/* Content */}
        <div className="flex-1 p-3 sm:p-4">
          {/* Top row: Time + badges */}
          <div className="flex items-start sm:items-center justify-between gap-2 mb-1.5 flex-wrap sm:flex-nowrap">
            {/* Time - simple text */}
            <div className="flex items-center gap-1.5 text-sm text-gray-700">
              <Clock size={14} className="text-gray-400" />
              <span className="font-semibold">
                {startTimeStr || 'TBD'}
                {endTimeStr && ` – ${endTimeStr}`}
              </span>
            </div>
            
            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isRegistrationClosed && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  Registration Closed
                </span>
              )}
              {isRegistrationNotYetOpen && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                  Coming Soon
                </span>
              )}
              {config.features.showAvailability && spotsInfo && !isRegistrationUnavailable && (
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  isFull && 'bg-red-100 text-red-700',
                  isAlmostFull && 'bg-yellow-100 text-yellow-700',
                  !isFull && !isAlmostFull && 'bg-green-100 text-green-700'
                )}>
                  {isWaitlistJoinable ? 'Waitlist Open' : (isFull ? 'Full' : `${event.spotsRemaining} left`)}
                </span>
              )}
              {config.features.showMembershipBadges && event.membershipRequired && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  <Shield size={10} />
                  Member
                </span>
              )}
            </div>
          </div>
          
          {/* Event title */}
          <h4 
            className="font-bold text-gray-900 line-clamp-1 text-base transition-colors"
            style={{ '--hover-color': secondaryColor } as React.CSSProperties}
          >
            <span className="group-hover:opacity-80">{event.title || event.programName}</span>
          </h4>
          
          {/* Session name if different */}
          {event.sessionName && event.sessionName !== event.programName && event.sessionName !== event.title && (
            <p className="text-sm text-gray-500 line-clamp-1">
              {event.sessionName}
            </p>
          )}

          {/* Details row - show space name (most specific) or facility name */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            {/* Program type pill */}
            {event.programType && (
              <span 
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ 
                  backgroundColor: `${secondaryColor}15`, 
                  color: secondaryColor 
                }}
              >
                {getProgramTypeLabel(event.programType)}
              </span>
            )}
            {(event.spaceName || (showFacility && event.facilityName)) && (
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" />
                {/* Show both facility and space when multiple facilities */}
                {showFacility && event.facilityName && event.spaceName 
                  ? `${event.facilityName} - ${event.spaceName}`
                  : (event.spaceName || event.facilityName)
                }
              </span>
            )}
            {/* Waitlist indicator */}
            {event.isWaitlistEnabled && (
              <span className="flex items-center gap-1 text-xs text-purple-600">
                <Users size={12} />
                Waitlist
              </span>
            )}
            
            {config.features.showPricing && event.startingPrice !== undefined && (
              <span className="font-bold text-gray-900">
                {event.startingPrice === 0 
                  ? (event.memberPrice === 0 ? 'Included' : 'FREE')
                  : formatPrice(event.startingPrice)}
              </span>
            )}
            {config.features.showPricing && event.memberPrice === 0 && event.startingPrice !== 0 && (
              <span className="text-xs text-amber-600 font-medium">Free for Members</span>
            )}
            
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {!hideRegistrationLinks && event.linkSEO && (
                <a 
                  href={customRegistrationUrl || buildRegistrationUrl(event.linkSEO, { isRegistrationOpen })}
                  target={linkTarget}
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isRegistrationUnavailable) {
                      gtmEvent.clickRegister({
                        programId: event.programId,
                        programName: event.programName,
                        sessionId: event.sessionId,
                        sessionName: event.sessionName,
                      });
                      bondAnalytics.clickRegister(config.slug, {
                        programId: event.programId,
                        programName: event.programName,
                        sessionId: event.sessionId,
                        sessionName: event.sessionName,
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1 font-medium hover:opacity-80"
                  style={{ color: isRegistrationUnavailable ? '#6B7280' : secondaryColor }}
                >
                  {isRegistrationUnavailable ? 'Learn More' : (isWaitlistJoinable ? 'Join Waitlist' : 'Register')} {config.features.showRegisterIcon !== false && <ExternalLink size={12} />}
                </a>
              )}
              {eventShowsRedeemPass(event, config) && (
                <a
                  href={getPunchPassRedeemUrl(config)}
                  target={linkTarget}
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackRedeemPassClick(config, event);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border hover:opacity-90"
                  style={{ color: secondaryColor, borderColor: `${secondaryColor}55`, backgroundColor: `${secondaryColor}10` }}
                >
                  <Ticket size={12} />
                  Redeem
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// Event Detail Modal
function EventDetailModal({
  event,
  onClose,
  config,
  scheduleThemeStyle = 'gradient',
  linkTarget = '_blank',
  hideRegistrationLinks = false,
  customRegistrationUrl,
}: {
  event: CalendarEvent;
  onClose: () => void;
  config: DiscoveryConfig;
  scheduleThemeStyle?: 'gradient' | 'solid';
  linkTarget?: '_blank' | '_top' | '_self';
  hideRegistrationLinks?: boolean;
  customRegistrationUrl?: string;
}) {
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const modalHeaderBackground =
    scheduleThemeStyle === 'solid'
      ? primaryColor
      : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;
  const ctaBackground =
    scheduleThemeStyle === 'solid'
      ? primaryColor
      : `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`;
  const isRegistrationOpen = event.registrationWindowStatus === 'open';
  const isRegistrationClosed = event.registrationWindowStatus === 'closed' || event.registrationWindowStatus === 'ended';
  const isRegistrationNotYetOpen = event.registrationWindowStatus === 'not_opened_yet';
  const isRegistrationUnavailable = isRegistrationClosed || isRegistrationNotYetOpen;
  const isFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 0;
  const isWaitlistJoinable = Boolean(event.isWaitlistEnabled && isFull && isRegistrationOpen);
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-xl max-h-[85vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with program info */}
        <div 
          className="p-5 text-white relative"
          style={{ background: modalHeaderBackground }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-white" />
          </button>
          
          <div className="pr-10">
            <h3 className="text-xl font-bold leading-tight">
              {event.programName || 'Event Details'}
            </h3>
            {event.sessionName && event.sessionName !== event.programName && (
              <p className="text-white/90 mt-1">{event.sessionName}</p>
            )}
            {(event.sport || event.programType || isRegistrationUnavailable) && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {isRegistrationClosed && (
                  <span className="text-xs bg-white/30 px-2.5 py-1 rounded-full font-medium">
                    Registration Closed
                  </span>
                )}
                {isRegistrationNotYetOpen && (
                  <span className="text-xs bg-white/30 px-2.5 py-1 rounded-full font-medium">
                    Coming Soon
                  </span>
                )}
                {event.sport && (
                  <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full capitalize">
                    {getSportLabel(event.sport)}
                  </span>
                )}
                {event.programType && (
                  <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full">
                    {getProgramTypeLabel(event.programType)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[50vh]">
          {/* Date & Time */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: secondaryColor }} />
            <div>
              <p className="font-semibold text-gray-900">{formatDate(event.date, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-sm text-gray-600">
                {formatTime(event.startTime, event.timezone)}
                {event.endTime && ` - ${formatTime(event.endTime, event.timezone)}`}
              </p>
            </div>
          </div>

          {/* Location */}
          {(event.facilityName || event.spaceName || event.location) && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: secondaryColor }} />
              <div>
                <p className="font-semibold text-gray-900">{event.facilityName}</p>
                {event.spaceName && (
                  <p className="text-sm font-medium" style={{ color: secondaryColor }}>{event.spaceName}</p>
                )}
                {event.location && <p className="text-sm text-gray-600">{event.location}</p>}
              </div>
            </div>
          )}

          {/* Capacity */}
          {config.features.showAvailability && event.spotsRemaining !== undefined && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Users className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: secondaryColor }} />
              <div>
                <p className="font-semibold text-gray-900">
                  {event.maxParticipants !== undefined
                    ? `${event.currentParticipants || 0} / ${event.maxParticipants} Enrolled`
                    : `${event.currentParticipants || 0} Enrolled`}
                </p>
                {event.spotsRemaining !== undefined && (
                  <p className={cn(
                    'text-sm font-medium',
                    event.spotsRemaining <= 0 && 'text-red-600',
                    event.spotsRemaining > 0 && event.spotsRemaining <= 5 && 'text-yellow-600',
                    event.spotsRemaining > 5 && 'text-green-600'
                  )}>
                    {isWaitlistJoinable
                      ? 'No spots available - Waitlist open'
                      : (event.spotsRemaining <= 0 ? 'No spots available' : `${event.spotsRemaining} spots remaining`)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pricing Section */}
          {config.features.showPricing && (event.startingPrice !== undefined || event.membershipRequired) && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Tag className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: secondaryColor }} />
              <div className="flex-1">
                {event.startingPrice !== undefined && event.startingPrice > 0 ? (
                  <>
                    <p className="font-semibold text-gray-900 text-lg">{formatPrice(event.startingPrice)}</p>
                    {event.memberPrice !== undefined && event.memberPrice < event.startingPrice && (
                      <div className="mt-1 p-2 bg-amber-50 rounded border border-amber-200">
                        <p className="text-sm text-amber-700 font-medium flex items-center gap-1.5">
                          <Shield size={12} />
                          {event.memberPrice === 0 
                            ? 'Free for Members' 
                            : `Member price: ${formatPrice(event.memberPrice)}`}
                        </p>
                        {event.memberPrice > 0 && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Save {formatPrice(event.startingPrice - event.memberPrice)}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : event.startingPrice === 0 ? (
                  <p className="font-semibold text-green-600 text-lg">
                    {event.memberPrice === 0 ? 'Included with Membership' : 'FREE'}
                  </p>
                ) : (
                  <p className="text-gray-600">Contact for pricing</p>
                )}
                
                {config.features.showMembershipBadges && event.membershipRequired && (
                  <div className="mt-2 flex items-center gap-1.5 text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                    <Shield size={14} />
                    <span className="text-sm font-medium">Membership required</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* No pricing available message */}
          {config.features.showPricing && event.startingPrice === undefined && !event.membershipRequired && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Tag className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500 text-sm">Pricing details available upon registration</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(!hideRegistrationLinks && event.linkSEO) || eventShowsRedeemPass(event, config) ? (
          <div className="p-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row gap-2">
            {!hideRegistrationLinks && event.linkSEO && (
              <a 
                href={customRegistrationUrl || buildRegistrationUrl(event.linkSEO, { isRegistrationOpen })}
                target={linkTarget}
                rel="noopener noreferrer"
                onClick={() => {
                  if (!isRegistrationUnavailable) {
                    gtmEvent.clickRegister({
                      programId: event.programId,
                      programName: event.programName,
                      sessionId: event.sessionId,
                      sessionName: event.sessionName,
                    });
                    bondAnalytics.clickRegister(config.slug, {
                      programId: event.programId,
                      programName: event.programName,
                      sessionId: event.sessionId,
                      sessionName: event.sessionName,
                    });
                  }
                }}
                className="flex-1 min-w-0 py-3.5 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
                style={{ 
                  background: isRegistrationUnavailable 
                    ? '#9CA3AF' 
                    : ctaBackground 
                }}
              >
                {isRegistrationUnavailable ? 'Learn More' : (isWaitlistJoinable ? 'Join Waitlist' : 'Register Now')} {config.features.showRegisterIcon !== false && <ExternalLink size={16} />}
              </a>
            )}
            {eventShowsRedeemPass(event, config) && (
              <a
                href={getPunchPassRedeemUrl(config)}
                target={linkTarget}
                rel="noopener noreferrer"
                onClick={() => trackRedeemPassClick(config, event)}
                className="flex-1 min-w-0 py-3.5 font-semibold rounded-xl flex items-center justify-center gap-2 border-2 hover:opacity-90 transition-opacity"
                style={{ color: secondaryColor, borderColor: secondaryColor, backgroundColor: `${secondaryColor}08` }}
              >
                <Ticket size={18} />
                Redeem pass
              </a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Table View Component - Desktop only
function TableView({
  events,
  onEventClick,
  config,
  scheduleThemeStyle = 'gradient',
  hasMultipleFacilities,
  isLoading,
  linkTarget = '_blank',
  hideRegistrationLinks = false,
  customRegistrationUrl,
  totalServerEvents,
  onLoadMore,
  loadingMore,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  config: DiscoveryConfig;
  scheduleThemeStyle?: 'gradient' | 'solid';
  hasMultipleFacilities?: boolean;
  isLoading?: boolean;
  linkTarget?: '_blank' | '_top' | '_self';
  hideRegistrationLinks?: boolean;
  customRegistrationUrl?: string;
  totalServerEvents?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleCount, setVisibleCount] = useState(50);
  
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const tableHeaderBackground =
    scheduleThemeStyle === 'solid'
      ? primaryColor
      : `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`;
  
  // Table column visibility
  const defaultTableColumns: TableColumn[] = [
    'date',
    'time',
    'event',
    'program',
    'location',
    'spots',
    'action',
  ];
  const tableColumns = (config.features.tableColumns || defaultTableColumns) as TableColumn[];
  const showDateColumn = tableColumns.includes('date');
  const showTimeColumn = tableColumns.includes('time');
  const showEventColumn = tableColumns.includes('event');
  const showProgramColumn = tableColumns.includes('program');
  const showLocationColumn = tableColumns.includes('location');
  const showSpaceColumn = tableColumns.includes('space');
  const showSpotsColumn = tableColumns.includes('spots') && config.features.showAvailability;
  const punchPassFeatureOn = config.features.showPunchPassRedeemButton === true;
  const showActionColumn =
    tableColumns.includes('action') &&
    (!hideRegistrationLinks || punchPassFeatureOn);
  
  // Sort events by date + time
  const sortedEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      // Always sort by date first, then by start time
      const dateA = new Date(a.date + 'T' + (a.startTime || '00:00')).getTime();
      const dateB = new Date(b.date + 'T' + (b.startTime || '00:00')).getTime();
      const comparison = dateA - dateB;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted.slice(0, visibleCount);
  }, [events, sortDirection, visibleCount]);
  
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  const SortIcon = () => {
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  // Get sticky offset from CSS variable (set by parent DiscoveryPage based on header height)
  // Must be declared before any conditional return to keep hook order stable.
  const [stickyOffset, setStickyOffset] = useState(0);
  
  useEffect(() => {
    // Read the CSS variable from the nearest ancestor that has it set
    const updateOffset = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      const offset = computedStyle.getPropertyValue('--sticky-offset')?.trim();
      if (offset) {
        setStickyOffset(parseInt(offset) || 0);
      }
    };
    
    updateOffset();
    // Also listen for resize in case header height changes
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);
  
  if (isLoading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading events...</span>
        </div>
      </div>
    );
  }
  
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No events found</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-0">
      {/* Table */}
      {/* No overflow-x-auto here: it creates a scroll container and breaks thead position:sticky vs the page. */}
      <div className="print:overflow-visible">
        <table className="w-full min-w-0 print:text-xs border-collapse table-auto">
          <thead 
            className="sticky z-20 text-white" 
            style={{ top: stickyOffset, background: tableHeaderBackground }}
          >
            <tr className="print:bg-gray-100 print:text-gray-600">
              {showDateColumn && (
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider print:px-2 print:py-1 print:text-gray-600 first:rounded-tl-lg">
                  Date
                </th>
              )}
              {showTimeColumn && (
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider print:px-2 print:py-1 print:text-gray-600">
                  Time
                </th>
              )}
              {showEventColumn && (
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider print:px-2 print:py-1 print:text-gray-600">
                  Event
                </th>
              )}
              {showProgramColumn && (
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider print:px-2 print:py-1 print:text-gray-600">
                  Program
                </th>
              )}
              {showLocationColumn && (
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider print:px-2 print:py-1 print:text-gray-600">
                  Location
                </th>
              )}
              {showSpaceColumn && (
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider print:px-2 print:py-1 print:text-gray-600">
                  Space
                </th>
              )}
              {showSpotsColumn && (
                <th className="px-1 min-[480px]:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider print:hidden">
                  <span className="hidden min-[480px]:inline">Spots Left</span>
                  <span className="min-[480px]:hidden">Spots<br/>Left</span>
                </th>
              )}
              {showActionColumn && (
                <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider print:hidden last:rounded-tr-lg">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedEvents.map((event) => {
              const isRegistrationOpen = event.registrationWindowStatus === 'open';
              const isRegistrationClosed = event.registrationWindowStatus === 'closed' || event.registrationWindowStatus === 'ended';
              const isRegistrationNotYetOpen = event.registrationWindowStatus === 'not_opened_yet';
              const isRegistrationUnavailable = isRegistrationClosed || isRegistrationNotYetOpen;
              const isFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 0;
              const isAlmostFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 5 && !isFull;
              const isWaitlistJoinable = Boolean(event.isWaitlistEnabled && isFull && isRegistrationOpen);
              
              return (
                <tr 
                  key={event.id} 
                  className={cn(
                    'hover:bg-gray-50 transition-colors cursor-pointer',
                    isFull && !isWaitlistJoinable && 'opacity-60'
                  )}
                  onClick={() => onEventClick(event)}
                >
                  {/* Date - always one line */}
                  {showDateColumn && (
                    <td className="px-2 sm:px-4 py-2 sm:py-3 print:px-2 print:py-1 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {format(parseISO(event.date), 'EEE, MMM d')}
                      </div>
                    </td>
                  )}
                  
                  {/* Time - stacks only on very small screens */}
                  {showTimeColumn && (
                    <td className="px-2 sm:px-4 py-2 sm:py-3 print:px-2 print:py-1">
                      <div className="text-xs sm:text-sm text-gray-700">
                        <span className="hidden min-[480px]:inline whitespace-nowrap">
                          {formatTime(event.startTime, event.timezone) || 'TBD'}
                          {event.endTime && ` - ${formatTime(event.endTime, event.timezone)}`}
                        </span>
                        <span className="min-[480px]:hidden">
                          <span className="block whitespace-nowrap">{formatTime(event.startTime, event.timezone) || 'TBD'}{event.endTime && ' -'}</span>
                          {event.endTime && <span className="block whitespace-nowrap">{formatTime(event.endTime, event.timezone)}</span>}
                        </span>
                      </div>
                    </td>
                  )}
                  
                  {/* Event Title */}
                  {showEventColumn && (
                    <td className="px-4 py-3 print:px-2 print:py-1">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 line-clamp-2 print:whitespace-normal">
                          {event.title || event.sessionName || event.programName}
                        </div>
                        {event.sessionName && event.sessionName !== event.title && (
                          <div className="text-xs text-gray-500 line-clamp-1 print:whitespace-normal">
                            {event.sessionName}
                          </div>
                        )}
                        {/* Status badges - hide in print */}
                        <div className="flex items-center gap-1 mt-0.5 print:hidden">
                          {isRegistrationClosed && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">Closed</span>
                          )}
                          {isRegistrationNotYetOpen && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">Coming Soon</span>
                          )}
                          {event.isWaitlistEnabled && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded flex items-center gap-0.5">
                              <Users size={10} />Waitlist
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                  
                  {/* Program */}
                  {showProgramColumn && (
                    <td className="px-4 py-3 print:px-2 print:py-1">
                      <div 
                        className="text-sm text-gray-700 line-clamp-2 max-w-[200px] hover:line-clamp-none cursor-default print:whitespace-normal"
                        title={event.programName}
                      >
                        {event.programName}
                      </div>
                      {event.programType && (
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block print:hidden"
                          style={{ backgroundColor: `${secondaryColor}15`, color: secondaryColor }}
                        >
                          {getProgramTypeLabel(event.programType)}
                        </span>
                      )}
                    </td>
                  )}
                  
                  {/* Location: multi-facility = facility + nested space (unless space has its own column); single = space primary when no space column */}
                  {showLocationColumn && (
                    <td className="px-4 py-3">
                      {hasMultipleFacilities ? (
                        showSpaceColumn ? (
                          <div className="text-sm text-gray-800 truncate max-w-[160px]" title={event.facilityName}>
                            {event.facilityName || '—'}
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                              {event.facilityName || '—'}
                            </div>
                            {event.spaceName && (
                              <div className="text-xs text-gray-500 truncate max-w-[160px]">{event.spaceName}</div>
                            )}
                          </>
                        )
                      ) : showSpaceColumn ? (
                        <div className="text-sm text-gray-800 truncate max-w-[160px]" title={event.facilityName}>
                          {event.facilityName || '—'}
                        </div>
                      ) : event.spaceName ? (
                        <>
                          <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                            {event.spaceName}
                          </div>
                          {event.facilityName && (
                            <div className="text-xs text-gray-500 truncate max-w-[160px]">{event.facilityName}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-700 truncate max-w-[160px]">{event.facilityName || '—'}</div>
                      )}
                    </td>
                  )}

                  {showSpaceColumn && (
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-800 truncate max-w-[140px]" title={event.spaceName}>
                        {event.spaceName || '—'}
                      </div>
                    </td>
                  )}
                  
                  {/* Availability */}
                  {showSpotsColumn && (
                    <td className="px-2 sm:px-4 py-2 sm:py-3 print:hidden">
                      {event.spotsRemaining !== undefined ? (
                        <span className={cn(
                          'text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap',
                          isFull && 'bg-red-100 text-red-700',
                          isAlmostFull && 'bg-yellow-100 text-yellow-700',
                          !isFull && !isAlmostFull && 'bg-green-100 text-green-700'
                        )}>
                          {isWaitlistJoinable ? 'Waitlist' : (isFull ? 'Full' : `${event.spotsRemaining}`)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  )}
                  
                  {/* Action — stack on narrow widths; row layout from sm up (punch pass + register) */}
                  {showActionColumn && (
                    <td className="min-w-0 px-1.5 sm:px-4 py-2 sm:py-3 print:hidden">
                      <div className="flex flex-col gap-1.5 w-full min-w-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <div className="flex justify-stretch sm:flex-1 sm:justify-start min-w-0">
                          {eventShowsRedeemPass(event, config) && (
                            <a
                              href={getPunchPassRedeemUrl(config)}
                              target={linkTarget}
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                trackRedeemPassClick(config, event);
                              }}
                              className="inline-flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg border print:hidden hover:opacity-90 w-full sm:w-auto"
                              style={{ color: secondaryColor, borderColor: `${secondaryColor}66`, backgroundColor: `${secondaryColor}0d` }}
                            >
                              <Ticket size={12} className="shrink-0" />
                              Redeem
                            </a>
                          )}
                        </div>
                        <div className="flex justify-stretch sm:justify-end sm:shrink-0 min-w-0">
                          {!hideRegistrationLinks && event.linkSEO && (
                            <a
                              href={customRegistrationUrl || buildRegistrationUrl(event.linkSEO, { isRegistrationOpen })}
                              target={linkTarget}
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isRegistrationUnavailable) {
                                  gtmEvent.clickRegister({
                                    programId: event.programId,
                                    programName: event.programName,
                                    sessionId: event.sessionId,
                                    sessionName: event.sessionName,
                                  });
                                  bondAnalytics.clickRegister(config.slug, {
                                    programId: event.programId,
                                    programName: event.programName,
                                    sessionId: event.sessionId,
                                    sessionName: event.sessionName,
                                  });
                                }
                              }}
                              className={cn(
                                'inline-flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-colors print:hidden w-full sm:w-auto',
                                isRegistrationUnavailable
                                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  : 'text-white hover:opacity-90'
                              )}
                              style={!isRegistrationUnavailable ? { backgroundColor: secondaryColor } : undefined}
                            >
                              {isRegistrationUnavailable ? 'Details' : (isWaitlistJoinable ? 'Join Waitlist' : 'Register')}
                              {config.features.showRegisterIcon !== false && <ExternalLink size={12} className="shrink-0" />}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Load More */}
      {visibleCount < events.length ? (
        <div className="p-4 border-t border-gray-100 text-center">
          <button
            onClick={() => setVisibleCount(prev => prev + 50)}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: secondaryColor }}
          >
            Load more ({events.length - visibleCount} remaining)
          </button>
        </div>
      ) : onLoadMore && totalServerEvents && events.length < totalServerEvents ? (
        <div className="p-4 border-t border-gray-100 text-center">
          <button
            onClick={() => { onLoadMore(); setVisibleCount(prev => prev + 200); }}
            disabled={loadingMore}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            style={{ color: secondaryColor }}
          >
            {loadingMore ? 'Loading...' : `Load more (${totalServerEvents - events.length} remaining)`}
          </button>
        </div>
      ) : null}
      
      {/* Summary */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
        Showing {Math.min(visibleCount, events.length)} of {totalServerEvents || events.length} events
      </div>
    </div>
  );
}
