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
  // Generate calendar days for the month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days: { date: Date; isCurrentMonth: boolean; events: CalendarEvent[] }[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      // Use isSameDay for proper timezone handling (matches DayView logic)
      const dayEvents = events.filter(event => {
        const eventDate = parseISO(event.startTime || event.date);
        return isSameDay(eventDate, currentDate);
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
                    hasEvents && 'cursor-pointer hover:bg-toca-purple/5',
                    isCurrent && 'bg-toca-purple/10'
                  )}
                >
                  {/* Date Number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      'text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      isCurrent && 'bg-toca-purple text-white',
                      !isCurrent && isCurrentMonth && 'text-gray-900',
                      !isCurrent && !isCurrentMonth && 'text-gray-400'
                    )}>
                      {format(date, 'd')}
                    </span>

                    {/* Event Count Badge */}
                    {dayEvents.length > 0 && (
                      <span className={cn(
                        'text-xs font-semibold px-1.5 py-0.5 rounded-full',
                        dayEvents.length > 5 
                          ? 'bg-toca-purple text-white'
                          : 'bg-toca-purple/10 text-toca-purple'
                      )}>
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
  onClick 
}: { 
  event: CalendarEvent; 
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
    >
      <div 
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: event.color || '#6366F1' }}
      />
      <span className="text-xs text-gray-700 truncate hidden sm:block">
        {event.title || event.programName}
      </span>
    </div>
  );
}

export default MonthView;
