'use client';

import { MapPin, Users, type LucideIcon } from 'lucide-react';
import { getHostPortalSportIcon } from '@/lib/host-shell/session-sport-icon';
import { resolvePortalBrandColors } from '@/lib/host-shell/portal-branding';
import type { DiscoveryConfig } from '@/types';
import { getSportLabel } from '@/lib/utils';

interface IHostPortalSessionIconStripProps {
  config: DiscoveryConfig;
  sport?: string;
  facilityName?: string;
  ageRange?: string;
  genderLabel?: string;
}

function IconStripItem({
  icon: Icon,
  label,
  iconColor,
}: {
  icon: LucideIcon;
  label: string;
  iconColor: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
      <Icon size={16} className="shrink-0" style={{ color: iconColor }} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

function formatAgeGenderLine(ageRange?: string, genderLabel?: string): string | undefined {
  if (ageRange && genderLabel) {
    return `${ageRange} · ${genderLabel}`;
  }
  return ageRange ?? genderLabel;
}

export function HostPortalSessionIconStrip({
  config,
  sport,
  facilityName,
  ageRange,
  genderLabel,
}: IHostPortalSessionIconStripProps) {
  const { primaryColor, secondaryColor } = resolvePortalBrandColors(config);
  const sportLabel = sport ? getSportLabel(sport) : undefined;
  const SportIcon = sport ? getHostPortalSportIcon(sport) : null;
  const ageGenderLine = formatAgeGenderLine(ageRange, genderLabel);
  const stripTextColor = primaryColor;
  const iconColor = secondaryColor;

  const hasSport = Boolean(sportLabel && SportIcon);
  const hasFacility = Boolean(facilityName?.trim());
  const hasAgeGender = Boolean(ageGenderLine);

  if (!hasSport && !hasFacility && !hasAgeGender) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b"
      style={{
        backgroundColor: `${secondaryColor}22`,
        borderColor: `${secondaryColor}45`,
        color: stripTextColor,
      }}
    >
      {hasSport && SportIcon && sportLabel && (
        <IconStripItem icon={SportIcon} label={sportLabel} iconColor={iconColor} />
      )}
      {hasFacility && facilityName && (
        <IconStripItem icon={MapPin} label={facilityName} iconColor={iconColor} />
      )}
      {hasAgeGender && ageGenderLine && (
        <IconStripItem icon={Users} label={ageGenderLine} iconColor={iconColor} />
      )}
    </div>
  );
}
