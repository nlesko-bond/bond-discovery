import type { DiscoveryConfig } from '@/types';

export interface IEmbedKitCorsHeaderOptions {
  /**
   * When the browser `Origin` is not on `embedAllowedOrigins`, still echo that
   * origin in `Access-Control-Allow-Origin` so the client can read 403/429 JSON
   * instead of a generic CORS failure. Does not apply to successful cross-origin
   * data responses.
   */
  reflectRequestOriginForErrorResponse?: boolean;
}

function normalizeEmbedAllowedOrigins(config: DiscoveryConfig | null): string[] {
  const raw = config?.features?.embedAllowedOrigins;
  if (!raw || raw.length === 0) return [];
  return raw.map((o) => o.trim()).filter(Boolean);
}

function requestOriginTrimmed(request: Request): string | null {
  const raw = request.headers.get('Origin');
  if (!raw) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Returns true when the request may receive embed-kit JSON (same-origin
 * requests omit Origin; cross-origin requests must match allowlist when set).
 */
export function isEmbedKitBrowserRequestAllowed(
  request: Request,
  config: DiscoveryConfig | null,
): boolean {
  const list = normalizeEmbedAllowedOrigins(config);
  if (list.length === 0) {
    return true;
  }
  const origin = requestOriginTrimmed(request);
  if (!origin) {
    return true;
  }
  return list.includes(origin);
}

/**
 * CORS headers for embed-kit consumers (Webflow, partner sites).
 * When `embedAllowedOrigins` is set, only listed origins receive ACAO on
 * success responses unless `reflectRequestOriginForErrorResponse` is used.
 */
export function embedKitCorsHeaders(
  request: Request,
  config: DiscoveryConfig | null,
  options?: IEmbedKitCorsHeaderOptions,
): Record<string, string> {
  const origin = requestOriginTrimmed(request);
  const list = normalizeEmbedAllowedOrigins(config);

  const base: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (list.length > 0) {
    if (origin && list.includes(origin)) {
      return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    }
    if (options?.reflectRequestOriginForErrorResponse && origin) {
      return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    }
    return base;
  }

  return { ...base, 'Access-Control-Allow-Origin': '*' };
}
