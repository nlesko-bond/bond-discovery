import {
  HostPortalLayoutEnum,
  PortalAccentSourceEnum,
  type FeatureConfig,
} from '@/types';

function resolveHostPortalLayout(
  features: Record<string, unknown>,
): HostPortalLayoutEnum | undefined {
  const raw = features.hostPortalLayout ?? features.host_portal_layout;
  if (raw === HostPortalLayoutEnum.SESSIONS_FIRST) {
    return HostPortalLayoutEnum.SESSIONS_FIRST;
  }
  if (raw === HostPortalLayoutEnum.SESSIONS_LIST) {
    return HostPortalLayoutEnum.SESSIONS_LIST;
  }
  if (raw === HostPortalLayoutEnum.LEGACY_PROGRAMS) {
    return HostPortalLayoutEnum.LEGACY_PROGRAMS;
  }
  return undefined;
}

function resolvePortalAccentSource(
  features: Record<string, unknown>,
): PortalAccentSourceEnum | undefined {
  const raw = features.portalAccentSource ?? features.portal_accent_source;
  if (raw === PortalAccentSourceEnum.BRANDING || raw === 'branding') {
    return PortalAccentSourceEnum.BRANDING;
  }
  if (raw === PortalAccentSourceEnum.SPORT || raw === 'sport') {
    return PortalAccentSourceEnum.SPORT;
  }
  return undefined;
}

function resolveOptionalBoolean(
  features: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): boolean | undefined {
  const raw = features[camelKey] ?? features[snakeKey];
  if (raw === true || raw === false) {
    return raw;
  }
  return undefined;
}

function resolveOptionalTrimmedString(
  features: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string | undefined {
  const raw = features[camelKey] ?? features[snakeKey];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalizes portal-only feature flags from discovery_pages.features JSON.
 */
export function normalizePortalFeatureFields(
  features: Record<string, unknown>,
): Pick<
  FeatureConfig,
  | 'hostPortalLayout'
  | 'portalHeroEnabled'
  | 'portalHeroTitle'
  | 'portalHeroSubtitle'
  | 'portalAccentSource'
> {
  const hostPortalLayout = resolveHostPortalLayout(features);
  const portalAccentSource = resolvePortalAccentSource(features);
  const portalHeroEnabled = resolveOptionalBoolean(
    features,
    'portalHeroEnabled',
    'portal_hero_enabled',
  );
  const portalHeroTitle = resolveOptionalTrimmedString(
    features,
    'portalHeroTitle',
    'portal_hero_title',
  );
  const portalHeroSubtitle = resolveOptionalTrimmedString(
    features,
    'portalHeroSubtitle',
    'portal_hero_subtitle',
  );

  return {
    ...(hostPortalLayout !== undefined && { hostPortalLayout }),
    ...(portalAccentSource !== undefined && { portalAccentSource }),
    ...(portalHeroEnabled !== undefined && { portalHeroEnabled }),
    ...(portalHeroTitle !== undefined && { portalHeroTitle }),
    ...(portalHeroSubtitle !== undefined && { portalHeroSubtitle }),
  };
}

export function isHostPortalSessionLayoutValue(
  layout: HostPortalLayoutEnum | undefined,
): boolean {
  return (
    layout === HostPortalLayoutEnum.SESSIONS_FIRST ||
    layout === HostPortalLayoutEnum.SESSIONS_LIST
  );
}
