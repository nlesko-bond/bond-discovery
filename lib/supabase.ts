import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://mxketdjzelojxjnzsjgd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14a2V0ZGp6ZWxvanhqbnpzamdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MTI4NDQsImV4cCI6MjA3NjI4ODg0NH0._zB2_IAm6R4oFSXgfJwUUrL8VOgt91hkmuHfKsG7_yc';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Public client with anon key - for read operations (browser + server)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service key - for privileged operations (lazy init to avoid build errors)
let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Supabase dashboard / Vercel integrations often set `SUPABASE_SERVICE_ROLE_KEY`.
 * This repo historically used `SUPABASE_SERVICE_KEY` — accept both so server reads
 * (e.g. form_pages) use the service role instead of falling back to anon + RLS.
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

/** Anon key for the same project as the server URL (Vercel often sets `SUPABASE_ANON_KEY`). */
function getSupabaseAnonKeyForServer(): string {
  return (
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    DEFAULT_SUPABASE_ANON_KEY
  );
}

/**
 * Server-side URL resolution. Prefer `SUPABASE_URL` (runtime, set by many Vercel setups);
 * then public URL. If both are missing but a service key exists, derive `https://<ref>.supabase.co`
 * from the JWT `ref` claim so the client always targets the same project as the key.
 */
export function getSupabaseUrlForServer(): string {
  const fromEnv =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (fromEnv) return fromEnv;

  const ref = parseProjectRefFromServiceJwt(getSupabaseServiceRoleKey());
  if (ref) return `https://${ref}.supabase.co`;

  return DEFAULT_SUPABASE_URL;
}

function parseProjectRefFromServiceJwt(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const parts = key.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { ref?: string };
    return typeof payload.ref === 'string' ? payload.ref : undefined;
  } catch {
    try {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson) as { ref?: string };
      return typeof payload.ref === 'string' ? payload.ref : undefined;
    } catch {
      return undefined;
    }
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = getSupabaseUrlForServer();
    const serviceKey = getSupabaseServiceRoleKey();
    if (!serviceKey) {
      console.warn(
        'SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY not available, falling back to anon client'
      );
      _supabaseAdmin = createClient(url, getSupabaseAnonKeyForServer());
    } else {
      _supabaseAdmin = createClient(url, serviceKey);
    }
  }
  return _supabaseAdmin;
}

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
    showTableView?: boolean;
    tableColumns?: string[];
  };
  allowed_params: string[];
  default_params: Record<string, string>;
  cache_ttl: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // GTM tracking
  gtm_id: string | null;
  // Joined from partner_groups
  partner_group?: {
    api_key: string | null;
    gtm_id: string | null;
  } | null;
}
