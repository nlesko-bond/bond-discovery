'use client';

import type { TvMonitorTickerBlock } from '@/types/tvmonitor';

/**
 * Bottom scrolling text bar — plain text updates/announcements, distinct
 * from the image/video ad banners. A pure CSS marquee (content rendered
 * twice + a translateX keyframe) is enough here since it only ever scrolls
 * one direction; unlike the schedule columns it never needs to pause, wrap
 * mid-viewport, or sync across peers, so the JS seamless-loop engine used
 * there would be overkill.
 */
export default function TvMonitorTicker({ settings }: { settings: TvMonitorTickerBlock }) {
  if (!settings.enabled || settings.messages.length === 0) return null;

  const text = settings.messages.join('     •     ');
  // Duration scales with message length so longer text doesn't whip by;
  // scrollSpeed (1 slow – 5 fast) shortens it.
  const durationSeconds = Math.max(8, text.length / (settings.scrollSpeed * 2.5));

  return (
    <div
      className="flex shrink-0 items-stretch overflow-hidden border-t"
      style={{ borderColor: 'var(--tv-card-border)', background: 'var(--tv-card-bg)' }}
    >
      {settings.label && (
        <div
          className="flex shrink-0 items-center whitespace-nowrap px-5 py-3 text-lg font-bold uppercase tracking-wider"
          style={{ background: 'var(--tv-accent)', color: 'var(--tv-bg1)' }}
        >
          {settings.label}
        </div>
      )}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <style>{`
          @keyframes tvTickerScroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>
        <div
          className="flex w-max items-center whitespace-nowrap py-3 text-lg font-medium"
          style={{ animation: `tvTickerScroll ${durationSeconds}s linear infinite` }}
        >
          {/* Rendered twice, back to back: translating by exactly -50% of the
              combined width loops seamlessly since both halves are identical. */}
          <span className="pr-16">{text}</span>
          <span className="pr-16" aria-hidden="true">
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}
