import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Users, 
  MapPin,
  Calendar,
  Tag
} from 'lucide-react';
import { WeekSchedule, DaySchedule, ScheduleItem, Program } from '../types/bond';
import { formatPrice, formatTime, getProgramTypeLabel, getSportLabel } from '../utils/formatters';
import { format, parseISO } from 'date-fns';

interface ScheduleViewProps {
  schedule: WeekSchedule[];
  onProgramClick?: (program: Program) => void;
}

export function ScheduleView({ schedule, onProgramClick }: ScheduleViewProps) {
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  
  const currentWeek = schedule[currentWeekIndex];
  
  if (!currentWeek) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No schedule data available</p>
          <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  const hasItemsThisWeek = currentWeek.days.some(day => day.items.length > 0);

  return (
    <div className="p-4 md:p-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
          disabled={currentWeekIndex === 0}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Previous</span>
        </button>
        
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">
            {format(parseISO(currentWeek.weekStart), 'MMM d')} - {format(parseISO(currentWeek.weekEnd), 'MMM d, yyyy')}
          </h2>
          {currentWeekIndex === 0 && (
            <p className="text-xs text-bond-gold font-medium">This Week</p>
          )}
        </div>
        
        <button
          onClick={() => setCurrentWeekIndex(Math.min(schedule.length - 1, currentWeekIndex + 1))}
          disabled={currentWeekIndex === schedule.length - 1}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {/* Day Headers */}
        {currentWeek.days.map((day) => (
          <div
            key={day.date}
            className={`text-center py-2 rounded-t-lg ${
              day.isToday 
                ? 'bg-bond-gold text-white' 
                : day.isPast 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-gray-50 text-gray-700'
            }`}
          >
            <p className="text-xs font-medium">{day.dayOfWeek}</p>
            <p className={`text-lg font-bold ${day.isToday ? 'text-white' : ''}`}>
              {format(parseISO(day.date), 'd')}
            </p>
          </div>
        ))}
        
        {/* Day Content */}
        {currentWeek.days.map((day) => (
          <DayColumn 
            key={`content-${day.date}`} 
            day={day} 
            onItemClick={setSelectedItem}
          />
        ))}
      </div>

      {/* Empty State */}
      {!hasItemsThisWeek && (
        <div className="mt-8 text-center py-12 bg-gray-50 rounded-lg">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No sessions scheduled this week</p>
          <p className="text-gray-500 text-sm mt-1">Try browsing next week or adjust filters</p>
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedItem && (
        <SessionDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onProgramClick={onProgramClick}
        />
      )}
    </div>
  );
}

interface DayColumnProps {
  day: DaySchedule;
  onItemClick: (item: ScheduleItem) => void;
}

function DayColumn({ day, onItemClick }: DayColumnProps) {
  return (
    <div 
      className={`min-h-[120px] md:min-h-[200px] p-1 border border-gray-200 rounded-b-lg ${
        day.isPast ? 'bg-gray-50' : 'bg-white'
      }`}
    >
      <div className="space-y-1">
        {day.items.slice(0, 4).map((item) => (
          <ScheduleItemCard
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
            compact
          />
        ))}
        {day.items.length > 4 && (
          <button
            onClick={() => onItemClick(day.items[0])}
            className="w-full text-xs text-bond-gold font-medium py-1 hover:underline"
          >
            +{day.items.length - 4} more
          </button>
        )}
      </div>
    </div>
  );
}

interface ScheduleItemCardProps {
  item: ScheduleItem;
  onClick: () => void;
  compact?: boolean;
}

function ScheduleItemCard({ item, onClick, compact }: ScheduleItemCardProps) {
  const sportColors: Record<string, string> = {
    soccer: 'bg-green-100 border-green-300 text-green-800',
    tennis: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    basketball: 'bg-orange-100 border-orange-300 text-orange-800',
    yoga: 'bg-purple-100 border-purple-300 text-purple-800',
    fitness: 'bg-blue-100 border-blue-300 text-blue-800',
    default: 'bg-gray-100 border-gray-300 text-gray-800',
  };

  const colorClass = sportColors[item.program.sport?.toLowerCase() || ''] || sportColors.default;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left p-1.5 rounded border text-xs truncate hover:shadow-sm transition-shadow ${colorClass} ${
          item.is_full ? 'opacity-60' : ''
        }`}
      >
        <p className="font-medium truncate text-[10px] md:text-xs">{item.program.name}</p>
        {item.time_start && (
          <p className="text-[9px] md:text-[10px] opacity-75">{formatTime(item.time_start)}</p>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border hover:shadow-md transition-shadow ${colorClass} ${
        item.is_full ? 'opacity-60' : ''
      }`}
    >
      <p className="font-semibold truncate">{item.program.name}</p>
      {item.time_start && (
        <p className="text-sm flex items-center gap-1 mt-1">
          <Clock size={12} />
          {formatTime(item.time_start)}
          {item.time_end && ` - ${formatTime(item.time_end)}`}
        </p>
      )}
      {item.spots_remaining !== undefined && (
        <p className="text-sm mt-1">
          {item.is_full ? (
            <span className="text-red-600 font-medium">Full</span>
          ) : (
            <span>{item.spots_remaining} spots left</span>
          )}
        </p>
      )}
    </button>
  );
}

interface SessionDetailModalProps {
  item: ScheduleItem;
  onClose: () => void;
  onProgramClick?: (program: Program) => void;
}

function SessionDetailModal({ item, onClose, onProgramClick }: SessionDetailModalProps) {
  const { program, session } = item;
  
  const lowestPrice = (session.products || [])
    .flatMap(p => p.prices || [])
    .reduce((min, p) => (p.amount < min.amount ? p : min), { amount: Infinity, currency: 'USD' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex gap-2 mb-2 flex-wrap">
                {program.type && (
                  <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {getProgramTypeLabel(program.type)}
                  </span>
                )}
                {program.sport && (
                  <span className="text-xs font-semibold px-2 py-1 bg-purple-100 text-purple-800 rounded">
                    {getSportLabel(program.sport)}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{program.name}</h2>
              {session.name && session.name !== program.name && (
                <p className="text-gray-600 mt-1">{session.name}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {program.description && (
            <p className="text-gray-600 text-sm">{program.description}</p>
          )}

          {/* Session Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span>
                {item.date && format(parseISO(item.date), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            
            {item.time_start && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-5 h-5 text-gray-400" />
                <span>
                  {formatTime(item.time_start)}
                  {item.time_end && ` - ${formatTime(item.time_end)}`}
                </span>
              </div>
            )}
            
            {session.capacity && (
              <div className="flex items-center gap-3 text-sm">
                <Users className="w-5 h-5 text-gray-400" />
                <span>
                  {session.current_enrollment || 0} / {session.capacity} enrolled
                  {item.is_full && (
                    <span className="ml-2 text-red-600 font-medium">(Full)</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          {lowestPrice.amount !== Infinity && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">Starting from</p>
              <p className="text-2xl font-bold text-bond-gold">
                {formatPrice(lowestPrice.amount, lowestPrice.currency)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onProgramClick?.(program);
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-bond-gold text-white rounded-lg font-medium hover:bg-bond-gold-dark transition-colors"
            >
              View Program
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
