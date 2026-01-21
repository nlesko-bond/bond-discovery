// Bond Sports API Types
export interface Program {
  id: string;
  name: string;
  description?: string;
  type?: string;
  sport?: string;
  facility_id?: string;
  facility_name?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  sessions?: Session[];
  // Computed fields for display
  org_id?: string;
}

export interface Session {
  id: string;
  program_id: string;
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  capacity?: number;
  current_enrollment?: number;
  status?: string;
  recurring?: boolean;
  recurrence_pattern?: string;
  products?: Product[];
  segments?: Segment[];
  events?: Event[];
  // Computed fields
  spots_remaining?: number;
  is_full?: boolean;
}

export interface Product {
  id: string;
  session_id: string;
  name: string;
  description?: string;
  type?: string;
  prices?: Price[];
}

export interface Price {
  id: string;
  product_id: string;
  amount: number;
  currency: string;
  age_group?: string;
  discount?: number;
}

export interface Segment {
  id: string;
  session_id: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  events?: Event[];
}

export interface Event {
  id: string;
  name?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  facility_id?: string;
}

export interface APIResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      total: number;
      per_page: number;
      current_page: number;
      last_page: number;
    };
  };
}

export interface DiscoveryFilters {
  facility_ids?: string[];
  program_types?: string[];
  sports?: string[];
  start_date?: string;
  end_date?: string;
  program_name?: string;
}

// View mode types
export type ViewMode = 'programs' | 'schedule';

// Schedule view types - for calendar/timeline display
export interface ScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  time_start?: string;
  time_end?: string;
  program: Program;
  session: Session;
  type: 'session_start' | 'session_ongoing' | 'event';
  spots_remaining?: number;
  is_full: boolean;
}

export interface DaySchedule {
  date: string;
  dayOfWeek: string;
  items: ScheduleItem[];
  isToday: boolean;
  isPast: boolean;
}

export interface WeekSchedule {
  weekStart: string;
  weekEnd: string;
  days: DaySchedule[];
}

// URL params extended
export interface UrlParams extends DiscoveryFilters {
  org_ids?: string;
  show_filters?: string;
  view_mode?: ViewMode;
}
