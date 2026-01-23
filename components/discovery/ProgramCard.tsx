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
  Shield,
  ExternalLink,
  DollarSign,
  Star
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
  buildRegistrationUrl,
  cn
} from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PricingCarousel } from './PricingCarousel';

interface ProgramCardProps {
  program: Program;
  config: DiscoveryConfig;
  autoExpand?: boolean; // Auto-expand sessions when viewing single program
}

// Sport-specific gradients for visual appeal
const sportGradients: Record<string, string> = {
  soccer: 'from-green-500 to-emerald-600',
  football: 'from-amber-600 to-orange-700',
  basketball: 'from-orange-500 to-red-600',
  tennis: 'from-yellow-400 to-lime-500',
  yoga: 'from-purple-500 to-violet-600',
  fitness: 'from-blue-500 to-indigo-600',
  swimming: 'from-cyan-500 to-blue-600',
  baseball: 'from-red-500 to-rose-600',
  volleyball: 'from-pink-500 to-rose-600',
  hockey: 'from-slate-500 to-gray-700',
  lacrosse: 'from-blue-600 to-indigo-700',
  default: 'from-indigo-600 to-purple-600',
};

export function ProgramCard({ program, config, autoExpand = false }: ProgramCardProps) {
  const [expanded, setExpanded] = useState(autoExpand);
  
  // Dynamic colors from config
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  
  const sessions = getSessions(program);
  // Include all sessions that haven't ended yet
  const upcomingSessions = sessions.filter(s => {
    if (!s.endDate) return true;
    const endDate = new Date(s.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate >= today;
  });
  
  // Get pricing info
  const pricingInfo = getPricingInfo(sessions);
  
  // Get availability info across all sessions
  const totalSpots = sessions.reduce((sum, s) => sum + (s.maxParticipants || s.capacity || 0), 0);
  const enrolledSpots = sessions.reduce((sum, s) => sum + (s.currentEnrollment || 0), 0);
  const spotsRemaining = totalSpots > 0 ? totalSpots - enrolledSpots : undefined;
  const availabilityInfo = getAvailabilityInfo(spotsRemaining, totalSpots);
  
  // Get facility name from first session if available
  const facilityName = program.facilityName || sessions[0]?.facility?.name;
  
  // Age/Gender info
  const ageRange = formatAgeRange(program.ageMin, program.ageMax);
  const genderLabel = program.gender && program.gender !== 'all' && program.gender !== 'coed'
    ? getGenderLabel(program.gender) 
    : null;

  // Sport gradient
  const gradient = sportGradients[program.sport?.toLowerCase() || ''] || sportGradients.default;
  
  // Has image?
  const imageUrl = program.imageUrl || program.mainMedia?.url;

  return (
    <div className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-2xl hover:border-gray-300 transition-all duration-300 hover:-translate-y-1">
      {/* Header with image or gradient */}
      <div className="h-40 relative overflow-hidden">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={program.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient}`}>
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,white_0%,transparent_50%)]" />
              <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full bg-white/10 -mr-10 -mb-10" />
            </div>
          </div>
        )}
        
        {/* Top badges */}
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          {program.type && (
            <span className="px-2.5 py-1 text-xs font-bold bg-white/95 backdrop-blur-sm text-gray-800 rounded-full shadow-sm">
              {getProgramTypeLabel(program.type)}
            </span>
          )}
          {config.features.showAvailability && availabilityInfo.color === 'red' && totalSpots > 0 && (
            <span className="px-2.5 py-1 text-xs font-bold bg-red-500 text-white rounded-full shadow-sm flex items-center gap-1">
              <Sparkles size={12} />
              {spotsRemaining === 0 ? 'Full' : 'Almost Full'}
            </span>
          )}
        </div>

        {/* Bottom badges */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="flex gap-2">
            {program.sport && (
              <span className="px-2.5 py-1 text-xs font-bold bg-black/40 backdrop-blur-sm text-white rounded-full">
                {getSportLabel(program.sport)}
              </span>
            )}
          </div>
          {config.features.showMembershipBadges && pricingInfo.hasMemberPricing && (
            <span className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-white rounded-full shadow-sm flex items-center gap-1">
              <Star size={12} />
              Member Pricing
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title */}
        <h3 
          className="text-lg font-bold text-gray-900 mb-1 line-clamp-2 transition-colors"
          style={{ '--hover-color': secondaryColor } as React.CSSProperties}
        >
          <span className="group-hover:opacity-80">{program.name}</span>
        </h3>

        {/* Facility & Location */}
        {facilityName && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
            <MapPin size={14} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{facilityName}</span>
          </div>
        )}

        {/* Age/Gender line */}
        {config.features.showAgeGender && (ageRange || genderLabel) && (
          <p className="text-sm text-gray-500 mb-2">
            {[ageRange, genderLabel].filter(Boolean).join(' • ')}
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
            <span>{upcomingSessions.length} session{upcomingSessions.length !== 1 ? 's' : ''}</span>
          </div>
          {config.features.showAvailability && totalSpots > 0 && spotsRemaining !== undefined && (
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-gray-400" />
              <span className={cn(
                spotsRemaining <= 5 && spotsRemaining > 0 ? 'text-amber-600 font-medium' : '',
                spotsRemaining === 0 ? 'text-red-600 font-medium' : ''
              )}>
                {spotsRemaining > 0 ? `${spotsRemaining} spots left` : 'Full'}
              </span>
            </div>
          )}
        </div>

        {/* Pricing Section */}
        {config.features.showPricing && (
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-end justify-between">
              <div>
                {pricingInfo.hasPrice ? (
                  <div className="space-y-1">
                    {/* Regular price */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">From</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {formatPrice(pricingInfo.regularPrice!)}
                      </span>
                    </div>
                    
                    {/* Member price */}
                    {pricingInfo.hasMemberPricing && pricingInfo.memberPrice !== undefined && (
                      <div className="flex items-center gap-2">
                        <Star size={14} className="text-amber-500" />
                        <span className="text-sm font-semibold text-amber-600">
                          Members: {formatPrice(pricingInfo.memberPrice)}
                        </span>
                        {pricingInfo.regularPrice && pricingInfo.memberPrice < pricingInfo.regularPrice && (
                          <span className="text-xs text-green-600 font-medium">
                            Save {Math.round(((pricingInfo.regularPrice - pricingInfo.memberPrice) / pricingInfo.regularPrice) * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">See pricing options</span>
                )}
              </div>
              
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all duration-200"
                style={{ '--hover-bg': secondaryColor } as React.CSSProperties}
              >
                <span>Details</span>
                <ChevronDown
                  size={16}
                  className={cn('transition-transform', expanded && 'rotate-180')}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Sessions */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/70 p-4 animate-fade-in">
          <div className="space-y-3">
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <SessionCard 
                  key={session.id} 
                  session={session} 
                  config={config}
                  programLinkSEO={program.linkSEO}
                  programId={program.id}
                  programName={program.name}
                  autoExpandPricing={sessions.length === 1}
                />
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">No sessions available</p>
            )}
          </div>
          
          {/* Register CTA */}
          {program.linkSEO && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <a
                href={buildRegistrationUrl(program.linkSEO)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white font-semibold rounded-xl hover:opacity-90 transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                <span>View Program & Register</span>
                <ExternalLink size={16} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Session card component
function SessionCard({ 
  session,
  config,
  programLinkSEO,
  programId,
  programName,
  autoExpandPricing = false,
}: { 
  session: Session; 
  config: DiscoveryConfig;
  programLinkSEO?: string;
  programId: string;
  programName: string;
  autoExpandPricing?: boolean;
}) {
  const pathname = usePathname();
  // Auto-expand pricing if there's only one session (autoExpandPricing=true)
  const [showPricing, setShowPricing] = useState(autoExpandPricing);
  const availability = getAvailabilityInfo(session.spotsRemaining, session.maxParticipants || session.capacity);
  const products = session.products || [];
  
  // Dynamic colors from config
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  
  // Check registration status
  const isRegistrationOpen = session.registrationWindowStatus === 'open';
  const isRegistrationClosed = session.registrationWindowStatus === 'closed' || session.registrationWindowStatus === 'ended';
  const isRegistrationNotYetOpen = session.registrationWindowStatus === 'not_opened_yet';
  const isRegistrationUnavailable = isRegistrationClosed || isRegistrationNotYetOpen;
  
  const facilityName = session.facility?.name;
  const baseLink = session.linkSEO || programLinkSEO;
  
  // For single product, deep link directly to that product
  const singleProduct = products.length === 1 ? products[0] : null;
  const registrationLink = singleProduct 
    ? buildRegistrationUrl(baseLink, { productId: singleProduct.id })
    : buildRegistrationUrl(baseLink);
  
  // Get price for single product
  const singleProductPrice = singleProduct?.prices?.[0]?.price ?? singleProduct?.prices?.[0]?.amount;
  
  // Build schedule link with program AND session filter - links to list view
  const scheduleLink = `${pathname}?viewMode=schedule&scheduleView=list&programIds=${programId}&sessionIds=${session.id}`;

  return (
    <div 
      className={cn(
        'p-3 bg-white rounded-xl border transition-all',
        session.isFull ? 'border-gray-200 opacity-70' : 'border-gray-200 hover:shadow-md'
      )}
      style={!session.isFull ? { '--hover-border': `${secondaryColor}50` } as React.CSSProperties : undefined}
    >
      {/* Session Header with Register Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm truncate">
              {session.name || 'Session'}
            </p>
            {isRegistrationClosed && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-gray-100 text-gray-600">
                Registration Closed
              </span>
            )}
            {isRegistrationNotYetOpen && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-blue-100 text-blue-600">
                Coming Soon
              </span>
            )}
            {config.features.showAvailability && availability.label && !isRegistrationUnavailable && (
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                availability.color === 'red' && 'bg-red-100 text-red-700',
                availability.color === 'yellow' && 'bg-amber-100 text-amber-700',
                availability.color === 'green' && 'bg-green-100 text-green-700',
                availability.color === 'gray' && 'bg-gray-100 text-gray-600'
              )}>
                {availability.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
            {(session.startDate || session.endDate) && (
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-gray-400" />
                {formatDateRange(session.startDate || '', session.endDate || '')}
              </span>
            )}
            {facilityName && (
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-gray-400" />
                {facilityName}
              </span>
            )}
            <Link 
              href={scheduleLink}
              className="flex items-center gap-1 font-medium hover:opacity-80"
              style={{ color: secondaryColor }}
            >
              <Clock size={12} />
              View Schedule
            </Link>
            {config.features.showPricing && products.length > 0 && (
              <button
                onClick={() => setShowPricing(!showPricing)}
                className="flex items-center gap-1 font-medium hover:opacity-80"
                style={{ color: secondaryColor }}
              >
                <DollarSign size={12} />
                {showPricing ? 'Hide' : 'View'} Pricing
              </button>
            )}
          </div>
        </div>
        
        {/* Price + Register Button in Header */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Show price inline when single product */}
          {config.features.showPricing && singleProduct && singleProductPrice !== undefined && (
            <span className="text-sm font-bold text-gray-900">
              {formatPrice(singleProductPrice)}
            </span>
          )}
          
          {registrationLink && (
            <a
              href={registrationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: isRegistrationUnavailable ? '#9CA3AF' : secondaryColor }}
            >
              {isRegistrationUnavailable ? 'Learn More' : 'Register'} <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Products/Pricing Carousel - Show when toggled via "View Pricing" button */}
      {config.features.showPricing && showPricing && products.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              <DollarSign size={12} />
              {products.length} pricing option{products.length !== 1 ? 's' : ''}
            </p>
          </div>
          <PricingCarousel 
            products={products}
            baseRegistrationUrl={baseLink}
            config={config}
          />
        </div>
      )}
    </div>
  );
}

// Product card component
function ProductCard({ 
  product, 
  isMember = false,
  registrationUrl 
}: { 
  product: Product; 
  isMember?: boolean;
  registrationUrl?: string;
}) {
  const lowestPrice = product.prices.reduce(
    (min, p) => (p.price < min ? p.price : min),
    product.prices[0]?.price ?? 0
  );

  return (
    <div className={cn(
      'p-3 rounded-lg',
      isMember ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className={cn(
            'font-semibold text-sm',
            isMember ? 'text-amber-800' : 'text-gray-900'
          )}>
            {product.name}
          </span>
          {product.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={cn(
            'font-bold text-lg whitespace-nowrap',
            isMember ? 'text-amber-600' : 'text-gray-900',
            lowestPrice === 0 && 'text-green-600'
          )}>
            {formatPrice(lowestPrice)}
          </span>
          {registrationUrl && (
            <a
              href={registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1',
                isMember 
                  ? 'bg-amber-600 text-white hover:bg-amber-700' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              )}
            >
              Select <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
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

interface PricingInfo {
  hasPrice: boolean;
  regularPrice?: number;
  memberPrice?: number;
  hasMemberPricing: boolean;
}

function getPricingInfo(sessions: Session[]): PricingInfo {
  let regularPrice: number | undefined;
  let memberPrice: number | undefined;
  let hasMemberPricing = false;

  sessions.forEach(session => {
    (session.products || []).forEach(product => {
      const isMember = product.isMemberProduct;
      
      product.prices.forEach(price => {
        const priceValue = price.price ?? price.amount ?? 0;
        
        if (isMember) {
          hasMemberPricing = true;
          if (memberPrice === undefined || priceValue < memberPrice) {
            memberPrice = priceValue;
          }
        } else {
          if (regularPrice === undefined || priceValue < regularPrice) {
            regularPrice = priceValue;
          }
        }
      });
    });
  });

  return {
    hasPrice: regularPrice !== undefined || memberPrice !== undefined,
    regularPrice,
    memberPrice,
    hasMemberPricing,
  };
}
