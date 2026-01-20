// Bond Sports API Types
export interface Program {
  id: string;
  name: string;
  description?: string;
  type?: string;
  sport?: string;
  facility_id?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  sessions?: Session[];
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
