'use client';

import { useState } from 'react';
import { 
  ChevronDown, 
  Users, 
  Clock, 
  Calendar, 
  MapPin,
  Tag,
  Sparkles,
  Shield
} from 'lucide-react';
import { Program, Session, Product, DiscoveryConfig } from '@/types';
import { 
  formatPrice, 
  formatDateRange, 
  formatTime, 
  formatAgeRange,
  getProgramTypeLabel, 
  getSportLabel,
  getGenderLabel,
  getAvailabilityInfo,
  getSportGradient,
  cn
} from '@/lib/utils';

interface ProgramCardProps {
  program: Program;
  config: DiscoveryConfig;
}

export function ProgramCard({ program, config }: ProgramCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const sessions = getSessions(program);
  const upcomingSessions = sessions.filter(s => {
    if (!s.startDate) return true;
    return new Date(s.startDate) >= new Date();
  });
  
  // Get pricing info
  const { lowestPrice, memberPrice, hasMembershipRequired } = getPricingInfo(sessions);
  
  // Get availability info
  const totalSpots = sessions.reduce((sum, s) => sum + (s.capacity || 0), 0);
  const enrolledSpots = sessions.reduce((sum, s) => sum + (s.currentEnrollment || 0), 0);
  const spotsRemaining = totalSpots - enrolledSpots;
  const availabilityInfo = getAvailabilityInfo(spotsRemaining, totalSpots);
  
  // Age/Gender info
  const ageRange = formatAgeRange(program.ageMin, program.ageMax);
  const genderLabel = program.gender && program.gender !== 'all' 
    ? getGenderLabel(program.gender) 
    : null;

  return (
    <div className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-gray-300 transition-all duration-300">
      {/* Header with gradient */}
      <div className={cn('h-32 relative overflow-hidden', getSportGradient(program.sport))}>
        {program.imageUrl ? (
          <img
            src={program.imageUrl}
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
            <span className="badge-type bg-white/90 backdrop-blur-sm shadow-sm">
              {getProgramTypeLabel(program.type)}
            </span>
          )}
          {availabilityInfo.color === 'red' && totalSpots > 0 && (
            <span className="badge bg-red-500 text-white shadow-sm flex items-center gap-1">
              <Sparkles size={12} />
              {availabilityInfo.label}
            </span>
          )}
        </div>

        {/* Sport badge & Membership indicator */}
        <div className="absolute bottom-3 right-3 flex gap-2">
          {config.features.showMembershipBadges && hasMembershipRequired && (
            <span className="badge-membership flex items-center gap-1">
              <Shield size={12} />
              Members
            </span>
          )}
          {program.sport && (
            <span className="badge bg-black/30 backdrop-blur-sm text-white">
              {getSportLabel(program.sport)}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-bond-gold transition-colors">
          {program.name}
        </h3>

        {/* Age/Gender line */}
        {config.features.showAgeGender && (ageRange || genderLabel) && (
          <p className="text-sm text-gray-500 mb-2">
            {[ageRange, genderLabel].filter(Boolean).join(' | ')}
          </p>
        )}

        {/* Description */}
        {program.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {program.description}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-gray-400" />
            <span>{upcomingSessions.length} upcoming</span>
          </div>
          {config.features.showAvailability && totalSpots > 0 && (
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-gray-400" />
              <span className={cn(
                spotsRemaining <= 5 ? 'text-red-600 font-medium' : ''
              )}>
                {spotsRemaining > 0 ? `${spotsRemaining} spots` : 'Full'}
              </span>
            </div>
          )}
        </div>

        {/* Pricing */}
        {config.features.showPricing && (
          <div className="flex items-end justify-between pt-4 border-t border-gray-100">
            <div>
              {lowestPrice !== undefined ? (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">From</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPrice(lowestPrice)}
                  </p>
                  {memberPrice !== undefined && memberPrice < lowestPrice && (
                    <p className="text-sm text-bond-gold font-medium">
                      Members: {formatPrice(memberPrice)}
                    </p>
                  )}
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
                className={cn('transition-transform', expanded && 'rotate-180')}
              />
            </button>
          </div>
        )}
      </div>

      {/* Expanded Sessions */}
      {expanded && sessions.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4 animate-fade-in">
          <div className="space-y-2">
            {sessions.slice(0, 5).map((session) => (
              <SessionCard key={session.id} session={session} config={config} />
            ))}
            {sessions.length > 5 && (
              <button className="w-full text-sm text-bond-gold font-medium py-2 hover:underline flex items-center justify-center gap-1">
                View all {sessions.length} sessions
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

// Session card component
function SessionCard({ session, config }: { session: Session; config: DiscoveryConfig }) {
  const [showProducts, setShowProducts] = useState(false);
  const availability = getAvailabilityInfo(session.spotsRemaining, session.capacity);
  const products = session.products || [];
  const activeProducts = products.filter(p => p.status === 'active');

  return (
    <div className={cn(
      'p-3 bg-white border rounded-lg transition-colors',
      session.isFull ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-bond-gold/50'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {session.name || 'Session'}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            {(session.startDate || session.endDate) && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatDateRange(session.startDate || '', session.endDate || '')}
              </span>
            )}
            {session.startTime && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatTime(session.startTime)}
                {session.endTime && ` - ${formatTime(session.endTime)}`}
              </span>
            )}
          </div>
        </div>
        
        {config.features.showAvailability && availability.label && (
          <div className={cn(
            'text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap',
            availability.color === 'red' && 'bg-red-100 text-red-700',
            availability.color === 'yellow' && 'bg-yellow-100 text-yellow-700',
            availability.color === 'green' && 'bg-green-100 text-green-700',
            availability.color === 'gray' && 'bg-gray-100 text-gray-700'
          )}>
            {availability.label}
          </div>
        )}
      </div>

      {/* Products/Pricing */}
      {config.features.showPricing && activeProducts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => setShowProducts(!showProducts)}
            className="text-xs text-bond-gold font-medium flex items-center gap-1"
          >
            <Tag size={12} />
            {activeProducts.length} pricing option{activeProducts.length !== 1 ? 's' : ''}
            <ChevronDown size={12} className={cn('transition-transform', showProducts && 'rotate-180')} />
          </button>
          
          {showProducts && (
            <div className="mt-2 space-y-2">
              {activeProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Product card component
function ProductCard({ product }: { product: Product }) {
  const lowestPrice = product.prices.reduce(
    (min, p) => p.amount < min ? p.amount : min,
    Infinity
  );
  const hasDiscount = product.membershipDiscounts && product.membershipDiscounts.length > 0;

  return (
    <div className="p-2 bg-gray-50 rounded text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">{product.name}</span>
        <span className="font-bold text-gray-900">
          {lowestPrice !== Infinity ? formatPrice(lowestPrice) : 'TBD'}
        </span>
      </div>
      
      {product.membershipRequired && (
        <div className="flex items-center gap-1 mt-1 text-amber-600">
          <Shield size={10} />
          <span>Membership required</span>
        </div>
      )}
      
      {hasDiscount && !product.membershipRequired && (
        <div className="flex items-center gap-1 mt-1 text-bond-gold">
          <Tag size={10} />
          <span>Member discount available</span>
        </div>
      )}
      
      {product.registrationStartDate && new Date(product.registrationStartDate) > new Date() && (
        <div className="mt-1 text-gray-500">
          Registration opens {formatDateRange(product.registrationStartDate, product.registrationStartDate)}
        </div>
      )}
    </div>
  );
}

// Helper functions
function getSessions(program: Program): Session[] {
  const sessions = program.sessions;
  if (!sessions) return [];
  if (Array.isArray(sessions)) return sessions;
  if (typeof sessions === 'object' && 'data' in sessions) {
    return (sessions as any).data || [];
  }
  return [];
}

function getPricingInfo(sessions: Session[]): {
  lowestPrice?: number;
  memberPrice?: number;
  hasMembershipRequired: boolean;
} {
  let lowestPrice: number | undefined;
  let memberPrice: number | undefined;
  let hasMembershipRequired = false;

  sessions.forEach(session => {
    (session.products || []).forEach(product => {
      if (product.status !== 'active') return;
      
      if (product.membershipRequired) {
        hasMembershipRequired = true;
      }

      product.prices.forEach(price => {
        if (lowestPrice === undefined || price.amount < lowestPrice) {
          lowestPrice = price.amount;
        }
      });

      // Calculate member price
      if (product.membershipDiscounts?.length) {
        product.prices.forEach(price => {
          const discount = product.membershipDiscounts![0];
          let discountedPrice: number;
          
          if (discount.discountType === 'percentage') {
            discountedPrice = price.amount * (1 - discount.discountValue / 100);
          } else {
            discountedPrice = price.amount - discount.discountValue;
          }
          
          if (memberPrice === undefined || discountedPrice < memberPrice) {
            memberPrice = Math.max(0, discountedPrice);
          }
        });
      }
    });
  });

  return { lowestPrice, memberPrice, hasMembershipRequired };
}
