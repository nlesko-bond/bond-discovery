'use client';

import { MapPin, Users, type LucideIcon } from 'lucide-react';
import { getHostPortalSportIcon } from '@/lib/host-shell/session-sport-icon';
import { getSportLabel } from '@/lib/utils';

interface IHostPortalSessionIconStripProps {
  sport?: string;
  facilityName?: string;
  ageRange?: string;
  genderLabel?: string;
}

function IconStripItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 whitespace-nowrap">
      <Icon size={16} className="text-gray-400 shrink-0" aria-hidden />
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
  sport,
  facilityName,
  ageRange,
  genderLabel,
}: IHostPortalSessionIconStripProps) {
  const sportLabel = sport ? getSportLabel(sport) : undefined;
  const SportIcon = sport ? getHostPortalSportIcon(sport) : null;
  const ageGenderLine = formatAgeGenderLine(ageRange, genderLabel);

  const hasSport = Boolean(sportLabel && SportIcon);
  const hasFacility = Boolean(facilityName?.trim());
  const hasAgeGender = Boolean(ageGenderLine);

  if (!hasSport && !hasFacility && !hasAgeGender) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
      {hasSport && SportIcon && sportLabel && (
        <IconStripItem icon={SportIcon} label={sportLabel} />
      )}
      {hasFacility && facilityName && <IconStripItem icon={MapPin} label={facilityName} />}
      {hasAgeGender && ageGenderLine && <IconStripItem icon={Users} label={ageGenderLine} />}
    </div>
  );
}
