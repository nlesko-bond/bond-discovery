import type { DiscoveryConfig } from '@/types';

const DEFAULT_PUNCH_PASS_URL = 'https://bondsports.co/user/passes';

/**
 * Resolved redeem-pass URL for schedule CTAs (admin override or default).
 */
export function getPunchPassRedeemUrl(config: DiscoveryConfig): string {
  const raw = config.features.punchPassRedeemUrl?.trim();
  if (!raw) return DEFAULT_PUNCH_PASS_URL;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
}
