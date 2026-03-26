'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOnboardingBrowserClient } from '@/lib/onboarding/supabase-browser';

export function OrgRealtimeRefresh({ orgId }: { orgId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getOnboardingBrowserClient();
    const channel = supabase
      .channel(`admin_org_progress:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'step_progress',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  return null;
}
