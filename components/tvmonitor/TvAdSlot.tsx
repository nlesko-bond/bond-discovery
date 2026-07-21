'use client';

import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { TvMonitorAdSlot } from '@/types/tvmonitor';

/**
 * A fixed ad placement: rotates through image/video assets on a timer.
 * Videos autoplay muted (TV context) and loop for their rotation window.
 * With no assets it renders a placeholder in the builder preview and
 * nothing at all on a live TV.
 */
export default function TvAdSlotView({
  slot,
  previewMode = false,
  headerMode = false,
}: {
  slot: TvMonitorAdSlot;
  previewMode?: boolean;
  /** In-header sponsor slot: media is height-fitted and never cropped (logos). */
  headerMode?: boolean;
}) {
  const assets = slot.assets;
  const [index, setIndex] = useState(0);
  const current = assets.length > 0 ? assets[index % assets.length] : null;

  useEffect(() => {
    setIndex(0);
  }, [slot.id, assets.length]);

  useEffect(() => {
    if (assets.length <= 1 || !current) return;
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % assets.length);
    }, current.durationSeconds * 1000);
    return () => clearTimeout(timer);
  }, [assets, index, current]);

  if (!current) {
    if (!previewMode) return null;
    return (
      <div
        className={`flex h-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed ${headerMode ? 'px-6' : 'w-full'}`}
        style={{ borderColor: 'var(--tv-card-border)', color: 'var(--tv-secondary)' }}
      >
        <ImageIcon size={headerMode ? 18 : 28} />
        <span className="px-2 text-center text-sm">{headerMode ? 'Sponsor' : 'Ad slot — add an image or video'}</span>
      </div>
    );
  }

  if (headerMode) {
    return (
      <div className="flex h-full items-center justify-center overflow-hidden">
        {current.type === 'video' ? (
          <video
            key={current.id}
            src={current.src}
            autoPlay
            muted
            loop
            playsInline
            className="tv-ad-fade h-full w-auto max-w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- sponsor media, remote by design
          <img key={current.id} src={current.src} alt="" className="tv-ad-fade h-full w-auto max-w-full object-contain" />
        )}
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: slot.backgroundColor === 'transparent' ? undefined : slot.backgroundColor }}
    >
      {current.type === 'video' ? (
        <video
          key={current.id}
          src={current.src}
          autoPlay
          muted
          loop
          playsInline
          className="tv-ad-fade h-full w-full"
          style={{ objectFit: current.fit }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- ad media is remote, unoptimized by design
        <img
          key={current.id}
          src={current.src}
          alt=""
          className="tv-ad-fade h-full w-full"
          style={{ objectFit: current.fit }}
        />
      )}
    </div>
  );
}
