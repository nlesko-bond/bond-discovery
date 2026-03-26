'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * After a server-action redirect back to this page, Next can serve a stale RSC tree.
 * Force a client router refresh when we land with ?saved= or ?deleted= so the list updates.
 */
export function TemplatesSavedRefresh() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const saved = searchParams.get('saved');
    const deleted = searchParams.get('deleted');
    if (saved !== '1' && deleted !== '1') return;

    router.refresh();

    const t = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete('saved');
      url.searchParams.delete('deleted');
      const q = url.searchParams.toString();
      window.history.replaceState(null, '', `${url.pathname}${q ? `?${q}` : ''}`);
    }, 150);

    return () => window.clearTimeout(t);
  }, [router, searchParams]);

  return null;
}
