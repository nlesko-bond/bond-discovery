import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Records the first checklist activity timestamp once (step completion or CSV upload).
 */
export async function markOnboardingStartedIfNeeded(
  orgId: string,
  occurredAt: string = new Date().toISOString(),
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from('orgs')
    .select('onboarding_started_at')
    .eq('id', orgId)
    .maybeSingle();

  if (org?.onboarding_started_at) {
    return;
  }

  await admin.from('orgs').update({ onboarding_started_at: occurredAt }).eq('id', orgId);
}
