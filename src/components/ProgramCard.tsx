import { useState } from 'react';
import { ChevronDown, MapPin, Users, Clock } from 'lucide-react';
import { Program, Session } from '../types/bond';
import { formatPrice, formatDateRange, getProgramTypeLabel, getSportLabel } from '../utils/formatters';

interface ProgramCardProps {
  program: Program;
  orgId: string;
}

export function ProgramCard({ program }: ProgramCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const sessions = program.sessions || [];
  const lowestPrice = sessions
    .flatMap(s => s.products || [])
    .flatMap(p => p.prices || [])
    .reduce((min, p) => (p.amount < min.amount ? p : min), { amount: Infinity } as any);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header with Image */}
      {program.image_url && (
        <div className="h-48 bg-gray-200 overflow-hidden">
          <img
            src={program.image_url}
            alt={program.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Badges */}
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

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
          {program.name}
        </h3>

        {/* Description */}
        {program.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {program.description}
          </p>
        )}

        {/* Price */}
        {lowestPrice && lowestPrice.amount !== Infinity && (
          <div className="mb-3 pb-3 border-b border-gray-200">
            <p className="text-sm text-gray-600">Starting from</p>
            <p className="text-xl font-bold text-bond-gold">
              {formatPrice(lowestPrice.amount, lowestPrice.currency)}
            </p>
          </div>
        )}

        {/* Session Count */}
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
          <Clock size={16} />
          <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Expand Button */}
        {sessions.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm font-medium text-gray-700 transition-colors"
          >
            <span>View Sessions</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Expanded Sessions */}
      {expanded && sessions.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="space-y-3">
            {sessions.slice(0, 3).map((session) => (
              <SessionPreview key={session.id} session={session} />
            ))}
            {sessions.length > 3 && (
              <p className="text-xs text-gray-500 text-center">
                +{sessions.length - 3} more sessions
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionPreview({ session }: { session: Session }) {
  const startDate = session.start_date || '';
  const endDate = session.end_date || '';

  return (
    <div className="p-2 bg-white border border-gray-200 rounded">
      <p className="text-sm font-medium text-gray-900 mb-1">{session.name || 'Session'}</p>
      {(startDate || endDate) && (
        <p className="text-xs text-gray-600 mb-1">
          {formatDateRange(startDate, endDate)}
        </p>
      )}
      {session.start_time && session.end_time && (
        <p className="text-xs text-gray-600 flex items-center gap-1">
          <Clock size={12} />
          {session.start_time} - {session.end_time}
        </p>
      )}
      {session.capacity && (
        <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
          <Users size={12} />
          {session.current_enrollment || 0} / {session.capacity} enrolled
        </p>
      )}
    </div>
  );
}
