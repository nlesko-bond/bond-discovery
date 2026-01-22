'use client';

import { useMemo, useRef, useEffect } from 'react';
import { CalendarEvent, DiscoveryConfig, DaySchedule } from '@/types';
import { formatTime, cn } from '@/lib/utils';
import { format, parseISO, isToday } from 'date-fns';

interface WeekGridViewProps {
  days: DaySchedule[];
  config: DiscoveryConfig;
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: string) => void;
}

// Time slots from 6am to 10pm
const TIME_SLOTS = Array.from({ length: 17 }, (_, i) => i + 6);

/**
 * WeekGridView Calendar Component
 * 
 * Displays a 7-column grid with hour rows.
 * Shows first event fully and "+X more" for additional events.
 * Auto-scrolls to current time on today.
 */
export function WeekGridView({ days, config, onEventClick, onDayClick }: WeekGridViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current time on mount
  useEffect(() => {
    const hasTodayInView = days.some(d => isToday(parseISO(d.date)));
    if (hasTodayInView && scrollContainerRef.current) {
      const currentHour = new Date().getHours();
      // Only scroll if within visible time range
      if (currentHour >= 6 && currentHour < 22) {
        const hourIndex = currentHour - 6;
        const scrollPosition = Math.max(0, hourIndex * 65 - 100); // 65px per row, offset 100px for visibility
        setTimeout(() => {
          scrollContainerRef.current?.scrollTo({ top: scrollPosition, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [days]);
  // Group events by day and hour for positioning
  const eventsByDayHour = useMemo(() => {
    const grouped: Record<string, Record<number, CalendarEvent[]>> = {};
    
    days.forEach(day => {
      grouped[day.date] = {};
      day.events.forEach(event => {
        const eventDate = new Date(event.startTime || event.date);
        const hour = eventDate.getHours();
        if (!grouped[day.date][hour]) grouped[day.date][hour] = [];
        grouped[day.date][hour].push(event);
      });
    });
    
    return grouped;
  }, [days]);

  // Calculate minimum width to ensure columns don't get too squished on mobile
  const minColumnWidth = 80; // Minimum 80px per day column
  const timeColumnWidth = 50; // Narrower time column on mobile
  const minGridWidth = timeColumnWidth + (minColumnWidth * 7);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Horizontal scroll wrapper for mobile */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${minGridWidth}px` }}>
          {/* Header Row - Day Names & Dates */}
          <div className="grid grid-cols-[50px_repeat(7,1fr)] sm:grid-cols-[70px_repeat(7,1fr)] bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <div className="p-2 sm:p-3 border-r border-gray-200" /> {/* Empty corner */}
            {days.map((day) => {
              const dayDate = parseISO(day.date);
              const isCurrent = isToday(dayDate);
              
              return (
                <div
                  key={day.date}
                  onClick={() => onDayClick?.(day.date)}
                  className={cn(
                    'p-2 sm:p-3 text-center border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-100 transition-colors',
                    isCurrent && 'bg-toca-purple/10'
                  )}
                >
                  <div className={cn(
                    'text-[10px] sm:text-xs font-semibold uppercase tracking-wide',
                    isCurrent ? 'text-toca-purple' : 'text-gray-500'
                  )}>
                    {format(dayDate, 'EEE')}
                  </div>
                  <div className={cn(
                    'mt-0.5 sm:mt-1 font-bold text-base sm:text-lg',
                    isCurrent 
                      ? 'text-white bg-toca-purple w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mx-auto text-sm sm:text-base' 
                      : 'text-gray-900'
                  )}>
                    {format(dayDate, 'd')}
                  </div>
                  <div className={cn(
                    'text-[9px] sm:text-[10px] mt-0.5 sm:mt-1',
                    isCurrent ? 'text-toca-purple' : 'text-gray-400'
                  )}>
                    {format(dayDate, 'MMM')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Grid - Scrollable */}
          <div ref={scrollContainerRef} className="overflow-y-auto max-h-[600px]">
            <div className="relative">
          {TIME_SLOTS.map((hour) => (
            <div key={hour} className="grid grid-cols-[50px_repeat(7,1fr)] sm:grid-cols-[70px_repeat(7,1fr)] border-b border-gray-100 last:border-b-0">
              {/* Time Label */}
              <div className="p-1 sm:p-2 pr-2 sm:pr-3 text-right border-r border-gray-200 bg-gray-50/50">
                <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
                  {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                </span>
              </div>

              {/* Day Cells */}
              {days.map((day) => {
                const hourEvents = eventsByDayHour[day.date]?.[hour] || [];
                const isCurrent = isToday(parseISO(day.date));
                const firstEvent = hourEvents[0];
                const moreCount = hourEvents.length - 1;

                return (
                  <div
                    key={`${day.date}-${hour}`}
                    className={cn(
                      'border-r border-gray-100 last:border-r-0 min-h-[65px] p-1 relative',
                      isCurrent && 'bg-toca-purple/5'
                    )}
                  >
                    {firstEvent && (
                      <EventBlock
                        event={firstEvent}
                        onClick={() => onEventClick?.(firstEvent)}
                        moreCount={moreCount}
                        onMoreClick={() => onDayClick?.(day.date)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Current Time Indicator */}
          {days.some(d => isToday(parseISO(d.date))) && (
            <CurrentTimeIndicator days={days} />
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Event Block with optional "+X more" indicator
function EventBlock({
  event,
  onClick,
  moreCount,
  onMoreClick,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  moreCount?: number;
  onMoreClick?: () => void;
}) {
  const startTime = formatTime(event.startTime);
  
  // Determine display name: prefer title, then sessionName if different from programName, then programName
  const displayName = event.title || event.programName;
  const showSession = event.sessionName && event.sessionName !== event.programName && event.sessionName !== event.title;
  
  return (
    <div className="space-y-1">
      <button
        onClick={onClick}
        className={cn(
          'w-full text-left text-xs p-2 rounded-md cursor-pointer transition-all',
          'hover:shadow-md border-l-3 bg-white shadow-sm',
          'overflow-hidden'
        )}
        style={{ 
          borderLeftColor: event.color || '#6366F1',
          borderLeftWidth: '3px',
          backgroundColor: `${event.color || '#6366F1'}10`
        }}
        title={`${displayName}${showSession ? ` - ${event.sessionName}` : ''} - ${startTime}`}
      >
        <p 
          className="font-semibold line-clamp-2 leading-tight"
          style={{ color: event.color || '#1E2761' }}
        >
          {displayName}
        </p>
        <p className="text-gray-500 mt-0.5 text-[10px]">
          {startTime}
        </p>
      </button>
      
      {/* +X more indicator */}
      {typeof moreCount === 'number' && moreCount > 0 && (
        <button
          onClick={onMoreClick}
          className="w-full text-center text-[10px] text-toca-purple font-medium py-1 hover:bg-toca-purple/10 rounded transition-colors"
        >
          +{moreCount} more
        </button>
      )}
    </div>
  );
}

// Current Time Indicator - red line across today's column
function CurrentTimeIndicator({ days }: { days: DaySchedule[] }) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  // Find which column index is today
  const todayIndex = days.findIndex(d => isToday(parseISO(d.date)));
  if (todayIndex === -1) return null;

  // Only show if current hour is within our time slots
  if (currentHour < 6 || currentHour >= 22) return null;

  // Calculate position
  const hoursSince6 = currentHour - 6;
  const topPosition = hoursSince6 * 65 + (currentMinutes / 60) * 65; // 65px per hour row

  // Calculate left position based on column - span full width for better visibility
  const columnWidth = `calc((100% - 70px) / 7)`;
  const leftPosition = `calc(70px + ${todayIndex} * ${columnWidth})`;

  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        top: `${topPosition}px`,
        left: 0,
        right: 0,
      }}
    >
      {/* Time label on left */}
      <div className="absolute left-1 -top-2 text-[10px] font-bold text-red-600 bg-white px-1 rounded">
        {format(now, 'h:mm a')}
      </div>
      {/* Full width line with red dot on today's column */}
      <div className="absolute h-0.5 bg-red-500/30 left-[70px] right-0" />
      <div
        className="absolute h-0.5 bg-red-500"
        style={{ left: leftPosition, width: columnWidth }}
      >
        <div className="absolute -left-1.5 -top-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md" />
      </div>
    </div>
  );
}

export default WeekGridView;
