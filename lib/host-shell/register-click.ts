import type { DiscoveryConfig } from '@/types';
import { resolveHostShellSettings } from '@/lib/host-shell/bootstrap';
import { tryHostRoutedRegistrationNavigate } from '@/lib/host-shell/navigation';

/**
 * Intercepts registration link clicks when portal/host_routed mode is active inside a partner iframe.
 */
export function handleRegistrationLinkClick(
  event: { preventDefault: () => void },
  href: string | undefined,
  config: DiscoveryConfig,
): void {
  if (!href) {
    return;
  }
  const { consumerOrigin } = resolveHostShellSettings(config);
  if (tryHostRoutedRegistrationNavigate(href, config.features.linkBehavior, consumerOrigin)) {
    event.preventDefault();
  }
}
