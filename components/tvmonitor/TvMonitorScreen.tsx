'use client';

import { useEffect, useMemo, useState } from 'react';
import TvAdSlotView from '@/components/tvmonitor/TvAdSlot';
import TvScheduleGrid from '@/components/tvmonitor/TvScheduleGrid';
import type { TvMonitorAdSlot, TvMonitorConfig, TvMonitorSchedulePayload } from '@/types/tvmonitor';

function qrSrc(url: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
}

function adSlotSize(slot: TvMonitorAdSlot): string {
  return slot.sizeMode === 'ratio' ? `${slot.sizePercent}%` : `${slot.sizePx}px`;
}

const RATIO_VALUES: Record<string, number | undefined> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '21:9': 21 / 9,
  '9:16': 9 / 16,
  fill: undefined,
};

function TvClock({
  showClock,
  showDate,
  compact,
  align = 'end',
}: {
  showClock: boolean;
  showDate: boolean;
  compact: boolean;
  align?: 'end' | 'center';
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!showClock && !showDate) return null;
  return (
    <div className={`flex flex-col ${align === 'center' ? 'items-center' : 'items-end'}`}>
      {showClock && (
        <div
          className={`${compact ? 'text-4xl' : 'text-5xl'} font-bold tabular-nums leading-none`}
          style={align === 'center' ? { color: 'var(--tv-accent)' } : undefined}
        >
          {now
            ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
            : '--:--'}
        </div>
      )}
      {showDate && (
        <div
          className={`mt-1 uppercase tracking-widest ${compact ? 'text-xs' : 'text-sm'} ${align === 'center' ? 'italic font-semibold' : ''}`}
          style={{ color: align === 'center' ? 'var(--tv-font-color)' : 'var(--tv-secondary)' }}
        >
          {now ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
        </div>
      )}
    </div>
  );
}

function TvQr({ url, label, compact }: { url: string; label: string; compact: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated QR, remote by design */}
      <img src={qrSrc(url)} alt={label} className={`${compact ? 'h-14 w-14' : 'h-20 w-20'} rounded-md bg-white p-1`} />
      <span className="max-w-[7rem] text-center text-xs leading-tight" style={{ color: 'var(--tv-secondary)' }}>
        {label}
      </span>
    </div>
  );
}

/**
 * Pure presentational TV screen: given a config + schedule payload it renders
 * the block layout (top/bottom banners, side rails, header, schedule grid).
 * Used by the live display page and, with previewMode, by the builder.
 */
