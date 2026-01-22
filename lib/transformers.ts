import { 
  Program, 
  Session, 
  Product, 
  Price, 
  SessionEvent, 
  CalendarEvent,
  DaySchedule,
  WeekSchedule
} from '@/types';
import { 
  format, 
  parseISO, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isToday, 
  isPast,
  addWeeks 
} from 'date-fns';

/**
 * Normalize API response to handle different data formats
 */
function normalizeArray<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * Transform raw API program to normalized Program type
 */
export function transformProgram(raw: any): Program {
  const sessions = normalizeArray<any>(raw.sessions).map(transformSession);
  
  return {
    id: String(raw.id),
    name: raw.name || '',
    description: stripHtml(raw.description),
    type: raw.type?.toLowerCase(),
    sport: raw.sport?.toLowerCase(),
    facilityId: raw.facility_id ? String(raw.facility_id) : undefined,
    facilityName: raw.facility?.name || raw.facility_name,
    organizationId: raw.organization_id ? String(raw.organization_id) : undefined,
    imageUrl: raw.image_url || raw.imageUrl,
    ageMin: raw.age_min || raw.ageMin,
    ageMax: raw.age_max || raw.ageMax,
    gender: normalizeGender(raw.gender),
    createdAt: raw.created_at || raw.createdAt,
    updatedAt: raw.updated_at || raw.updatedAt,
    sessions,
    facility: raw.facility ? {
      id: String(raw.facility.id),
      name: raw.facility.name,
      address: raw.facility.address,
      city: raw.facility.city,
      state: raw.facility.state,
      zipCode: raw.facility.zip_code,
      organizationId: String(raw.facility.organization_id),
    } : undefined,
  };
}

/**
 * Transform raw API session to normalized Session type
 */
export function transformSession(raw: any): Session {
  const products = normalizeArray<any>(raw.products).map(transformProduct);
  const events = normalizeArray<any>(raw.events).map(transformEvent);
  const segments = normalizeArray<any>(raw.segments).map(transformSegment);
  
  const capacity = raw.capacity || raw.max_participants;
  const currentEnrollment = raw.current_enrollment || raw.currentEnrollment || 0;
  const spotsRemaining = capacity ? Math.max(0, capacity - currentEnrollment) : undefined;
  
  return {
    id: String(raw.id),
    programId: String(raw.program_id || raw.programId),
    name: raw.name,
    description: stripHtml(raw.description),
    startDate: raw.start_date || raw.startDate,
    endDate: raw.end_date || raw.endDate,
    startTime: raw.start_time || raw.startTime,
    endTime: raw.end_time || raw.endTime,
    capacity,
    currentEnrollment,
    spotsRemaining,
    isFull: spotsRemaining !== undefined && spotsRemaining <= 0,
    waitlistEnabled: raw.waitlist_enabled || raw.waitlistEnabled,
    waitlistCount: raw.waitlist_count || raw.waitlistCount,
    status: raw.status,
    ageMin: raw.age_min || raw.ageMin,
    ageMax: raw.age_max || raw.ageMax,
    gender: normalizeGender(raw.gender),
    recurring: raw.recurring,
    recurrencePattern: raw.recurrence_pattern || raw.recurrencePattern,
    daysOfWeek: raw.days_of_week || raw.daysOfWeek,
    products,
    events,
    segments,
  };
}

/**
 * Transform raw API product to normalized Product type
 */
export function transformProduct(raw: any): Product {
  const prices = normalizeArray<any>(raw.prices).map(transformPrice);
  
  const maxParticipants = raw.max_participants || raw.maxParticipants;
  const currentParticipants = raw.current_participants || raw.currentParticipants || 0;
  
  return {
    id: String(raw.id),
    sessionId: String(raw.session_id || raw.sessionId),
    name: raw.name || '',
    description: stripHtml(raw.description),
    type: raw.type?.toLowerCase(),
    status: normalizeProductStatus(raw.status),
    registrationStartDate: raw.registration_start_date || raw.registrationStartDate,
    registrationEndDate: raw.registration_end_date || raw.registrationEndDate,
    earlyBirdEndDate: raw.early_bird_end_date || raw.earlyBirdEndDate,
    membershipRequired: raw.membership_required || raw.membershipRequired || raw.membership_gated || false,
    membershipIds: raw.membership_ids || raw.membershipIds,
    membershipDiscounts: normalizeArray<any>(raw.membership_discounts || raw.membershipDiscounts).map(d => ({
      membershipId: String(d.membership_id || d.membershipId),
      membershipName: d.membership_name || d.membershipName,
      discountType: d.discount_type || d.discountType || 'percentage',
      discountValue: d.discount_value || d.discountValue || d.discount || 0,
      finalPrice: d.final_price || d.finalPrice,
    })),
    maxParticipants,
    currentParticipants,
    spotsRemaining: maxParticipants ? Math.max(0, maxParticipants - currentParticipants) : undefined,
    prices,
  };
}

