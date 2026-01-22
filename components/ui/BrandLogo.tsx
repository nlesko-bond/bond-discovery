'use client';

import { DiscoveryConfig } from '@/types';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  config: DiscoveryConfig;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * BrandLogo Component
 * 
 * Renders a configurable brand logo with two parts:
 * - Brand name (e.g., "TOCA") in primary color
 * - Brand suffix (e.g., "Soccer") in secondary color or lighter weight
 * 
 * Style inspired by TOCA's logo: bold, wide-tracking uppercase typography
 */
export function BrandLogo({ config, size = 'md', className }: BrandLogoProps) {
  const { branding } = config;
  
  // Size mappings
  const sizeClasses = {
    sm: {
      name: 'text-xl',
      suffix: 'text-lg',
      tracking: 'tracking-wide',
    },
    md: {
      name: 'text-2xl',
      suffix: 'text-xl',
      tracking: 'tracking-wider',
    },
    lg: {
      name: 'text-4xl',
      suffix: 'text-3xl',
      tracking: 'tracking-widest',
    },
  };

  const sizes = sizeClasses[size];
  
  // Extract brand name and suffix from company name
  // e.g., "TOCA Soccer" -> name: "TOCA", suffix: "Soccer"
  const parts = (branding.companyName || 'Bond Sports').split(' ');
  const brandName = parts[0] || 'Bond';
  const brandSuffix = parts.slice(1).join(' ') || '';

  // If logo image is provided and not using text style, show image
  if (branding.logo) {
    return (
      <img 
        src={branding.logo} 
        alt={branding.companyName}
        className={cn(
          'h-8 md:h-10 w-auto object-contain',
          className
        )}
      />
    );
  }

  // CSS-based text logo
  return (
    <div 
      className={cn(
        'flex items-baseline gap-1.5 font-extrabold uppercase',
        sizes.tracking,
        className
      )}
      style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}
    >
      {/* Primary brand name */}
      <span 
        className={cn(sizes.name, 'font-black')}
        style={{ 
          color: branding.primaryColor,
          letterSpacing: '0.1em',
        }}
      >
        {brandName}
      </span>
      
      {/* Brand suffix */}
      {brandSuffix && (
        <span 
          className={cn(sizes.suffix, 'font-semibold')}
          style={{ 
            color: branding.secondaryColor || '#374151',
          }}
        >
          {brandSuffix}
        </span>
      )}
    </div>
  );
}

/**
 * Compact brand logo for mobile headers
 */
export function BrandLogoCompact({ config, className }: { config: DiscoveryConfig; className?: string }) {
  const { branding } = config;
  
  // Extract just the first part for compact display
  const brandName = (branding.companyName || 'Bond').split(' ')[0];
  
  if (branding.logo) {
    return (
      <img 
        src={branding.logo} 
        alt={branding.companyName}
        className={cn('h-6 w-auto object-contain', className)}
      />
    );
  }

  return (
    <span 
      className={cn(
        'text-lg font-black uppercase tracking-wider',
        className
      )}
      style={{ 
        color: branding.primaryColor,
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {brandName}
    </span>
  );
}

export default BrandLogo;
