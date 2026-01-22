'use client';

import { useMemo } from 'react';
import { CalendarEvent, DiscoveryConfig, DaySchedule } from '@/types';
import { formatTime, buildRegistrationUrl, cn } from '@/lib/utils';
import { format, parseISO, isToday, startOfWeek, addDays, isSameDay } from 'date-fns';

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
 * Events span their duration visually.
 * Desktop-oriented primary view.
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
    <div className="overflow-auto">
      <div className="min-w-[800px]">
        {/* Header Row - Day Names */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] sticky top-0 bg-white z-20 border-b border-gray-200">
          <div className="p-2" /> {/* Empty corner */}
          {days.map((day) => {
            const dayDate = parseISO(day.date);
            const isCurrent = isToday(dayDate);
            
            return (
              <div
                key={day.date}
                onClick={() => onDayClick?.(day.date)}
                className={cn(
                  'p-3 text-center border-l border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors',
                  isCurrent && 'bg-toca-purple/5'
                )}
              >
                <div className={cn(
                  'text-xs font-medium uppercase tracking-wide',
                  isCurrent ? 'text-toca-purple' : 'text-gray-500'
                )}>
                  {format(dayDate, 'EEE')}
                </div>
                <div className={cn(
                  'mt-1 text-lg font-bold',
                  isCurrent 
                    ? 'text-white bg-toca-purple w-8 h-8 rounded-full flex items-center justify-center mx-auto' 
                    : 'text-gray-900'
                )}>
                  {format(dayDate, 'd')}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {day.events.length} event{day.events.length !== 1 ? 's' : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div className="relative">
          {TIME_SLOTS.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100">
              {/* Time Label */}
              <div className="p-2 pr-3 text-right">
                <span className="text-xs text-gray-400 font-medium">
                  {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                </span>
              </div>

              {/* Day Cells */}
              {days.map((day) => {
                const hourEvents = eventsByDayHour[day.date]?.[hour] || [];
                const isCurrent = isToday(parseISO(day.date));

                return (
                  <div
                    key={`${day.date}-${hour}`}
                    className={cn(
                      'border-l border-gray-200 min-h-[60px] p-1 relative',
                      isCurrent && 'bg-toca-purple/5'
                    )}
                  >
                    {hourEvents.map((event, idx) => (
                      <EventBlock
                        key={event.id}
                        event={event}
                        onClick={() => onEventClick?.(event)}
                        style={{
                          position: hourEvents.length > 1 ? 'relative' : 'relative',
                          width: hourEvents.length > 1 ? `${95 / hourEvents.length}%` : '95%',
                          left: hourEvents.length > 1 ? `${(100 / hourEvents.length) * idx}%` : 0,
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Current Time Indicator */}
          {days.some(d => isToday(parseISO(d.date))) && (
            <CurrentTimeIndicator 
              days={days} 
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Compact Event Block for Grid View
function EventBlock({
  event,
  onClick,
  style,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const startTime = formatTime(event.startTime);
  
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'text-xs p-1.5 rounded cursor-pointer transition-all hover:shadow-md overflow-hidden',
        'border-l-2 bg-white'
      )}
      title={`${event.programName} - ${startTime}`}
    >
      <div 
        className="absolute inset-0 opacity-10" 
        style={{ backgroundColor: event.color || '#6366F1' }}
      />
      <div className="relative">
        <p className="font-semibold truncate text-gray-900" style={{ color: event.color }}>
          {event.programName}
        </p>
        <p className="text-gray-500 truncate">
          {startTime}
        </p>
      </div>
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
  const topPosition = hoursSince6 * 60 + (currentMinutes / 60) * 60; // 60px per hour

  return (
    <div
      className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
      style={{
        top: `${topPosition}px`,
        marginLeft: `calc(60px + ${(todayIndex / 7) * (100 - (60 / 8 * 100))}%)`,
        width: `calc(${100 / 7}% - 4px)`,
      }}
    >
      <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
    </div>
  );
}

export default WeekGridView;
