'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  CalendarDays,
  CalendarRange,
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
  FileSpreadsheet
} from 'lucide-react';
import { WeekSchedule, DaySchedule, CalendarEvent, DiscoveryConfig } from '@/types';
import { formatDate, formatTime, formatPrice, getSportLabel, getProgramTypeLabel, buildRegistrationUrl, cn } from '@/lib/utils';
import { format, parseISO, startOfMonth, addMonths, subMonths, isToday, isSameDay } from 'date-fns';
import { DayView, WeekGridView, MonthView } from './calendar';
import { ScheduleViewSkeleton } from '@/components/ui/Skeleton';

type ViewMode = 'list' | 'day' | 'week' | 'month';

interface ScheduleViewProps {
  schedule: WeekSchedule[];
  config: DiscoveryConfig;
  isLoading?: boolean;
  error?: string | null;
  totalEvents?: number;
}

export function ScheduleView({ schedule, config, isLoading, error, totalEvents }: ScheduleViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  
  // Dynamic colors from config
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Use URL scheduleView param first, then config default based on device
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const urlScheduleView = searchParams.get('scheduleView') as ViewMode | null;
    if (urlScheduleView && ['list', 'day', 'week', 'month'].includes(urlScheduleView)) {
      return urlScheduleView;
    }
    // Check for mobile on initial render
    const isMobileInitial = typeof window !== 'undefined' && window.innerWidth < 640;
    if (isMobileInitial) {
      // Use mobile default from config, or fallback to 'list'
      return (config.features.mobileDefaultScheduleView as ViewMode) || 'list';
    }
    // Desktop: use config default or 'week'
    return (config.features.defaultScheduleView as ViewMode) || 'week';
  });
  
  // Update URL when view mode changes
  const setViewMode = useCallback((newMode: ViewMode) => {
    setViewModeState(newMode);
    
    // Preserve existing URL params and update scheduleView
    // Use window.location.search to get current params (avoids stale closure)
    const params = new URLSearchParams(window.location.search);
    params.set('scheduleView', newMode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname]);
  
  // Sync view mode from URL when it changes externally
  useEffect(() => {
    const urlScheduleView = searchParams.get('scheduleView') as ViewMode | null;
    if (urlScheduleView && ['list', 'day', 'week', 'month'].includes(urlScheduleView) && urlScheduleView !== viewMode) {
      setViewModeState(urlScheduleView);
    }
  }, [searchParams]);
  
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
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

  // Flatten all events for month view
  const allEvents = useMemo(() => {
    return schedule.flatMap(week => 
      week.days.flatMap(day => day.events)
    );
  }, [schedule]);
  
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
      lines.push(`SUMMARY:${event.programName || 'Event'}`);
      if (event.sessionName) lines.push(`DESCRIPTION:${event.sessionName}`);
      if (event.facilityName) lines.push(`LOCATION:${event.facilityName}`);
      if (event.linkSEO) lines.push(`URL:https://app.bondsports.co${event.linkSEO}`);
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
            existing.events.push(...day.events);
          } else {
            dayMap.set(day.date, { ...day });
          }
        }
      });
    });
    
    // Sort days chronologically, and sort events within each day by start time
    const result = Array.from(dayMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Sort events within each day by start time
    result.forEach(day => {
      day.events.sort((a, b) => {
        const timeA = a.startTime || a.date || '';
        const timeB = b.startTime || b.date || '';
        return new Date(timeA).getTime() - new Date(timeB).getTime();
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

  // Loading state - show skeleton
  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <ScheduleViewSkeleton />
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
          {/* Event count - compact */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
            <span><span className="font-semibold" style={{ color: primaryColor }}>{totalEvents?.toLocaleString() || 0}</span> events</span>
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
            <button
              onClick={() => {
                setSelectedDayDate(currentWeek?.days[0]?.date || new Date().toISOString().split('T')[0]);
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
      
      {/* Navigation - for calendar views */}
      <div className={cn(
        viewMode !== 'list' && 'sticky top-[57px] z-10'
      )}>
      {viewMode === 'month' ? (
        /* Month Navigation */
        <div 
          className="flex items-center justify-between px-3 py-2 text-white rounded-t-lg"
          style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }}
        >
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      ) : viewMode === 'day' && selectedDayDate ? (
        /* Day Navigation */
        <div 
          className="flex items-center justify-between px-3 py-2 text-white"
          style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }}
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
            <button onClick={() => setViewMode('list')} className="text-xs text-white/70 hover:text-white">← Back to list</button>
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
      ) : viewMode === 'list' ? null : (
        /* Week Navigation - Compact */
        <div 
          className="flex items-center justify-between px-3 py-2 text-white"
          style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }}
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
        />
      )}

      {/* Week Grid View */}
      {viewMode === 'week' && currentWeek && (
        <WeekGridView
          days={currentWeek.days}
          config={config}
          onEventClick={setSelectedEvent}
          onDayClick={handleDayClick}
        />
      )}

      {/* Month View */}
      {viewMode === 'month' && (
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
            {formatTime(event.startTime)}
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
}: {
  day: DaySchedule;
  onEventClick: (event: CalendarEvent) => void;
  config: DiscoveryConfig;
}) {
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  
  if (day.events.length === 0) return null;

  return (
    <section 
      className="relative"
      aria-label={`Events for ${format(parseISO(day.date), 'EEEE, MMMM d')}`}
    >
      {/* Day Header - sticky with brand gradient */}
      <header 
        className="sticky top-[57px] z-20 flex items-center gap-3 px-4 py-3 text-white rounded-t-xl shadow-md"
        style={{ 
          background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
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
}: {
  event: CalendarEvent;
  onClick: () => void;
  config: DiscoveryConfig;
}) {
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  
  const spotsInfo = event.spotsRemaining !== undefined && event.maxParticipants;
  const isFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 0;
  const isAlmostFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 5 && !isFull;

  // Get start time - try multiple sources
  const startTimeStr = formatTime(event.startTime) || formatTime(event.date) || '';
  const endTimeStr = event.endTime ? formatTime(event.endTime) : '';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left group transition-all',
        isFull && 'opacity-60'
      )}
    >
      {/* Card with prominent left accent */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all hover:shadow-sm">
        {/* Left accent bar - uses brand gradient */}
        <div 
          className="w-1.5 flex-shrink-0" 
          style={{ background: `linear-gradient(to bottom, ${primaryColor}, ${secondaryColor})` }}
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
              {config.features.showAvailability && spotsInfo && (
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  isFull && 'bg-red-100 text-red-700',
                  isAlmostFull && 'bg-yellow-100 text-yellow-700',
                  !isFull && !isAlmostFull && 'bg-green-100 text-green-700'
                )}>
                  {isFull ? 'Full' : `${event.spotsRemaining} left`}
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
            {(event.spaceName || event.facilityName) && (
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" />
                {event.spaceName || event.facilityName}
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
            
            {/* Register link inline */}
            {event.linkSEO && (
              <a 
                href={buildRegistrationUrl(event.linkSEO)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-medium ml-auto hover:opacity-80"
                style={{ color: secondaryColor }}
              >
                Register <ExternalLink size={12} />
              </a>
            )}
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
}: {
  event: CalendarEvent;
  onClose: () => void;
  config: DiscoveryConfig;
}) {
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  
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
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
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
            {(event.sport || event.programType) && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
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
                {formatTime(event.startTime)}
                {event.endTime && ` - ${formatTime(event.endTime)}`}
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
          {config.features.showAvailability && event.maxParticipants && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Users className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: secondaryColor }} />
              <div>
                <p className="font-semibold text-gray-900">
                  {event.currentParticipants || 0} / {event.maxParticipants} Enrolled
                </p>
                {event.spotsRemaining !== undefined && (
                  <p className={cn(
                    'text-sm font-medium',
                    event.spotsRemaining <= 0 && 'text-red-600',
                    event.spotsRemaining > 0 && event.spotsRemaining <= 5 && 'text-yellow-600',
                    event.spotsRemaining > 5 && 'text-green-600'
                  )}>
                    {event.spotsRemaining <= 0 ? 'No spots available' : `${event.spotsRemaining} spots remaining`}
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
        <div className="p-4 border-t border-gray-200 bg-white">
          <a 
            href={event.linkSEO ? buildRegistrationUrl(event.linkSEO) : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
            style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }}
          >
            Register Now <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
