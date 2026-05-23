'use client';

import type { ReactNode } from 'react';
import { MapPin, Users } from 'lucide-react';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import type { DiscoveryConfig } from '@/types';
import { getSportLabel } from '@/lib/utils';
import { HostPortalSportIcon } from './HostPortalSportIcon';

interface IHostPortalSessionIconStripProps {
  config: DiscoveryConfig;
  sport?: string;
  facilityName?: string;
  ageRange?: string;
  genderLabel?: string;
}

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
}: IHostPortalSessionIconStripProps) {
  const { primaryColor, secondaryColor, visualTheme } = resolvePortalUiColors(config, sport);
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
        background: `linear-gradient(135deg, ${visualTheme.gradientFrom}18 0%, ${secondaryColor}12 55%, ${primaryColor}08 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${visualTheme.gradientFrom}, ${visualTheme.gradientTo})`,
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {hasSport && sport && sportLabel && (
          <MetaChip
            icon={<HostPortalSportIcon sportId={sport} size={16} className="shrink-0" />}
            label={sportLabel}
            iconBackground={visualTheme.iconBackground}
            iconColor={visualTheme.iconColor}
          />
        )}
        {hasFacility && facilityName && (
          <MetaChip
            icon={<MapPin size={15} strokeWidth={2.25} aria-hidden />}
            label={facilityName}
            iconBackground={`${primaryColor}12`}
            iconColor={primaryColor}
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
