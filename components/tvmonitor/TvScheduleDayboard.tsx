'use client';

import { useEffect, useState } from 'react';
import { renderDayboardHtml } from '@/lib/tvmonitor-dayboard-render';
import type { TvMonitorDesign, TvMonitorScheduleBlock, TvMonitorSpace } from '@/types/tvmonitor';

/**
 * The 'dayboard' view: a still board of the rest of today. It renders the
 * same HTML string as the zero-JS legacy page (lib/tvmonitor-dayboard-render.ts)
 * so both paths can't drift; all dynamic text in it is escaped at build time.
 *
 * The one-second tick moves the "Now" highlight, drops finished events and
 * flips pages on the wall-clock boundary shared by every TV. React skips the
 * DOM write whenever the string comes out unchanged, which is most ticks.
 */
export default function TvScheduleDayboard({
  spaces,
  settings,
  design,
}: {
  spaces: TvMonitorSpace[];
  settings: TvMonitorScheduleBlock;
  design: TvMonitorDesign;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Wait for the client clock: rendering with the server's clock would put
  // the wrong day on screen for a moment and trip a hydration mismatch.
  if (!now) return <div className="h-full" />;

  const { html } = renderDayboardHtml({ spaces, settings, design, now, epochMs: now.getTime() });
  return <div className="h-full" dangerouslySetInnerHTML={{ __html: html }} />;
}
