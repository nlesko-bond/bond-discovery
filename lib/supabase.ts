import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxketdjzelojxjnzsjgd.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14a2V0ZGp6ZWxvanhqbnpzamdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MTI4NDQsImV4cCI6MjA3NjI4ODg0NH0._zB2_IAm6R4oFSXgfJwUUrL8VOgt91hkmuHfKsG7_yc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface DiscoveryPageRow {
  id: string;
  slug: string;
  name: string;
  organization_ids: number[];
  facility_ids: number[];
  api_key: string | null;
  partner_group_id: string | null;
  branding: {
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    logo?: string;
    tagline?: string;
    fontFamily?: string;
  };
  features: {
    showPricing: boolean;
    showAvailability: boolean;
    showMembershipBadges: boolean;
    showAgeGender: boolean;
    enableFilters: string[];
    defaultView: 'programs' | 'schedule';
    allowViewToggle: boolean;
  };
  allowed_params: string[];
  default_params: Record<string, string>;
  cache_ttl: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined from partner_groups
  partner_group?: {
    api_key: string | null;
  } | null;
}