export default function TvMonitorScreen({
  config,
  schedule,
  previewMode = false,
}: {
  config: TvMonitorConfig;
  schedule: TvMonitorSchedulePayload | null;
  previewMode?: boolean;
}) {
  const { design, header, schedule: scheduleBlock, ads } = config;

  const fontHref = useMemo(() => {
    const family = design.fontFamily.trim().replace(/\s+/g, '+');
    return `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700;800&display=swap`;
  }, [design.fontFamily]);

  const cssVars = {
    '--tv-font-color': design.fontColor,
    '--tv-secondary': design.secondaryFontColor,
    '--tv-accent': design.accentColor,
    '--tv-bg1': design.bgColor1,
    '--tv-bg2': design.bgColor2,
    '--tv-card-bg': design.cardBg,
    '--tv-card-border': design.cardBorder,
  } as React.CSSProperties;

  const enabledAds = ads.filter((slot) => slot.enabled);
  const headerAd = header.sponsorAdId ? enabledAds.find((slot) => slot.id === header.sponsorAdId) : undefined;
  const zoneAds = (placement: TvMonitorAdSlot['placement'], fullHeight?: boolean) =>
    enabledAds.filter(
      (slot) =>
        slot.placement === placement &&
        slot.id !== header.sponsorAdId &&
        (placement === 'left' || placement === 'right' ? slot.fullHeight === Boolean(fullHeight) : true),
    );

  const spaces = schedule?.spaces ?? [];
  const compactColumns = enabledAds.some((slot) => slot.placement === 'left' || slot.placement === 'right');

  const ratio = RATIO_VALUES[config.screenRatio];

  const gradient = `linear-gradient(160deg, ${design.bgColor1} 0%, ${design.bgColor2} 100%)`;

  const screen = (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        ...cssVars,
        color: design.fontColor,
        fontFamily: `'${design.fontFamily}', system-ui, sans-serif`,
        background: design.bgImageUrl ? design.bgColor2 : gradient,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- per-config runtime font */}
      <link rel="stylesheet" href={fontHref} />
      <style>{`.tv-ad-fade { animation: tvAdFade 0.6s ease; } @keyframes tvAdFade { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {design.bgImageUrl && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url(${design.bgImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          {/* Color gradient over the photo keeps schedule text readable. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: gradient, opacity: design.bgImageOverlayOpacity / 100 }}
          />
        </>
      )}

      {/* Positioned wrapper keeps content painting above the absolute bg layers.
          Full-height rails sit outside the header/banner column, spanning top to bottom. */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {zoneAds('left', true).map((slot) => (
          <div key={slot.id} className="h-full shrink-0" style={{ width: adSlotSize(slot) }}>
            <TvAdSlotView slot={slot} previewMode={previewMode} />
          </div>
        ))}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">

      {zoneAds('top').map((slot) => (
        <div key={slot.id} className="w-full shrink-0" style={{ height: adSlotSize(slot) }}>
          <TvAdSlotView slot={slot} previewMode={previewMode} />
        </div>
      ))}

      {header.enabled && header.layout === 'centered' && (
        <header
          className={`flex shrink-0 items-center justify-between ${compactColumns ? 'gap-4 px-5 py-3' : 'gap-6 px-8 py-4'}`}
        >
          {/* Left: sponsor + QRs. */}
          <div className={`flex flex-1 items-center ${compactColumns ? 'gap-4' : 'gap-6'}`}>
            {headerAd && (
              <div className="shrink-0" style={{ height: adSlotSize(headerAd) }}>
                <TvAdSlotView slot={headerAd} previewMode={previewMode} headerMode />
              </div>
            )}
            {header.scheduleQr.enabled && header.scheduleQr.url && (
              <TvQr url={header.scheduleQr.url} label={header.scheduleQr.label} compact={compactColumns} />
            )}
            {header.waiverQr.enabled && header.waiverQr.url && (
              <TvQr url={header.waiverQr.url} label={header.waiverQr.label} compact={compactColumns} />
            )}
          </div>

          {/* Center: big clock + date. */}
          <TvClock showClock={header.showClock} showDate={header.showDate} compact={compactColumns} align="center" />

          {/* Right: facility logo. */}
          <div className="flex flex-1 items-center justify-end">
            {header.showLogo && header.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- partner logo, remote by design
              <img
                src={header.logoUrl}
                alt=""
                className="shrink-0 object-contain"
                style={{ height: header.logoHeightPx, maxWidth: header.logoHeightPx * 3.5 }}
              />
            )}
            {header.showLogo && !header.logoUrl && previewMode && (
              <div
                className="flex w-28 items-center justify-center rounded-lg border-2 border-dashed text-xs"
                style={{ borderColor: 'var(--tv-card-border)', color: 'var(--tv-secondary)', height: header.logoHeightPx }}
              >
                Logo
              </div>
            )}
          </div>
        </header>
      )}

      {header.enabled && header.layout === 'inline' && (
        <header
          className={`flex shrink-0 flex-wrap items-center justify-between border-b ${compactColumns ? 'gap-4 px-5 py-3' : 'gap-6 px-8 py-4'}`}
          style={{ borderColor: 'var(--tv-card-border)' }}
        >
          {/* Left: logo + title. flex-1 + min-w guarantee the title stays visible;
              sponsor/clock zones size to content and wrap below if truly out of room. */}
          <div className="flex min-w-0 flex-1 items-center gap-4" style={{ minWidth: '14rem' }}>
            {header.showLogo && header.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- partner logo, remote by design
              <img
                src={header.logoUrl}
                alt=""
                className="shrink-0 object-contain"
                style={{ height: header.logoHeightPx, maxWidth: header.logoHeightPx * 3.5 }}
              />
            )}
            {header.showLogo && !header.logoUrl && previewMode && (
              <div
                className="flex w-28 shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-xs"
                style={{ borderColor: 'var(--tv-card-border)', color: 'var(--tv-secondary)', height: header.logoHeightPx }}
              >
                Logo
              </div>
            )}
            {header.showTitle && (
              <h1 className={`truncate font-extrabold tracking-tight ${compactColumns ? 'text-2xl' : 'text-4xl'}`}>
                {header.title}
              </h1>
            )}
          </div>

          {/* Center: sponsor logo/media, height-fitted and never cropped. */}
          {headerAd && (
            <div className="shrink-0" style={{ height: adSlotSize(headerAd) }}>
              <TvAdSlotView slot={headerAd} previewMode={previewMode} headerMode />
            </div>
          )}

          {/* Right: QR codes + clock. */}
          <div className={`flex shrink-0 items-center ${compactColumns ? 'gap-4' : 'gap-8'}`}>
            {header.scheduleQr.enabled && header.scheduleQr.url && (
              <TvQr url={header.scheduleQr.url} label={header.scheduleQr.label} compact={compactColumns} />
            )}
            {header.waiverQr.enabled && header.waiverQr.url && (
              <TvQr url={header.waiverQr.url} label={header.waiverQr.label} compact={compactColumns} />
            )}
            <TvClock showClock={header.showClock} showDate={header.showDate} compact={compactColumns} />
          </div>
        </header>
      )}

      <div className="flex min-h-0 flex-1">
        {zoneAds('left').map((slot) => (
          <div key={slot.id} className="h-full shrink-0" style={{ width: adSlotSize(slot) }}>
            <TvAdSlotView slot={slot} previewMode={previewMode} />
          </div>
        ))}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col px-8 py-4">
          {header.enabled && header.layout === 'centered' && header.showTitle && (
            <div
              className={`mb-4 shrink-0 rounded px-4 py-2 text-center font-extrabold uppercase tracking-wide ${compactColumns ? 'text-3xl' : 'text-4xl'}`}
              style={{ background: 'var(--tv-accent)', color: 'var(--tv-font-color)' }}
            >
              {header.title}
            </div>
          )}
          <div className="min-h-0 flex-1">
            {scheduleBlock.enabled ? (
              <TvScheduleGrid
                spaces={spaces}
                settings={scheduleBlock}
                compact={compactColumns}
                // Single rink under a title banner: the banner IS the column header.
                hideSpaceNames={
                  header.enabled && header.layout === 'centered' && header.showTitle && spaces.length <= 1
                }
              />
            ) : previewMode ? (
              <div className="flex h-full items-center justify-center text-xl" style={{ color: 'var(--tv-secondary)' }}>
                Schedule block is turned off
              </div>
            ) : null}
          </div>
        </main>

        {zoneAds('right').map((slot) => (
          <div key={slot.id} className="h-full shrink-0" style={{ width: adSlotSize(slot) }}>
            <TvAdSlotView slot={slot} previewMode={previewMode} />
          </div>
        ))}
      </div>

      {zoneAds('bottom').map((slot) => (
        <div key={slot.id} className="w-full shrink-0" style={{ height: adSlotSize(slot) }}>
          <TvAdSlotView slot={slot} previewMode={previewMode} />
        </div>
      ))}

        </div>

        {zoneAds('right', true).map((slot) => (
          <div key={slot.id} className="h-full shrink-0" style={{ width: adSlotSize(slot) }}>
            <TvAdSlotView slot={slot} previewMode={previewMode} />
          </div>
        ))}
      </div>
    </div>
  );

  if (previewMode) {
    return <div className="h-full w-full">{screen}</div>;
  }

  if (!ratio) {
    return <div className="h-[100dvh] w-screen">{screen}</div>;
  }

  // Fixed ratio on a live screen: letterbox on black, centered.
  return (
    <div className="flex h-[100dvh] w-screen items-center justify-center bg-black">
      <div
        style={{
          width: `min(100vw, calc(100dvh * ${ratio}))`,
          height: `min(100dvh, calc(100vw / ${ratio}))`,
        }}
      >
        {screen}
      </div>
    </div>
  );
}
