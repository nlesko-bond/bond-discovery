'use client';

import { useState } from 'react';
import { getSportIconAssetPath, normalizeSportKey } from '@/lib/host-shell/sport-visuals';
import { SportIconSvg } from './sport-icons/SportIconSvg';

interface IHostPortalSportIconProps {
  sportId: string;
  size?: number;
  className?: string;
}

/**
 * Renders a sport glyph: partner SVG from public/icons/sports/{sport}.svg when present,
 * otherwise built-in sport silhouettes (until custom assets are added).
 */
export function HostPortalSportIcon({ sportId, size = 20, className }: IHostPortalSportIconProps) {
  const sportKey = normalizeSportKey(sportId);
  const [assetMissing, setAssetMissing] = useState(false);

  if (!assetMissing) {
    return (
      <img
        src={getSportIconAssetPath(sportId)}
        alt=""
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: 'contain' }}
        onError={() => setAssetMissing(true)}
      />
    );
  }

  return <SportIconSvg sportKey={sportKey} size={size} className={className} />;
}
