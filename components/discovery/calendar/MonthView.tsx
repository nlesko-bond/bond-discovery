'use client';

import { useMemo } from 'react';
import { CalendarEvent, DiscoveryConfig } from '@/types';
import { cn } from '@/lib/utils';
import { 
  format, 
  parseISO, 
  isToday, 
  isSameMonth,
  isSameDay,
  startOfMonth, 
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays
} from 'date-fns';

interface MonthViewProps {
  events: CalendarEvent[];
  currentMonth: Date;
  config: DiscoveryConfig;
  onDayClick?: (date: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * MonthView Calendar Component
 * 
 * Traditional calendar grid with event dots/count badges.
 * Click day to switch to Day view.
 * Provides overview for long-range planning.
 */
export function MonthView({ 
  events, 
  currentMonth, 
  config, 
  onDayClick,
  onEventClick 
}: MonthViewProps) {
  // Get brand colors from config
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  // Generate calendar days for the month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days: { date: Date; isCurrentMonth: boolean; events: CalendarEvent[] }[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      // Use event.date (already localized YYYY-MM-DD string) for consistent counting
      // This matches how buildWeekSchedules groups events
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const filtered = events.filter(event => event.date === dateStr);
      
      // Deduplicate by event ID to ensure count matches rendered items
      const seen = new Set<string>();
      const dayEvents = filtered.filter(event => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      });

      days.push({
        date: currentDate,
        isCurrentMonth: isSameMonth(currentDate, currentMonth),
        events: dayEvents,
      });

      currentDate = addDays(currentDate, 1);
    }

    return days;
  }, [events, currentMonth]);

  // Split into weeks
  const weeks = useMemo(() => {
    const result: typeof calendarDays[] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  return (
    <div className="select-none">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS.map(day => (
          <div key={day} className="py-2 text-center">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {day}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="border-l border-gray-200">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map(({ date, isCurrentMonth, events: dayEvents }) => {
              const isCurrent = isToday(date);
              const hasEvents = dayEvents.length > 0;
              const dateStr = format(date, 'yyyy-MM-dd');

              return (
                <div
                  key={dateStr}
                  onClick={() => hasEvents && onDayClick?.(dateStr)}
                  className={cn(
                    'min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-r border-b border-gray-200 transition-colors',
                    !isCurrentMonth && 'bg-gray-50',
                    hasEvents && 'cursor-pointer'
                  )}
                  style={{ 
                    backgroundColor: isCurrent 
                      ? `${secondaryColor}15` 
                      : !isCurrentMonth 
                        ? '#F9FAFB' 
                        : undefined 
                  }}
                >
                  {/* Date Number */}
                  <div className="flex items-center justify-between mb-1">
                    <span 
                      className={cn(
                        'text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
                        !isCurrent && !isCurrentMonth && 'text-gray-400'
                      )}
                      style={{ 
                        backgroundColor: isCurrent ? secondaryColor : undefined,
                        color: isCurrent ? 'white' : isCurrentMonth ? '#111827' : '#9CA3AF'
                      }}
                    >
                      {format(date, 'd')}
                    </span>

                    {/* Event Count Badge */}
                    {dayEvents.length > 0 && (
                      <span 
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ 
                          backgroundColor: dayEvents.length > 5 ? secondaryColor : `${secondaryColor}15`,
                          color: dayEvents.length > 5 ? 'white' : secondaryColor
                        }}
                      >
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event Dots / Preview */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event, idx) => (
                      <EventDot
                        key={event.id}
                        event={event}
                        brandColor={secondaryColor}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-xs text-gray-500 font-medium">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Event Dot / Mini Preview
function EventDot({ 
  event, 
  brandColor = '#6366F1',
  onClick 
}: { 
  event: CalendarEvent; 
  brandColor?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
    >
      <div 
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: event.color || brandColor }}
      />
      <span className="text-xs text-gray-700 truncate hidden sm:block">
        {event.title || event.programName}
      </span>
    </div>
  );
}

export default MonthView;
