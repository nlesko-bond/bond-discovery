'use client';

import type { IPortalHeroMetadata } from '@/lib/host-shell/portal-list-layout';
import type { DiscoveryConfig } from '@/types';
import { PortalAccentSourceEnum } from '@/types';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import { resolvePortalBrandingLogoUrl } from '@/lib/host-shell/portal-branding';
import { HostPortalSportIcon } from '../HostPortalSportIcon';

interface IHostPortalHeroBannerProps {
  metadata: IPortalHeroMetadata;
  config: DiscoveryConfig;
  sport?: string;
}

export function HostPortalHeroBanner({ metadata, config, sport }: IHostPortalHeroBannerProps) {
  const { visualTheme, accentSource } = resolvePortalUiColors(config, sport);
  const logoUrl = resolvePortalBrandingLogoUrl(config);
  const useOrgBranding = accentSource === PortalAccentSourceEnum.BRANDING;
  const showSportWatermark = !useOrgBranding && Boolean(sport);
  const showOrgLogo = useOrgBranding && Boolean(logoUrl);
  const heroBackground =
    config.features.scheduleThemeStyle === 'gradient'
      ? `linear-gradient(135deg, ${visualTheme.gradientFrom} 0%, ${visualTheme.gradientTo} 100%)`
      : visualTheme.gradientFrom;

  return (
    <section
      className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12"
      style={{
        background: heroBackground,
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
      {showSportWatermark && sport && (
        <HeroWatermark sport={sport} />
      )}
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="min-w-0 flex-1">
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
          {showOrgLogo && logoUrl && (
            <HeroOrgLogo logoUrl={logoUrl} companyName={config.branding.companyName} />
          )}
        </div>
      </div>
    </section>
  );
}

function HeroOrgLogo({ logoUrl, companyName }: { logoUrl: string; companyName: string }) {
  return (
    <div className="hidden shrink-0 md:flex md:max-w-[11rem] md:items-center md:justify-end lg:max-w-[13rem]">
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        className="h-20 w-auto max-w-full object-contain opacity-90 brightness-0 invert lg:h-24"
      />
      <span className="sr-only">{companyName}</span>
    </div>
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
