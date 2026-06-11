'use client';

import type { ReactNode } from 'react';
import { MapPin, Users } from 'lucide-react';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import type { DiscoveryConfig } from '@/types';
import { cn, getSportLabel } from '@/lib/utils';
import { HostPortalSportIcon } from './HostPortalSportIcon';
import type { ISportVisualTheme } from '@/lib/host-shell/sport-visuals';

interface IHostPortalSessionIconStripProps {
  config: DiscoveryConfig;
  sport?: string;
  facilityName?: string;
  ageRange?: string;
  genderLabel?: string;
  visualTheme?: ISportVisualTheme;
}

const ICON_STRIP_ACCENT_BAR_HEIGHT_CLASS = 'h-1';

function formatAgeGenderLine(ageRange?: string, genderLabel?: string): string | undefined {
  if (ageRange && genderLabel) {
    return `${ageRange} · ${genderLabel}`;
  }
  return ageRange ?? genderLabel;
}

function MetaChipOnColor({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-black/15 px-2 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/20">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-white/90">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function HostPortalSessionIconStrip({
  config,
  sport,
  facilityName,
  ageRange,
  genderLabel,
  visualTheme,
}: IHostPortalSessionIconStripProps) {
  const uiColors = resolvePortalUiColors(config, sport, visualTheme);
  const theme = uiColors.visualTheme;
  const themeBackground =
    config.features.scheduleThemeStyle === 'gradient'
      ? `linear-gradient(135deg, ${theme.gradientFrom} 0%, ${theme.gradientTo} 100%)`
      : theme.gradientFrom;
  const sportLabel = sport ? getSportLabel(sport) : undefined;
  const ageGenderLine = formatAgeGenderLine(ageRange, genderLabel);

  const hasSport = Boolean(sportLabel && sport);
  const hasFacility = Boolean(facilityName?.trim());
  const hasAgeGender = Boolean(ageGenderLine);

  if (!hasSport && !hasFacility && !hasAgeGender) {
    return null;
  }

  return (
    <div
      className="relative overflow-hidden px-4 py-3.5"
      style={{
        background: themeBackground,
      }}
    >
      <div
        className={cn('pointer-events-none absolute inset-x-0 top-0', ICON_STRIP_ACCENT_BAR_HEIGHT_CLASS)}
        style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,0.45), rgba(255,255,255,0.05))',
        }}
      />
      <div className="relative flex flex-wrap items-center gap-2">
        {hasSport && sport && sportLabel && (
          <MetaChipOnColor
            icon={<HostPortalSportIcon sportId={sport} size={16} className="shrink-0 brightness-0 invert" />}
            label={sportLabel}
          />
        )}
        {hasFacility && facilityName && (
          <MetaChipOnColor
            icon={<MapPin size={15} strokeWidth={2.25} aria-hidden />}
            label={facilityName}
          />
        )}
        {hasAgeGender && ageGenderLine && (
          <MetaChipOnColor
            icon={<Users size={15} strokeWidth={2.25} aria-hidden />}
            label={ageGenderLine}
          />
        )}
      </div>
    </div>
  );
}
