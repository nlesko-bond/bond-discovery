'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star, ExternalLink } from 'lucide-react';
import { Product, DiscoveryConfig } from '@/types';
import { formatPrice, buildRegistrationUrl, cn } from '@/lib/utils';

interface PricingCarouselProps {
  products: Product[];
  baseRegistrationUrl?: string;
  className?: string;
  config?: DiscoveryConfig;
  isRegistrationOpen?: boolean;
}

/**
 * PricingCarousel Component
 * 
 * A horizontally scrolling carousel of pricing options with snap behavior.
 * - Mobile: 1 card visible, swipe to navigate
 * - Tablet: 2-3 cards visible
 * - Desktop: 3-4 cards visible with navigation arrows
 */
export function PricingCarousel({ 
  products, 
  baseRegistrationUrl, 
  className,
  config,
  isRegistrationOpen = true
}: PricingCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Get brand colors
  const primaryColor = config?.branding?.primaryColor || '#1E2761';
  const secondaryColor = config?.branding?.secondaryColor || '#6366F1';

  // Separate member and regular products
  const regularProducts = products.filter(p => !p.isMemberProduct);
  const memberProducts = products.filter(p => p.isMemberProduct);
  const allProducts = [...regularProducts, ...memberProducts];

  // Check scroll position to show/hide arrows
  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    // Calculate active index based on scroll position
    const cardWidth = scrollRef.current.children[0]?.clientWidth || 200;
    const index = Math.round(scrollLeft / (cardWidth + 12));
    setActiveIndex(Math.min(index, allProducts.length - 1));
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    ref?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      ref?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [allProducts.length]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.children[0]?.clientWidth || 200;
    const scrollAmount = direction === 'left' ? -cardWidth - 12 : cardWidth + 12;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (allProducts.length === 0) {
    return null;
  }

  return (
    <div className={cn('relative group', className)}>
      {/* Navigation Arrows - Desktop Only */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 bg-white shadow-lg rounded-full items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-xl transition-all opacity-0 group-hover:opacity-100"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 bg-white shadow-lg rounded-full items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-xl transition-all opacity-0 group-hover:opacity-100"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Carousel Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {allProducts.map((product, index) => (
          <PricingCard
            key={product.id}
            product={product}
            registrationUrl={buildRegistrationUrl(baseRegistrationUrl, { productId: product.id, isRegistrationOpen })}
            isFirstMember={index === regularProducts.length && memberProducts.length > 0}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
        ))}
      </div>

      {/* Dot Indicators - Mobile Only */}
      {allProducts.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3 md:hidden">
          {allProducts.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (!scrollRef.current) return;
                const cardWidth = scrollRef.current.children[0]?.clientWidth || 200;
                scrollRef.current.scrollTo({
                  left: index * (cardWidth + 12),
                  behavior: 'smooth',
                });
              }}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                backgroundColor: index === activeIndex ? secondaryColor : '#D1D5DB',
                width: index === activeIndex ? '1rem' : '0.5rem',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual Pricing Card
function PricingCard({
  product,
  registrationUrl,
  isFirstMember,
  primaryColor,
  secondaryColor,
}: {
  product: Product;
  registrationUrl?: string;
  isFirstMember?: boolean;
  primaryColor: string;
  secondaryColor: string;
}) {
  const lowestPrice = product.prices.reduce(
    (min, p) => (p.price < min ? p.price : min),
    product.prices[0]?.price ?? 0
  );
  
  const isMember = product.isMemberProduct;
  const isFree = lowestPrice === 0;

  // Calculate potential savings - show badge for values over 0
  const savingsPercent = product.prices.length > 1 
    ? Math.round(((product.prices[0]?.price || 0) - lowestPrice) / (product.prices[0]?.price || 1) * 100)
    : null;

  return (
    <div
      className={cn(
        'flex-shrink-0 w-[160px] sm:w-[180px] snap-start p-4 rounded-xl border-2 transition-all flex flex-col',
        isMember
          ? 'bg-gradient-to-b from-amber-50 to-white border-amber-200'
          : 'bg-white border-gray-200 hover:shadow-md'
      )}
      style={{
        borderColor: isMember ? undefined : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isMember) {
          e.currentTarget.style.borderColor = `${secondaryColor}40`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isMember) {
          e.currentTarget.style.borderColor = '#E5E7EB';
        }
      }}
    >
      {/* Member Badge */}
      {isMember && (
        <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 mb-2">
          <Star size={12} fill="currentColor" />
          Member Pricing
        </div>
      )}

      {/* Product Name */}
      <h4 className={cn(
        'font-bold text-sm line-clamp-2 min-h-[40px]',
        isMember ? 'text-amber-900' : 'text-gray-900'
      )}>
        {product.name}
      </h4>

      {/* Price */}
      <div className="mt-auto pt-3">
        <span className={cn(
          'text-2xl font-black',
          isFree && 'text-green-600',
          isMember && !isFree && 'text-amber-600',
          !isMember && !isFree && 'text-gray-900'
        )}>
          {formatPrice(lowestPrice)}
        </span>
        
        {/* Savings Badge */}
        {savingsPercent && savingsPercent > 0 && (
          <span className="ml-2 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            Save {savingsPercent}%
          </span>
        )}
      </div>

      {/* Register Button */}
      {registrationUrl && (
        <a
          href={registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-opacity text-white hover:opacity-90"
          style={{
            background: isMember 
              ? '#D97706' 
              : `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
          }}
        >
          Select <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

export default PricingCarousel;
