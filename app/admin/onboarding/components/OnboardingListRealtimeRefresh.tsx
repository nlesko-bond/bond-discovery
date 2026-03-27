'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOnboardingBrowserClient } from '@/lib/onboarding/supabase-browser';

/**
 * Refreshes server-rendered org lists when step_progress or orgs change anywhere.
 * Use on dashboard + organizations list so progress bars stay current without a hard refresh.
 *
 * Re-syncs the current URL (including query string) before `router.refresh()` so App Router
 * RSC payloads keep the same searchParams as the address bar (avoids filters appearing reset).
 */
export function OnboardingListRealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getOnboardingBrowserClient();

    const refresh = () => {
      if (typeof window !== 'undefined' && window.location.search) {
        const { pathname, search } = window.location;
        router.replace(`${pathname}${search}`);
      }
      router.refresh();
    };

    const channel = supabase
      .channel('onboarding_org_lists')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'step_progress' },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orgs' },
        refresh,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
