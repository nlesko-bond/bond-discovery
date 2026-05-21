import type { DiscoveryConfig } from '@/types';
import { HostPortalLayoutEnum } from '@/types';

export function resolveHostPortalLayout(config: DiscoveryConfig): HostPortalLayoutEnum {
  return config.features.hostPortalLayout === HostPortalLayoutEnum.SESSIONS_FIRST
    ? HostPortalLayoutEnum.SESSIONS_FIRST
    : HostPortalLayoutEnum.LEGACY_PROGRAMS;
}

export function isSessionsFirstPortalLayout(config: DiscoveryConfig): boolean {
  return resolveHostPortalLayout(config) === HostPortalLayoutEnum.SESSIONS_FIRST;
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
