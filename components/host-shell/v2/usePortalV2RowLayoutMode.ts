'use client';

import { useEffect, useState } from 'react';

export const PORTAL_V2_ROW_DESKTOP_MIN_WIDTH_PX = 640;

function readPortalV2RowLayoutMode(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  return window.matchMedia(`(min-width: ${PORTAL_V2_ROW_DESKTOP_MIN_WIDTH_PX}px)`).matches
    ? 'desktop'
    : 'mobile';
}

export function usePortalV2RowLayoutMode(): 'mobile' | 'desktop' {
  const [layoutMode, setLayoutMode] = useState<'mobile' | 'desktop'>(readPortalV2RowLayoutMode);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${PORTAL_V2_ROW_DESKTOP_MIN_WIDTH_PX}px)`);
    const syncLayoutMode = () => {
      setLayoutMode(mediaQuery.matches ? 'desktop' : 'mobile');
    };
    syncLayoutMode();
    mediaQuery.addEventListener('change', syncLayoutMode);
    return () => mediaQuery.removeEventListener('change', syncLayoutMode);
  }, []);

  return layoutMode;
}
