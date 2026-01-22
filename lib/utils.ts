import { format, parseISO, parse, isValid } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { ProgramType, Gender } from '@/types';

/**
 * Merge class names with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format price in DOLLARS to currency string
 * Note: Bond API returns prices in dollars, not cents!
 */
export function formatPrice(amountInDollars: number, currency = 'USD'): string {
  if (amountInDollars === 0) {
    return 'FREE';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountInDollars);
}

/**
 * Format date string
 */
export function formatDate(dateStr: string, formatStr = 'MMM d, yyyy'): string {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, formatStr);
  } catch {
    return dateStr;
  }
}

/**
 * Format time string (ISO date, HH:mm:ss, or HH:mm to h:mm a)
 */
export function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  
  try {
    // Try ISO date format first (2026-01-18T00:00:00.000Z)
    if (timeStr.includes('T')) {
      const parsed = parseISO(timeStr);
      if (isValid(parsed)) {
        return format(parsed, 'h:mm a');
      }
    }
    
    // Try HH:mm:ss format
    let parsed = parse(timeStr, 'HH:mm:ss', new Date());
    if (isValid(parsed)) {
      return format(parsed, 'h:mm a');
    }
    
    // Try HH:mm format
    parsed = parse(timeStr, 'HH:mm', new Date());
    if (isValid(parsed)) {
      return format(parsed, 'h:mm a');
    }
    
    return timeStr;
  } catch {
    return timeStr;
  }
}

/**
 * Format date range
 */
export function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    if (!isValid(start) || !isValid(end)) {
      return `${startDate} - ${endDate}`;
    }
    
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'MMM d, yyyy');
    }
    
    if (format(start, 'yyyy') === format(end, 'yyyy')) {
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    
    return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
  } catch {
    return `${startDate} - ${endDate}`;
  }
}

/**
 * Format age range
 */
export function formatAgeRange(min?: number, max?: number): string {
  if (!min && !max) return '';
  // Treat unreasonably high max ages (100+) as "no max"
  const effectiveMax = max && max < 100 ? max : undefined;
  if (min && effectiveMax) return `Ages ${min}-${effectiveMax}`;
  if (min) return `Ages ${min}+`;
  if (effectiveMax) return `Ages up to ${effectiveMax}`;
  return '';
}

/**
 * Get program type label
 */
export function getProgramTypeLabel(type?: ProgramType | string): string {
  const labels: Record<string, string> = {
    class: 'Class',
    clinic: 'Clinic',
    camp: 'Camp',
    lesson: 'Lesson',
    league: 'League',
    tournament: 'Tournament',
    club_team: 'Club Team',
    drop_in: 'Drop-In',
    rental: 'Rental',
  };
  return labels[type || ''] || type || 'Program';
}

/**
 * Get sport label (capitalize)
 */
export function getSportLabel(sport?: string): string {
  if (!sport) return '';
  return sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();
}

/**
 * Get gender label
 */
export function getGenderLabel(gender?: Gender | string): string {
  const labels: Record<string, string> = {
    all: 'All Genders',
    male: 'Boys/Men',
    female: 'Girls/Women',
    coed: 'Coed',
  };
  return labels[gender || 'all'] || 'All Genders';
}

/**
 * Get availability label and color
 */
export function getAvailabilityInfo(
  spotsRemaining?: number, 
  capacity?: number
): { label: string; color: 'green' | 'yellow' | 'red' | 'gray' } {
  if (spotsRemaining === undefined || capacity === undefined) {
    return { label: '', color: 'gray' };
  }
  
  if (spotsRemaining <= 0) {
    return { label: 'Full', color: 'red' };
  }
  
  const percentFull = ((capacity - spotsRemaining) / capacity) * 100;
  
  if (percentFull >= 90) {
    return { label: `${spotsRemaining} spot${spotsRemaining === 1 ? '' : 's'} left`, color: 'red' };
  }
  
  if (percentFull >= 70) {
    return { label: `${spotsRemaining} spot${spotsRemaining === 1 ? '' : 's'} left`, color: 'yellow' };
  }
  
  return { label: 'Available', color: 'green' };
}

/**
 * Get sport gradient class
 */
export function getSportGradient(sport?: string): string {
  const gradients: Record<string, string> = {
    soccer: 'gradient-soccer',
    football: 'gradient-default',
    basketball: 'gradient-basketball',
    tennis: 'gradient-tennis',
    yoga: 'gradient-yoga',
    fitness: 'gradient-fitness',
    swimming: 'gradient-swimming',
  };
  return gradients[sport?.toLowerCase() || ''] || 'gradient-default';
}

/**
 * Parse organization IDs from string (underscore or comma separated)
 */
export function parseOrgIds(orgIdString?: string): string[] {
  if (!orgIdString) return [];
  return orgIdString.split(/[_,]/).filter(Boolean);
}

/**
 * Build URL with search params
 */
export function buildUrl(base: string, params: Record<string, any>): string {
  const url = new URL(base, 'http://localhost');
  
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    
    if (Array.isArray(value)) {
      if (value.length > 0) {
        url.searchParams.set(key, value.join('_'));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  });
  
  return `${url.pathname}${url.search}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
