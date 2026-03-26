/**
 * Browser Supabase client for realtime + public reads (anon key).
 * Reuses the shared Discovery app client.
 */
import { supabase } from '@/lib/supabase';

export function getOnboardingBrowserClient() {
  return supabase;
}
