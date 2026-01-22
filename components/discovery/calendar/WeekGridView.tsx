'use client';

import { useMemo } from 'react';
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
 */
export function WeekGridView({ days, config, onEventClick, onDayClick }: WeekGridViewProps) {
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header Row - Day Names & Dates */}
      <div className="grid grid-cols-[70px_repeat(7,1fr)] bg-gray-50 border-b border-gray-200">
        <div className="p-3 border-r border-gray-200" /> {/* Empty corner */}
        {days.map((day) => {
          const dayDate = parseISO(day.date);
          const isCurrent = isToday(dayDate);
          
          return (
            <div
              key={day.date}
              onClick={() => onDayClick?.(day.date)}
              className={cn(
                'p-3 text-center border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-100 transition-colors',
                isCurrent && 'bg-toca-purple/10'
              )}
            >
              <div className={cn(
                'text-xs font-semibold uppercase tracking-wide',
                isCurrent ? 'text-toca-purple' : 'text-gray-500'
              )}>
                {format(dayDate, 'EEE')}
              </div>
              <div className={cn(
                'mt-1 font-bold text-lg',
                isCurrent 
                  ? 'text-white bg-toca-purple w-8 h-8 rounded-full flex items-center justify-center mx-auto' 
                  : 'text-gray-900'
              )}>
                {format(dayDate, 'd')}
              </div>
              <div className={cn(
                'text-[10px] mt-1',
                isCurrent ? 'text-toca-purple' : 'text-gray-400'
              )}>
                {format(dayDate, 'MMM')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Grid - Scrollable */}
      <div className="overflow-y-auto max-h-[600px]">
        <div className="relative">
          {TIME_SLOTS.map((hour) => (
            <div key={hour} className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-gray-100 last:border-b-0">
              {/* Time Label */}
              <div className="p-2 pr-3 text-right border-r border-gray-200 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">
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
        title={`${event.programName} - ${startTime}`}
      >
        <p 
          className="font-semibold line-clamp-2 leading-tight"
          style={{ color: event.color || '#1E2761' }}
        >
          {event.programName}
        </p>
        <p className="text-gray-500 mt-0.5 text-[10px]">
          {startTime}
        </p>
      </button>
      
      {/* +X more indicator */}
      {moreCount && moreCount > 0 && (
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

// Current Time Indicator
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

  // Calculate left position based on column
  const columnWidth = `calc((100% - 70px) / 7)`;
  const leftPosition = `calc(70px + ${todayIndex} * ${columnWidth})`;

  return (
    <div
      className="absolute h-0.5 bg-red-500 z-10 pointer-events-none"
      style={{
        top: `${topPosition}px`,
        left: leftPosition,
        width: columnWidth,
      }}
    >
      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
    </div>
  );
}

export default WeekGridView;
