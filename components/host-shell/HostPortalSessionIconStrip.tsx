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

const ICON_STRIP_GRADIENT_FROM_ALPHA_HEX = '40';
const ICON_STRIP_GRADIENT_MID_ALPHA_HEX = '28';
const ICON_STRIP_GRADIENT_END_ALPHA_HEX = '14';
const ICON_STRIP_ACCENT_BAR_HEIGHT_CLASS = 'h-1';

function formatAgeGenderLine(ageRange?: string, genderLabel?: string): string | undefined {
  if (ageRange && genderLabel) {
    return `${ageRange} · ${genderLabel}`;
  }
  return ageRange ?? genderLabel;
}

function MetaChip({
  icon,
  label,
  iconBackground,
  iconColor,
}: {
  icon: ReactNode;
  label: string;
  iconBackground: string;
  iconColor: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBackground, color: iconColor }}
      >
        {icon}
      </span>
      <span className="max-w-[10rem] truncate sm:max-w-none">{label}</span>
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
  const { primaryColor, secondaryColor } = uiColors;
  const theme = uiColors.visualTheme;
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
      className="relative overflow-hidden px-4 py-3 border-b border-gray-100"
      style={{
        background: `linear-gradient(135deg, ${theme.gradientFrom}${ICON_STRIP_GRADIENT_FROM_ALPHA_HEX} 0%, ${secondaryColor}${ICON_STRIP_GRADIENT_MID_ALPHA_HEX} 55%, ${primaryColor}${ICON_STRIP_GRADIENT_END_ALPHA_HEX} 100%)`,
      }}
    >
      <div
        className={cn('pointer-events-none absolute inset-x-0 top-0', ICON_STRIP_ACCENT_BAR_HEIGHT_CLASS)}
        style={{
          background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {hasSport && sport && sportLabel && (
          <MetaChip
            icon={<HostPortalSportIcon sportId={sport} size={16} className="shrink-0" />}
            label={sportLabel}
            iconBackground={theme.iconBackground}
            iconColor={theme.iconColor}
          />
        )}
        {hasFacility && facilityName && (
          <MetaChip
            icon={<MapPin size={15} strokeWidth={2.25} aria-hidden />}
            label={facilityName}
            iconBackground={theme.iconBackground}
            iconColor={theme.iconColor}
          />
        )}
        {hasAgeGender && ageGenderLine && (
          <MetaChip
            icon={<Users size={15} strokeWidth={2.25} aria-hidden />}
            label={ageGenderLine}
            iconBackground={`${secondaryColor}14`}
            iconColor={secondaryColor}
          />
        )}
      </div>
    </div>
  );
}
