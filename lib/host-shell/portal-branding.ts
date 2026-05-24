import type { DiscoveryConfig } from '@/types';
import { isLightColor } from '@/lib/utils';

export interface IPortalBrandColors {
  primaryColor: string;
  secondaryColor: string;
  headerBackgroundColor: string;
  headerTextLight: boolean;
}

export function resolvePortalBrandingLogoUrl(config: DiscoveryConfig): string | undefined {
  const raw = config.branding.logo;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolvePortalBrandColors(config: DiscoveryConfig): IPortalBrandColors {
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const headerBackgroundColor = config.branding.headerBackgroundColor || '#ffffff';
  const headerTextLight = !isLightColor(headerBackgroundColor);

  return {
    primaryColor,
    secondaryColor,
    headerBackgroundColor,
    headerTextLight,
  };
}
