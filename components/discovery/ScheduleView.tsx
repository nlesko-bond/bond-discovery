'use client';

import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  CalendarDays,
  List,
  Clock,
  MapPin,
  Users,
  Tag,
  Shield,
  X,
  ExternalLink
} from 'lucide-react';
import { WeekSchedule, DaySchedule, CalendarEvent, DiscoveryConfig } from '@/types';
import { formatDate, formatTime, formatPrice, getSportLabel, getProgramTypeLabel, cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

type ViewMode = 'calendar' | 'list';

interface ScheduleViewProps {
  schedule: WeekSchedule[];
  config: DiscoveryConfig;
  isLoading?: boolean;
  error?: string | null;
  totalEvents?: number;
}

export function ScheduleView({ schedule, config, isLoading, error, totalEvents }: ScheduleViewProps) {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const currentWeek = schedule[currentWeekIndex];
  
  // Count events for this week
  const weekEventCount = currentWeek?.days.reduce((sum, day) => sum + day.events.length, 0) || 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-toca-navy border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Events...</h3>
          <p className="text-gray-500 text-sm">Fetching schedule data from all sessions.</p>
        </div>
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
    <div className="p-4 md:p-6">
      {/* Header with stats */}
      {totalEvents !== undefined && totalEvents > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-toca-purple animate-pulse" />
            <span className="text-sm text-gray-600">
              <span className="font-semibold text-toca-navy">{totalEvents.toLocaleString()}</span> events loaded
            </span>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'list'
                  ? 'bg-white text-toca-navy shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <List size={14} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'calendar'
                  ? 'bg-white text-toca-navy shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <CalendarDays size={14} />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6 bg-gradient-to-r from-toca-navy to-toca-purple rounded-xl p-4 text-white">
        <button
          onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
          disabled={currentWeekIndex === 0}
          className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold">
            {format(parseISO(currentWeek.weekStart), 'MMM d')} -{' '}
            {format(parseISO(currentWeek.weekEnd), 'MMM d, yyyy')}
          </h2>
          <p className="text-sm text-white/70">
            Week {currentWeekIndex + 1} of {schedule.length}
            {weekEventCount > 0 && ` • ${weekEventCount} events`}
          </p>
        </div>

        <button
          onClick={() => setCurrentWeekIndex(Math.min(schedule.length - 1, currentWeekIndex + 1))}
          disabled={currentWeekIndex === schedule.length - 1}
          className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Calendar Grid View */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {/* Day Headers */}
          {currentWeek.days.map((day) => (
            <div
              key={`header-${day.date}`}
              className={cn(
                'text-center py-2 text-sm font-semibold rounded-t-lg',
                day.isToday ? 'bg-toca-purple text-white' : 'bg-gray-100 text-gray-700'
              )}
            >
              <div className="hidden sm:block">{day.dayOfWeek}</div>
              <div className="sm:hidden">{day.dayOfWeek.slice(0, 1)}</div>
              <div className={cn(
                'text-xs font-normal mt-0.5',
                day.isToday ? 'text-white/80' : 'text-gray-500'
              )}>
                {format(parseISO(day.date), 'd')}
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
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {currentWeek.days.map((day) => (
            <ListDaySection
              key={day.date}
              day={day}
              onEventClick={setSelectedEvent}
              config={config}
            />
          ))}
        </div>
      )}

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
  return (
    <div
      className={cn(
        'min-h-[120px] md:min-h-[200px] p-1 md:p-2 border border-t-0 rounded-b-lg space-y-1 overflow-y-auto max-h-[300px] md:max-h-[400px]',
        day.isToday ? 'bg-toca-purple/5 border-toca-purple/30' : 'bg-white border-gray-200',
        day.isPast && 'opacity-50'
      )}
    >
      {day.events.slice(0, 5).map((event) => (
        <button
          key={event.id}
          onClick={() => onEventClick(event)}
          className={cn(
            'w-full text-left p-1.5 rounded text-xs transition-all hover:bg-toca-purple/10',
            'border-l-2'
          )}
          style={{ borderLeftColor: event.color || '#6366F1' }}
        >
          <div className="font-medium text-gray-900 line-clamp-1 text-[10px] md:text-xs">
            {event.programName}
          </div>
          <div className="text-gray-500 text-[9px] md:text-[10px]">
            {formatTime(event.startTime)}
          </div>
        </button>
      ))}
      {day.events.length > 5 && (
        <button className="w-full text-center text-[10px] text-toca-purple font-medium py-1">
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
  if (day.events.length === 0) return null;

  return (
    <div className={cn(day.isPast && 'opacity-60')}>
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-t-xl font-semibold',
        day.isToday 
          ? 'bg-gradient-to-r from-toca-navy to-toca-purple text-white' 
          : 'bg-gray-100 text-gray-900'
      )}>
        <div className={cn(
          'w-12 h-12 rounded-lg flex flex-col items-center justify-center',
          day.isToday ? 'bg-white/20' : 'bg-white'
        )}>
          <span className={cn('text-xs font-normal', day.isToday ? 'text-white/80' : 'text-gray-500')}>
            {day.dayOfWeek.slice(0, 3)}
          </span>
          <span className={cn('text-lg font-bold', day.isToday ? 'text-white' : 'text-gray-900')}>
            {format(parseISO(day.date), 'd')}
          </span>
        </div>
        <div className="flex-1">
          <span className={day.isToday ? 'text-white' : ''}>
            {format(parseISO(day.date), 'EEEE, MMMM d')}
          </span>
          <div className={cn('text-sm', day.isToday ? 'text-white/70' : 'text-gray-500')}>
            {day.events.length} event{day.events.length !== 1 ? 's' : ''}
          </div>
        </div>
        {day.isToday && (
          <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
            Today
          </span>
        )}
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-xl divide-y divide-gray-100 bg-white overflow-hidden">
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
  const spotsInfo = event.spotsRemaining !== undefined && event.maxParticipants;
  const isFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 0;
  const isAlmostFull = event.spotsRemaining !== undefined && event.spotsRemaining <= 5 && !isFull;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 transition-all hover:bg-gray-50 flex items-start gap-4',
        isFull && 'opacity-60'
      )}
    >
      {/* Color indicator */}
      <div 
        className="w-1 h-full min-h-[60px] rounded-full flex-shrink-0"
        style={{ backgroundColor: event.color || '#6366F1' }}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 line-clamp-1">
              {event.programName}
            </h4>
            {event.sessionName && event.sessionName !== event.programName && (
              <p className="text-sm text-gray-600 line-clamp-1">
                {event.sessionName}
              </p>
            )}
          </div>
          
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {config.features.showAvailability && spotsInfo && (
              <span className={cn(
                'text-xs font-medium px-2 py-1 rounded-full',
                isFull && 'bg-red-100 text-red-700',
                isAlmostFull && 'bg-yellow-100 text-yellow-700',
                !isFull && !isAlmostFull && 'bg-green-100 text-green-700'
              )}>
                {isFull ? 'Full' : `${event.spotsRemaining} left`}
              </span>
            )}
            {config.features.showMembershipBadges && event.membershipRequired && (
              <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                <Shield size={10} />
                Member
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-toca-purple" />
            {formatTime(event.startTime)}
            {event.endTime && ` - ${formatTime(event.endTime)}`}
          </span>
          
          {event.facilityName && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-toca-purple" />
              {event.facilityName}
            </span>
          )}
          
          {config.features.showPricing && event.startingPrice !== undefined && (
            <span className="font-semibold text-toca-navy">
              {event.startingPrice === 0 ? 'FREE' : formatPrice(event.startingPrice)}
            </span>
          )}
        </div>
        
        {event.linkSEO && (
          <a 
            href={event.linkSEO}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-2 text-sm text-toca-purple hover:text-toca-purple-dark font-medium"
          >
            Register <ExternalLink size={12} />
          </a>
        )}
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
                  <p className="text-sm text-toca-navy">
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
          {event.linkSEO ? (
            <a 
              href={event.linkSEO}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-gradient-to-r from-toca-navy to-toca-purple text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              Register Now <ExternalLink size={16} />
            </a>
          ) : (
            <button className="w-full py-3 bg-gradient-to-r from-toca-navy to-toca-purple text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
              View Program Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
