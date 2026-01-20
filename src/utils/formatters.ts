import { format, parseISO, isFuture, isToday, parse } from 'date-fns';
import { DiscoveryFilters } from '../types/bond';

export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100); // Assuming amount is in cents
}

export function formatDate(date: string): string {
  try {
    const parsed = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(parsed, 'MMM d, yyyy');
  } catch {
    return date;
  }
}

export function formatTime(time: string): string {
  if (!time) return '';
  try {
    const parsed = parse(time, 'HH:mm:ss', new Date());
    return format(parsed, 'h:mm a');
  } catch {
    return time;
  }
}

export function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'MMM d, yyyy');
    }
    
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  } catch {
    return `${startDate} - ${endDate}`;
  }
}

export function parseUrlParams(): DiscoveryFilters & { org_ids?: string; show_filters?: string; view_mode?: string } {
  const params = new URLSearchParams(window.location.search);
  
  return {
    org_ids: params.get('org_ids') || '516_512_513_519_518_521_514_515_510_520_522_511',
    facility_ids: params.get('facility_ids')?.split('_') || [],
    program_types: params.get('program_types')?.split(',') || [],
    sports: params.get('sports')?.split(',') || [],
    program_name: params.get('program_name') || '',
    start_date: params.get('start_date') || '',
    end_date: params.get('end_date') || '',
    show_filters: params.get('show_filters') || 'facility,program_type,date_range,activity',
    view_mode: params.get('view_mode') || 'discovery',
  };
}

export function buildUrlWithParams(filters: Record<string, any>): string {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    
    if (Array.isArray(value)) {
      params.set(key, value.join('_'));
    } else {
      params.set(key, String(value));
    }
  });
  
  return `?${params.toString()}`;
}

export function getOrgIds(orgIdString: string): string[] {
  return orgIdString.split('_').filter(Boolean);
}

export function getProgramTypeLabel(type?: string): string {
  const labels: Record<string, string> = {
    'class': 'Class',
    'clinic': 'Clinic',
    'camp': 'Camp',
    'lesson': 'Lesson',
    'club_team': 'Club Team',
    'league': 'League',
    'tournament': 'Tournament',
  };
  return labels[type || ''] || type || 'Program';
}

export function getSportLabel(sport?: string): string {
  return sport ? sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase() : 'Sports';
}

export function getAvailabilityColor(capacity?: number, current?: number): string {
  if (!capacity || !current) return 'bg-gray-200';
  
  const percentage = (current / capacity) * 100;
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function getAgeRange(ageMin?: number, ageMax?: number): string {
  if (!ageMin && !ageMax) return '';
  if (ageMin && ageMax) return `${ageMin}-${ageMax} years`;
  if (ageMin) return `${ageMin}+ years`;
  if (ageMax) return `Up to ${ageMax} years`;
  return '';
}