/**
 * Transform raw API price to normalized Price type
 */
export function transformPrice(raw: any): Price {
  return {
    id: String(raw.id),
    productId: String(raw.product_id || raw.productId),
    amount: raw.amount || 0,
    currency: raw.currency || 'USD',
    name: raw.name,
    description: raw.description,
    ageGroup: raw.age_group || raw.ageGroup,
    ageMin: raw.age_min || raw.ageMin,
    ageMax: raw.age_max || raw.ageMax,
    originalAmount: raw.original_amount || raw.originalAmount,
    discountAmount: raw.discount_amount || raw.discountAmount,
    discountPercent: raw.discount_percent || raw.discountPercent,
    validFrom: raw.valid_from || raw.validFrom,
    validUntil: raw.valid_until || raw.validUntil,
  };
}

/**
 * Transform raw API event to normalized SessionEvent type
 */
export function transformEvent(raw: any): SessionEvent {
  const maxParticipants = raw.max_participants || raw.maxParticipants || raw.capacity;
  const currentParticipants = raw.current_participants || raw.currentParticipants || raw.current_enrollment || 0;
  
  return {
    id: String(raw.id),
    sessionId: String(raw.session_id || raw.sessionId),
    segmentId: raw.segment_id || raw.segmentId ? String(raw.segment_id || raw.segmentId) : undefined,
    date: raw.date || raw.start_date || raw.startDate,
    startTime: raw.start_time || raw.startTime,
    endTime: raw.end_time || raw.endTime,
    facilityId: raw.facility_id || raw.facilityId ? String(raw.facility_id || raw.facilityId) : undefined,
    facilityName: raw.facility_name || raw.facilityName || raw.facility?.name,
    location: raw.location || raw.room || raw.field,
    name: raw.name,
    description: stripHtml(raw.description),
    instructor: raw.instructor || raw.instructor_name || raw.instructorName,
    maxParticipants,
    currentParticipants,
    spotsRemaining: maxParticipants ? Math.max(0, maxParticipants - currentParticipants) : undefined,
    status: raw.status || 'scheduled',
  };
}

/**
 * Transform raw API segment to normalized Segment type
 */
export function transformSegment(raw: any): any {
  return {
    id: String(raw.id),
    sessionId: String(raw.session_id || raw.sessionId),
    name: raw.name,
    startDate: raw.start_date || raw.startDate,
    endDate: raw.end_date || raw.endDate,
    events: normalizeArray<any>(raw.events).map(transformEvent),
  };
}

/**
 * Get sport color for calendar display
 */
export function getSportColor(sport?: string): string {
  const colors: Record<string, string> = {
    soccer: '#22c55e',
    football: '#a68d5e',
    basketball: '#f97316',
    tennis: '#eab308',
    yoga: '#8b5cf6',
    fitness: '#3b82f6',
    swimming: '#06b6d4',
    baseball: '#dc2626',
    volleyball: '#ec4899',
    hockey: '#64748b',
  };
  return colors[sport?.toLowerCase() || ''] || '#c4ad7d';
}

/**
 * Convert programs to calendar events for schedule view
 */
