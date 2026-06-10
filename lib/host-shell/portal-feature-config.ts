import {
  HostPortalLayoutEnum,
  PortalAccentSourceEnum,
  PortalSessionLayoutEnum,
  type FeatureConfig,
  type MemberPricingStyle,
  type PortalTemplate,
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

function resolvePortalSessionLayoutDefault(
  features: Record<string, unknown>,
): PortalSessionLayoutEnum | undefined {
  const raw =
    features.portalSessionLayoutDefault ?? features.portal_session_layout_default;
  if (raw === PortalSessionLayoutEnum.LIST || raw === 'list') {
    return PortalSessionLayoutEnum.LIST;
  }
  if (raw === PortalSessionLayoutEnum.GRID || raw === 'grid') {
    return PortalSessionLayoutEnum.GRID;
  }
  return undefined;
}

function resolvePortalTemplate(
  features: Record<string, unknown>,
): PortalTemplate | undefined {
  const raw = features.portalTemplate ?? features.portal_template;
  if (raw === 'v2') {
    return 'v2';
  }
  if (raw === 'current') {
    return 'current';
  }
  return undefined;
}

function resolveMemberPricingStyle(
  features: Record<string, unknown>,
): MemberPricingStyle | undefined {
  const raw = features.memberPricingStyle ?? features.member_pricing_style;
  if (raw === 'inline' || raw === 'badge' || raw === 'stacked') {
    return raw;
  }
  return undefined;
}

function resolvePortalCardMinWidth(
  features: Record<string, unknown>,
): number | undefined {
  const raw = features.portalCardMinWidth ?? features.portal_card_min_width;
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : Number.NaN;
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
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
  | 'portalSessionLayoutDefault'
  | 'allowPortalSessionLayoutToggle'
  | 'portalTemplate'
  | 'portalCardMinWidth'
  | 'memberPricingStyle'
> {
  const hostPortalLayout = resolveHostPortalLayout(features);
  const portalTemplate = resolvePortalTemplate(features);
  const portalCardMinWidth = resolvePortalCardMinWidth(features);
  const memberPricingStyle = resolveMemberPricingStyle(features);
  const portalAccentSource = resolvePortalAccentSource(features);
  const portalSessionLayoutDefault = resolvePortalSessionLayoutDefault(features);
  const allowPortalSessionLayoutToggle = resolveOptionalBoolean(
    features,
    'allowPortalSessionLayoutToggle',
    'allow_portal_session_layout_toggle',
  );
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
    ...(portalSessionLayoutDefault !== undefined && { portalSessionLayoutDefault }),
    ...(allowPortalSessionLayoutToggle !== undefined && { allowPortalSessionLayoutToggle }),
    ...(portalHeroEnabled !== undefined && { portalHeroEnabled }),
    ...(portalHeroTitle !== undefined && { portalHeroTitle }),
    ...(portalHeroSubtitle !== undefined && { portalHeroSubtitle }),
    ...(portalTemplate !== undefined && { portalTemplate }),
    ...(portalCardMinWidth !== undefined && { portalCardMinWidth }),
    ...(memberPricingStyle !== undefined && { memberPricingStyle }),
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
