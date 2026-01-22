'use client';

import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  Shield,
  X
} from 'lucide-react';
import { WeekSchedule, DaySchedule, CalendarEvent, DiscoveryConfig } from '@/types';
import { formatDate, formatTime, formatPrice, getSportLabel, getProgramTypeLabel, cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface ScheduleViewProps {
  schedule: WeekSchedule[];
  config: DiscoveryConfig;
}

export function ScheduleView({ schedule, config }: ScheduleViewProps) {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const currentWeek = schedule[currentWeekIndex];

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
    <div className="p-4 md:p-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
          disabled={currentWeekIndex === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">
            {format(parseISO(currentWeek.weekStart), 'MMM d')} -{' '}
            {format(parseISO(currentWeek.weekEnd), 'MMM d, yyyy')}
          </h2>
          <p className="text-sm text-gray-500">
            Week {currentWeekIndex + 1} of {schedule.length}
          </p>
        </div>

        <button
          onClick={() => setCurrentWeekIndex(Math.min(schedule.length - 1, currentWeekIndex + 1))}
          disabled={currentWeekIndex === schedule.length - 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Week Grid - Desktop */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {currentWeek.days.map((day) => (
          <div
            key={`header-${day.date}`}
            className={cn(
              'text-center py-2 text-sm font-semibold rounded-t-lg',
              day.isToday ? 'bg-bond-gold text-white' : 'bg-gray-100 text-gray-700'
            )}
          >
            <div>{day.dayOfWeek}</div>
            <div className={cn(
              'text-xs font-normal mt-0.5',
              day.isToday ? 'text-white/80' : 'text-gray-500'
            )}>
              {format(parseISO(day.date), 'MMM d')}
            </div>
          </div>
        ))}

        {/* Day Content */}
        {currentWeek.days.map((day) => (
          <DayColumn
            key={`content-${day.date}`}
            day={day}
            onEventClick={setSelectedEvent}
            config={config}
          />
        ))}
      </div>

      {/* Mobile List View */}
      <div className="md:hidden space-y-4">
        {currentWeek.days.map((day) => (
          <MobileDaySection
            key={day.date}
            day={day}
            onEventClick={setSelectedEvent}
            config={config}
          />
        ))}
      </div>

      {/* Empty State */}
      {!hasEventsThisWeek && (
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

// Day Column for Desktop
function DayColumn({
  day,
  onEventClick,
  config,
}: {
  day: DaySchedule;
  onEventClick: (event: CalendarEvent) => void;
  config: DiscoveryConfig;
}) {
  return (
    <div
      className={cn(
        'min-h-[200px] p-2 border border-t-0 rounded-b-lg space-y-2 overflow-y-auto max-h-[400px]',
        day.isToday ? 'bg-bond-gold/5 border-bond-gold/20' : 'bg-white border-gray-200',
        day.isPast && 'opacity-50'
      )}
    >
      {day.events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          onClick={() => onEventClick(event)}
          compact
          config={config}
        />
      ))}
      {day.events.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No events</p>
      )}
    </div>
  );
}

// Mobile Day Section
function MobileDaySection({
  day,
  onEventClick,
  config,
}: {
  day: DaySchedule;
  onEventClick: (event: CalendarEvent) => void;
  config: DiscoveryConfig;
}) {
  if (day.events.length === 0) return null;

  return (
    <div className={cn(day.isPast && 'opacity-50')}>
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-t-lg font-semibold',
        day.isToday ? 'bg-bond-gold text-white' : 'bg-gray-100 text-gray-900'
      )}>
        <span>{day.dayOfWeek}</span>
        <span className={cn(
          'text-sm font-normal',
          day.isToday ? 'text-white/80' : 'text-gray-500'
        )}>
          {format(parseISO(day.date), 'MMMM d')}
        </span>
        {day.isToday && (
          <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">
            Today
          </span>
        )}
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-lg p-3 space-y-2 bg-white">
        {day.events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onClick={() => onEventClick(event)}
            config={config}
          />
        ))}
      </div>
    </div>
  );
}