export function programsToCalendarEvents(programs: Program[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  programs.forEach(program => {
    (program.sessions || []).forEach(session => {
      // Get events from session
      (session.events || []).forEach(event => {
        if (!event.date) return;
        
        const lowestPrice = getLowestPrice(session.products || []);
        const memberPrice = getMemberPrice(session.products || []);
        
        events.push({
          id: `${program.id}-${session.id}-${event.id}`,
          programId: program.id,
          programName: program.name,
          sessionId: session.id,
          sessionName: session.name || program.name,
          date: event.date,
          startTime: event.startTime || session.startTime || '',
          endTime: event.endTime || session.endTime || '',
          facilityId: event.facilityId || program.facilityId || '',
          facilityName: event.facilityName || program.facilityName || '',
          location: event.location,
          maxParticipants: event.maxParticipants || session.capacity,
          currentParticipants: event.currentParticipants || session.currentEnrollment,
          spotsRemaining: event.spotsRemaining || session.spotsRemaining,
          sport: program.sport,
          programType: program.type,
          color: getSportColor(program.sport),
          startingPrice: lowestPrice,
          memberPrice: memberPrice,
          membershipRequired: hasAnyMembershipRequired(session.products || []),
        });
      });
      
      // If no events but has dates, create event from session dates
      if ((!session.events || session.events.length === 0) && session.startDate) {
        const lowestPrice = getLowestPrice(session.products || []);
        const memberPrice = getMemberPrice(session.products || []);
        
        events.push({
          id: `${program.id}-${session.id}`,
          programId: program.id,
          programName: program.name,
          sessionId: session.id,
          sessionName: session.name || program.name,
          date: session.startDate,
          startTime: session.startTime || '',
          endTime: session.endTime || '',
          facilityId: program.facilityId || '',
          facilityName: program.facilityName || '',
          location: undefined,
          maxParticipants: session.capacity,
          currentParticipants: session.currentEnrollment,
          spotsRemaining: session.spotsRemaining,
          sport: program.sport,
          programType: program.type,
          color: getSportColor(program.sport),
          startingPrice: lowestPrice,
          memberPrice: memberPrice,
          membershipRequired: hasAnyMembershipRequired(session.products || []),
        });
      }
    });
  });
  
  return events;
}

/**
 * Build week schedule from calendar events
 */
export function buildWeekSchedules(events: CalendarEvent[], weeksToShow: number = 4): WeekSchedule[] {
  const today = new Date();
  const weeks: WeekSchedule[] = [];
  
  for (let i = 0; i < weeksToShow; i++) {
    const weekDate = addWeeks(today, i);
    const weekStart = startOfWeek(weekDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(weekDate, { weekStartsOn: 0 });
    
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    const daySchedules: DaySchedule[] = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEvents = events
        .filter(event => event.date === dateStr)
        .sort((a, b) => {
          if (!a.startTime) return 1;
          if (!b.startTime) return -1;
          return a.startTime.localeCompare(b.startTime);
        });
      
      return {
        date: dateStr,
        dayOfWeek: format(day, 'EEE'),
        events: dayEvents,
        isToday: isToday(day),
        isPast: isPast(day) && !isToday(day),
      };
    });
    
    weeks.push({
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      days: daySchedules,
    });
  }
  
  return weeks;
}

// Helper functions

function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim() || undefined;
}

function normalizeGender(gender?: string): any {
  if (!gender) return 'all';
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm' || g === 'boys') return 'male';
  if (g === 'female' || g === 'f' || g === 'girls') return 'female';
  if (g === 'coed' || g === 'co-ed') return 'coed';
  return 'all';
}

function normalizeProductStatus(status?: string): any {
  if (!status) return 'active';
  const s = status.toLowerCase();
  if (s === 'active' || s === 'open') return 'active';
  if (s === 'inactive' || s === 'closed') return 'inactive';
  if (s === 'sold_out' || s === 'full') return 'sold_out';
  if (s === 'coming_soon' || s === 'upcoming') return 'coming_soon';
  return 'active';
}

function getLowestPrice(products: Product[]): number | undefined {
  let lowest: number | undefined;
  
  products.forEach(product => {
    if (product.status !== 'active') return;
    
    product.prices.forEach(price => {
      if (lowest === undefined || price.amount < lowest) {
        lowest = price.amount;
      }
    });
  });
  
  return lowest;
}

function getMemberPrice(products: Product[]): number | undefined {
  let memberPrice: number | undefined;
  
  products.forEach(product => {
    if (product.status !== 'active') return;
    if (!product.membershipDiscounts?.length) return;
    
    product.prices.forEach(price => {
      const discount = product.membershipDiscounts?.[0];
      if (discount) {
        let discountedPrice: number;
        if (discount.discountType === 'percentage') {
          discountedPrice = price.amount * (1 - discount.discountValue / 100);
        } else {
          discountedPrice = price.amount - discount.discountValue;
        }
        
        if (memberPrice === undefined || discountedPrice < memberPrice) {
          memberPrice = discountedPrice;
        }
      }
    });
  });
  
  return memberPrice;
}

function hasAnyMembershipRequired(products: Product[]): boolean {
  return products.some(p => p.membershipRequired);
}
