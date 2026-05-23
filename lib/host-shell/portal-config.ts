import type { DiscoveryConfig } from '@/types';
import { HostPortalLayoutEnum } from '@/types';

export function resolveHostPortalLayout(config: DiscoveryConfig): HostPortalLayoutEnum {
  const layout = config.features.hostPortalLayout;
  if (layout === HostPortalLayoutEnum.SESSIONS_FIRST) {
    return HostPortalLayoutEnum.SESSIONS_FIRST;
  }
  if (layout === HostPortalLayoutEnum.SESSIONS_LIST) {
    return HostPortalLayoutEnum.SESSIONS_LIST;
  }
  return HostPortalLayoutEnum.LEGACY_PROGRAMS;
}

export function isSessionsFirstPortalLayout(config: DiscoveryConfig): boolean {
  return resolveHostPortalLayout(config) === HostPortalLayoutEnum.SESSIONS_FIRST;
}

export function isSessionsListPortalLayout(config: DiscoveryConfig): boolean {
  return resolveHostPortalLayout(config) === HostPortalLayoutEnum.SESSIONS_LIST;
}

export function isHostPortalSessionLayout(config: DiscoveryConfig): boolean {
  const layout = resolveHostPortalLayout(config);
  return (
    layout === HostPortalLayoutEnum.SESSIONS_FIRST ||
    layout === HostPortalLayoutEnum.SESSIONS_LIST
  );
}

/**
 * Portal-only overrides. Used only by /portal/[slug] — does not mutate stored config.
 */
export function toPortalDiscoveryConfig(config: DiscoveryConfig): DiscoveryConfig {
  const headerDisplay = config.features.headerDisplay;
  const minimalHeader =
    headerDisplay === 'full' || headerDisplay === undefined ? 'minimal' : headerDisplay;

  return {
    ...config,
    features: {
      ...config.features,
      headerDisplay: minimalHeader,
    },
  };
}
