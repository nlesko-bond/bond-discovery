import { useState } from 'react';
import { ChevronDown, Users, Clock, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { Program, Session } from '../types/bond';
import { formatPrice, formatDateRange, formatTime, getProgramTypeLabel, getSportLabel, stripHtml } from '../utils/formatters';

interface ProgramCardProps {
  program: Program;
  orgId: string;
  onViewDetails?: (program: Program) => void;
}

// Helper to safely extract sessions array
function getSessions(program: Program): Session[] {
  const sessions = program.sessions;
  if (!sessions) return [];
  if (Array.isArray(sessions)) return sessions;
  if (typeof sessions === 'object' && 'data' in sessions) {
    return (sessions as any).data || [];
  }
  return [];
}

export function ProgramCard({ program, onViewDetails }: ProgramCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const sessions = getSessions(program);
  const upcomingSessions = sessions.filter(s => {
    if (!s.start_date) return true;
    return new Date(s.start_date) >= new Date();
  });
  
  const lowestPrice = sessions
    .flatMap(s => s.products || [])
    .flatMap(p => p.prices || [])
    .reduce((min, p) => (p.amount < min.amount ? p : min), { amount: Infinity, currency: 'USD' });

  const totalSpots = sessions.reduce((sum, s) => sum + (s.capacity || 0), 0);
  const enrolledSpots = sessions.reduce((sum, s) => sum + (s.current_enrollment || 0), 0);
  const spotsRemaining = totalSpots - enrolledSpots;
  const isAlmostFull = totalSpots > 0 && (enrolledSpots / totalSpots) >= 0.8;

  // Get sport-based gradient colors
  const sportGradients: Record<string, string> = {
    soccer: 'from-green-500 to-emerald-600',
    tennis: 'from-yellow-500 to-amber-600',
    basketball: 'from-orange-500 to-red-600',
    yoga: 'from-purple-500 to-violet-600',
    fitness: 'from-blue-500 to-indigo-600',
    swimming: 'from-cyan-500 to-blue-600',
    default: 'from-bond-gold to-bond-gold-dark',
  };
  const gradient = sportGradients[program.sport?.toLowerCase() || ''] || sportGradients.default;

  return (
    <div className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-gray-300 transition-all duration-300">
      {/* Header with gradient or Image */}
      <div className={`h-32 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
        {program.image_url ? (
          <img
            src={program.image_url}
            alt={program.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,white_0%,transparent_60%)]" />
          </div>
        )}
        
        {/* Badges overlay */}
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          {program.type && (
            <span className="text-xs font-bold px-2.5 py-1 bg-white/90 backdrop-blur-sm text-gray-800 rounded-full shadow-sm">
              {getProgramTypeLabel(program.type)}
            </span>
          )}
          {isAlmostFull && (
            <span className="text-xs font-bold px-2.5 py-1 bg-red-500 text-white rounded-full shadow-sm flex items-center gap-1">
              <Sparkles size={12} />
              Almost Full
            </span>
          )}
        </div>

        {/* Sport badge */}
        {program.sport && (
          <div className="absolute bottom-3 right-3">
            <span className="text-xs font-bold px-2.5 py-1 bg-black/30 backdrop-blur-sm text-white rounded-full">
              {getSportLabel(program.sport)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-bond-gold transition-colors">
          {program.name}
        </h3>

        {/* Description */}
        {program.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {stripHtml(program.description)}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-gray-400" />
            <span>{upcomingSessions.length} upcoming</span>
          </div>
          {totalSpots > 0 && (
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-gray-400" />
              <span className={spotsRemaining <= 5 ? 'text-red-600 font-medium' : ''}>
                {spotsRemaining > 0 ? `${spotsRemaining} spots` : 'Full'}
              </span>
            </div>
          )}
        </div>

        {/* Price and CTA */}
        <div className="flex items-end justify-between pt-4 border-t border-gray-100">
          <div>
            {lowestPrice.amount !== Infinity ? (
              <>
                <p className="text-xs text-gray-500 uppercase tracking-wide">From</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(lowestPrice.amount, lowestPrice.currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Contact for pricing</p>
            )}
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-bond-gold transition-colors"
          >
            <span>Sessions</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Expanded Sessions */}
      {expanded && sessions.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          <div className="space-y-2">
            {sessions.slice(0, 5).map((session) => (
              <SessionPreview key={session.id} session={session} />
            ))}
            {sessions.length > 5 && (
              <button className="w-full text-sm text-bond-gold font-medium py-2 hover:underline flex items-center justify-center gap-1">
                View all {sessions.length} sessions
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
      
      {expanded && sessions.length === 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-6 text-center">
          <p className="text-gray-500 text-sm">No sessions available</p>
        </div>
      )}
    </div>
  );
}

function SessionPreview({ session }: { session: Session }) {
  const startDate = session.start_date || '';
  const endDate = session.end_date || '';
  const spotsRemaining = session.capacity 
    ? session.capacity - (session.current_enrollment || 0) 
    : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;

  return (
    <div className={`p-3 bg-white border rounded-lg transition-colors hover:border-bond-gold/50 ${
      isFull ? 'border-gray-200 opacity-60' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {session.name || 'Session'}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            {(startDate || endDate) && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatDateRange(startDate, endDate)}
              </span>
            )}
            {session.start_time && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatTime(session.start_time)}
                {session.end_time && ` - ${formatTime(session.end_time)}`}
              </span>
            )}
          </div>
        </div>
        
        {spotsRemaining !== null && (
          <div className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
            isFull 
              ? 'bg-gray-100 text-gray-500' 
              : spotsRemaining <= 3 
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
          }`}>
            {isFull ? 'Full' : `${spotsRemaining} left`}
          </div>
        )}
      </div>
    </div>
  );
}
