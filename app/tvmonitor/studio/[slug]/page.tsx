'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import StudioShell from '@/components/tvmonitor/studio/StudioShell';
import MonitorEditor from '@/components/tvmonitor/studio/MonitorEditor';
import type { ITvMonitorPage } from '@/types/tvmonitor';

function StudioEditor() {
  const params = useParams<{ slug: string }>();
  const [page, setPage] = useState<ITvMonitorPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/tvmonitor/studio/pages/${params.slug}`, { cache: 'no-store' });
      const data = await res.json();
      if (cancelled) return;
      if (res.ok) setPage(data.page);
      else setError(data.error || 'Failed to load page');
    })();
    return () => {
      cancelled = true;
    };
  }, [params.slug]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!page) return <div className="h-96 animate-pulse rounded-xl bg-gray-200" />;
  return <MonitorEditor page={page} apiBase="/api/tvmonitor/studio/pages" backHref="/tvmonitor/studio" />;
}

export default function TvMonitorStudioEditorPage() {
  return (
    <Suspense>
      <StudioShell>{() => <StudioEditor />}</StudioShell>
    </Suspense>
  );
}
