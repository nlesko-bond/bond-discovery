'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOnboardingBrowserClient } from '@/lib/onboarding/supabase-browser';

/**
 * Refreshes server-rendered org lists when step_progress or orgs change anywhere.
 * Use on dashboard + organizations list so progress bars stay current without a hard refresh.
 */
export function OnboardingListRealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getOnboardingBrowserClient();
    const channel = supabase
      .channel('onboarding_org_lists')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'step_progress' },
        () => {
          router.refresh();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orgs' },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
