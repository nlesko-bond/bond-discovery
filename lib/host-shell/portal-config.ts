import type { DiscoveryConfig } from '@/types';

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
