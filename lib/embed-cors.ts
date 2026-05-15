import type { DiscoveryConfig } from '@/types';

/**
 * Returns true when the request may receive embed-kit JSON (same-origin
 * requests omit Origin; cross-origin requests must match allowlist when set).
 */
export function isEmbedKitBrowserRequestAllowed(
  request: Request,
  config: DiscoveryConfig | null,
): boolean {
  const list = config?.features?.embedAllowedOrigins;
  if (!list || list.length === 0) {
    return true;
  }
  const origin = request.headers.get('Origin');
  if (!origin) {
    return true;
  }
  return list.includes(origin);
}

/**
 * CORS headers for embed-kit consumers (Webflow, partner sites).
 * When `embedAllowedOrigins` is set, only listed origins receive ACAO.
 */
export function embedKitCorsHeaders(
  request: Request,
  config: DiscoveryConfig | null,
): Record<string, string> {
  const origin = request.headers.get('Origin');
  const list = config?.features?.embedAllowedOrigins;

  const base: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (list && list.length > 0) {
    if (origin && list.includes(origin)) {
      return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    }
    return base;
  }

  return { ...base, 'Access-Control-Allow-Origin': '*' };
}
