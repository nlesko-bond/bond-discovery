'use client';

import type { IPortalHeroMetadata } from '@/lib/host-shell/portal-list-layout';
import { getSportVisualTheme } from '@/lib/host-shell/sport-visuals';
import { HostPortalSportIcon } from '../HostPortalSportIcon';

interface IHostPortalHeroBannerProps {
  metadata: IPortalHeroMetadata;
  sport?: string;
}

export function HostPortalHeroBanner({ metadata, sport }: IHostPortalHeroBannerProps) {
  const sportTheme = getSportVisualTheme(sport);

  return (
    <section
      className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12"
      style={{
        background: `linear-gradient(135deg, ${sportTheme.gradientFrom} 0%, ${sportTheme.gradientTo} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {sport && (
        <HeroWatermark sport={sport} />
      )}
      <div className="relative mx-auto max-w-7xl">
        {metadata.eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            {metadata.eyebrow}
          </p>
        )}
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {metadata.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
          {metadata.subtitle}
        </p>
      </div>
    </section>
  );
}

function HeroWatermark({ sport }: { sport: string }) {
  return (
    <div className="pointer-events-none absolute -right-6 top-1/2 hidden h-40 w-40 -translate-y-1/2 opacity-15 sm:block md:h-52 md:w-52">
      <HostPortalSportIcon
        sportId={sport}
        size={208}
        className="h-full w-full brightness-0 invert"
      />
    </div>
  );
}
