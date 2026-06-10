/**
 * Browser Supabase client for realtime + public reads (anon key).
 * Reuses the shared Discovery app client.
 */
import { getSupabasePublic } from '@/lib/supabase';

export function getOnboardingBrowserClient() {
  return getSupabasePublic();
}
