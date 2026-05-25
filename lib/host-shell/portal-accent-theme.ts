import type { DiscoveryConfig } from '@/types';
import { PortalAccentSourceEnum } from '@/types';
import {
  resolvePortalBrandColors,
  type IPortalBrandColors,
} from '@/lib/host-shell/portal-branding';
import {
  getSportVisualTheme,
  type ISportVisualTheme,
} from '@/lib/host-shell/sport-visuals';

const HEX_COLOR_LENGTH = 6;
const MAX_ALPHA = 255;

export interface IPortalUiColors extends IPortalBrandColors {
  accentSource: PortalAccentSourceEnum;
  visualTheme: ISportVisualTheme;
  panelBorderColor: string;
  panelBackgroundColor: string;
  panelTextColor: string;
  chipBorderColor: string;
  chipHoverBorderColor: string;
  chipHoverBackgroundColor: string;
  chipAccentColor: string;
  availabilityDotColor: string;
}

export function resolvePortalAccentSource(config: DiscoveryConfig): PortalAccentSourceEnum {
  if (config.features.portalAccentSource === PortalAccentSourceEnum.BRANDING) {
    return PortalAccentSourceEnum.BRANDING;
  }
  return PortalAccentSourceEnum.SPORT;
}

function buildBrandingVisualTheme(brand: IPortalBrandColors): ISportVisualTheme {
  return {
    gradientFrom: brand.primaryColor,
    gradientTo: brand.secondaryColor,
    iconBackground: brand.headerBackgroundColor,
    iconColor: brand.primaryColor,
  };
}

export function resolvePortalVisualTheme(
  config: DiscoveryConfig,
  sportId?: string,
): ISportVisualTheme {
  if (resolvePortalAccentSource(config) === PortalAccentSourceEnum.BRANDING) {
    return buildBrandingVisualTheme(resolvePortalBrandColors(config));
  }
  return getSportVisualTheme(sportId);
}

function withHexAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== HEX_COLOR_LENGTH) {
    return hex;
  }
  const alphaHex = Math.round(Math.max(0, Math.min(1, alpha)) * MAX_ALPHA)
    .toString(16)
    .padStart(2, '0');
  return `#${normalized}${alphaHex}`;
}

/**
 * Resolves portal list/card accent colors from org branding and optional sport palette.
 */
export function resolvePortalUiColors(
  config: DiscoveryConfig,
  sportId?: string,
  visualThemeOverride?: ISportVisualTheme,
): IPortalUiColors {
  const brand = resolvePortalBrandColors(config);
  const accentSource = resolvePortalAccentSource(config);
  const visualTheme = visualThemeOverride ?? resolvePortalVisualTheme(config, sportId);
  const accentColor =
    accentSource === PortalAccentSourceEnum.BRANDING
      ? brand.secondaryColor
      : visualTheme.gradientFrom;

  return {
    ...brand,
    accentSource,
    visualTheme,
    panelBorderColor: withHexAlpha(accentColor, 0.35),
    panelBackgroundColor: withHexAlpha(accentColor, 0.12),
    panelTextColor: brand.primaryColor,
    chipBorderColor: withHexAlpha(brand.secondaryColor, 0.35),
    chipHoverBorderColor: withHexAlpha(brand.secondaryColor, 0.55),
    chipHoverBackgroundColor: withHexAlpha(brand.secondaryColor, 0.1),
    chipAccentColor: brand.secondaryColor,
    availabilityDotColor: brand.primaryColor,
  };
}