// Event Card
function EventCard({
  event,
  onClick,
  compact = false,
  config,
}: {
  event: CalendarEvent;
  onClick: () => void;
  compact?: boolean;
  config: DiscoveryConfig;
}) {
  const spotsInfo = event.spotsRemaining !== undefined && event.maxParticipants;
  const isFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 0;
  const isAlmostFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 5 && !isFull;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded-lg border transition-all hover:shadow-md',
        'border-l-4',
        isFull ? 'opacity-60 border-gray-200' : 'hover:border-gray-300'
      )}
      style={{ borderLeftColor: event.color }}
    >
      <div className={cn('font-semibold text-gray-900 line-clamp-1', compact ? 'text-xs' : 'text-sm')}>
        {event.programName}
      </div>
      
      {event.sessionName && event.sessionName !== event.programName && (
        <div className={cn('text-gray-600 line-clamp-1', compact ? 'text-[10px]' : 'text-xs')}>
          {event.sessionName}
        </div>
      )}

      <div className={cn('flex items-center gap-1 text-gray-500 mt-1', compact ? 'text-[10px]' : 'text-xs')}>
        <Clock size={compact ? 10 : 12} />
        <span>{formatTime(event.startTime)}</span>
        {event.endTime && <span>- {formatTime(event.endTime)}</span>}
      </div>

      {!compact && (
        <>
          {event.facilityName && (
            <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
              <MapPin size={12} />
              <span className="truncate">{event.facilityName}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            {config.features.showPricing && event.startingPrice && (
              <span className="text-xs font-semibold text-gray-900">
                {formatPrice(event.startingPrice)}
              </span>
            )}
            
            {config.features.showAvailability && spotsInfo && (
              <span className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded',
                isFull && 'bg-red-100 text-red-700',
                isAlmostFull && 'bg-yellow-100 text-yellow-700',
                !isFull && !isAlmostFull && 'bg-green-100 text-green-700'
              )}>
                {isFull ? 'Full' : `${event.spotsRemaining} left`}
              </span>
            )}
            
            {config.features.showMembershipBadges && event.membershipRequired && (
              <Shield size={12} className="text-amber-500" />
            )}
          </div>
        </>
      )}
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
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-xl max-h-[80vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div 
          className="p-4 text-white relative"
          style={{ backgroundColor: event.color }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
          
          <div className="pr-10">
            <h3 className="text-xl font-bold">{event.programName}</h3>
            {event.sessionName && event.sessionName !== event.programName && (
              <p className="text-white/80 mt-1">{event.sessionName}</p>
            )}
            <div className="flex items-center gap-2 mt-2 text-sm text-white/80">
              {event.sport && <span className="capitalize">{getSportLabel(event.sport)}</span>}
              {event.programType && (
                <>
                  <span>•</span>
                  <span>{getProgramTypeLabel(event.programType)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">{formatDate(event.date, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-sm text-gray-600">
                {formatTime(event.startTime)}
                {event.endTime && ` - ${formatTime(event.endTime)}`}
              </p>
            </div>
          </div>

          {/* Location */}
          {(event.facilityName || event.location) && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">{event.facilityName}</p>
                {event.location && <p className="text-sm text-gray-600">{event.location}</p>}
              </div>
            </div>
          )}

          {/* Capacity */}
          {config.features.showAvailability && event.maxParticipants && (
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">
                  {event.currentParticipants || 0} / {event.maxParticipants} Enrolled
                </p>
                {event.spotsRemaining !== undefined && (
                  <p className={cn(
                    'text-sm',
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

          {/* Pricing */}
          {config.features.showPricing && event.startingPrice && (
            <div className="flex items-start gap-3">
              <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">{formatPrice(event.startingPrice)}</p>
                {event.memberPrice && event.memberPrice < event.startingPrice && (
                  <p className="text-sm text-bond-gold">
                    Member price: {formatPrice(event.memberPrice)}
                  </p>
                )}
                {config.features.showMembershipBadges && event.membershipRequired && (
                  <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                    <Shield size={14} />
                    Membership required
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button className="w-full py-3 bg-bond-gold text-white font-semibold rounded-lg hover:bg-bond-gold-dark transition-colors">
            View Program Details
          </button>
        </div>
      </div>
    </div>
  );
}
