import { getSupabaseAdmin } from '@/lib/supabase';

export type OnboardingNotifyState = {
  preKickoffCompleteSentAt?: string;
  stall5SentAt?: string;
  stall7SentAt?: string;
};

export function parseOnboardingNotifyState(raw: unknown): OnboardingNotifyState {
  if (!raw || typeof raw !== 'object') return {};
  return raw as OnboardingNotifyState;
}

export async function mergeOnboardingNotifyState(
  orgId: string,
  patch: Partial<OnboardingNotifyState>,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from('orgs')
    .select('onboarding_notify_state')
    .eq('id', orgId)
    .maybeSingle();
  const prev = parseOnboardingNotifyState(row?.onboarding_notify_state);
  await admin
    .from('orgs')
    .update({ onboarding_notify_state: { ...prev, ...patch } })
    .eq('id', orgId);
}
