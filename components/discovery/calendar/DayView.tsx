'use client';

import { useMemo, useRef, useEffect } from 'react';
import { Clock, MapPin, Users, ExternalLink } from 'lucide-react';
import { CalendarEvent, DiscoveryConfig } from '@/types';
import { formatTime, buildRegistrationUrl, cn } from '@/lib/utils';
import { format, parseISO, isSameDay, isToday } from 'date-fns';

interface DayViewProps {
  events: CalendarEvent[];
  date: string; // ISO date string
  config: DiscoveryConfig;
  onEventClick?: (event: CalendarEvent) => void;
}

// Time slots from 6am to 10pm
const TIME_SLOTS = Array.from({ length: 17 }, (_, i) => i + 6); // 6-22 (6am to 10pm)

/**
 * DayView Calendar Component
 * 
 * Displays a vertical agenda timeline with time markers.
 * Events are positioned based on their start time.
 * Includes current time indicator.
 */
export function DayView({ events, date, config, onEventClick }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLDivElement>(null);

  // Filter events for this day
  const dayEvents = useMemo(() => {
    const targetDate = parseISO(date);
    return events.filter(event => {
      const eventDate = parseISO(event.startTime || event.date);
      return isSameDay(eventDate, targetDate);
    }).sort((a, b) => {
      const aTime = new Date(a.startTime || a.date).getTime();
      const bTime = new Date(b.startTime || b.date).getTime();
      return aTime - bTime;
    });
  }, [events, date]);

  // Group events by hour
  const eventsByHour = useMemo(() => {
    const grouped: Record<number, CalendarEvent[]> = {};
    dayEvents.forEach(event => {
      const eventDate = new Date(event.startTime || event.date);
      const hour = eventDate.getHours();
      if (!grouped[hour]) grouped[hour] = [];
      grouped[hour].push(event);
    });
    return grouped;
  }, [dayEvents]);

  // Scroll to current time on mount
  useEffect(() => {
    const targetDate = parseISO(date);
    if (isToday(targetDate) && currentTimeRef.current && scrollRef.current) {
      const currentHour = new Date().getHours();
      // Scroll to make current time visible
      setTimeout(() => {
        currentTimeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [date]);

  const currentHour = new Date().getHours();
  const currentMinutes = new Date().getMinutes();
  const isCurrentDay = isToday(parseISO(date));

  return (
    <div className="h-full flex flex-col">
      {/* Day Header */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
        <h3 className={cn(
          'text-xl font-bold',
          isCurrentDay ? 'text-toca-purple' : 'text-gray-900'
        )}>
          {format(parseISO(date), 'EEEE, MMMM d')}
          {isCurrentDay && (
            <span className="ml-2 text-sm font-normal text-toca-purple bg-toca-purple/10 px-2 py-0.5 rounded-full">
              Today
            </span>
          )}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Clock size={48} strokeWidth={1} />
            <p className="mt-3 text-lg">No events scheduled</p>
          </div>
        ) : (
          <div className="relative">
            {TIME_SLOTS.map(hour => {
              const hourEvents = eventsByHour[hour] || [];
              const isCurrentHour = isCurrentDay && hour === currentHour;

              return (
                <div key={hour} className="relative flex">
                  {/* Time Label */}
                  <div className="w-16 flex-shrink-0 pr-3 py-3 text-right">
                    <span className={cn(
                      'text-xs font-medium',
                      isCurrentHour ? 'text-toca-purple' : 'text-gray-400'
                    )}>
                      {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                    </span>
                  </div>

                  {/* Hour Row */}
                  <div className="flex-1 min-h-[72px] border-l border-gray-200 pl-4 py-2 relative">
                    {/* Current Time Indicator */}
                    {isCurrentHour && (
                      <div
                        ref={currentTimeRef}
                        className="absolute left-0 right-0 h-0.5 bg-red-500 z-10"
                        style={{ top: `${(currentMinutes / 60) * 100}%` }}
                      >
                        <div className="absolute -left-2 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                      </div>
                    )}

                    {/* Events for this hour */}
                    <div className="space-y-2">
                      {hourEvents.map(event => (
                        <EventCard
                          key={event.id}
                          event={event}
                          onClick={() => onEventClick?.(event)}
                          config={config}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Individual Event Card for Day View
function EventCard({
  event,
  onClick,
  config,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  config: DiscoveryConfig;
}) {
  const startTime = formatTime(event.startTime);
  const endTime = formatTime(event.endTime);
  const registrationUrl = buildRegistrationUrl(event.linkSEO);

  return (
    <div
      onClick={onClick}
      className={cn(
        'group p-3 rounded-lg border-l-4 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer',
        event.color ? `border-l-[${event.color}]` : 'border-l-toca-purple'
      )}
      style={{ borderLeftColor: event.color || '#6366F1' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Program Name */}
          <h4 className="font-bold text-gray-900 text-sm group-hover:text-toca-purple transition-colors line-clamp-1">
            {event.programName}
          </h4>
          
          {/* Session Name if different */}
          {event.sessionName && event.sessionName !== event.programName && (
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
              {event.sessionName}
            </p>
          )}

          {/* Time & Location */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-toca-purple" />
              {startTime} - {endTime}
            </span>
            {event.facilityName && (
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-toca-purple" />
                {event.facilityName}
              </span>
            )}
            {event.spotsRemaining !== undefined && (
              <span className="flex items-center gap-1">
                <Users size={12} className="text-toca-purple" />
                {event.spotsRemaining} spots
              </span>
            )}
          </div>
        </div>

        {/* Quick Register */}
        {registrationUrl && (
          <a
            href={registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 p-2 rounded-lg bg-toca-purple/10 text-toca-purple hover:bg-toca-purple hover:text-white transition-colors"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

export default DayView;
