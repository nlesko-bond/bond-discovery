/**
 * Bond Cognito authentication for v4 API (memberships, reservations, etc.)
 * Ported from facility-schedule-v2 -- shares the same Upstash Redis instance.
 * 
 * ONLY used by the membership feature. The programs discovery feature
 * continues to use the public API with x-api-key (lib/bond-client.ts).
 */

import { cacheGet, cacheSet } from './cache';

const BOND_API_BASE = 'https://api.bondsports.co/v4';
const REFRESH_TOKEN_URL = 'https://api.bondsports.co/auth/refresh';
const BOND_TOKENS_CACHE_KEY = 'bond:tokens';
const TOKEN_TTL_SECONDS = 55 * 60; // 55 minutes (tokens expire at 60)

interface CognitoTokens {
  accessToken: string;
  userIdToken: string;
  expiresAt: number;
}

export async function getBondAuthHeaders(): Promise<Record<string, string>> {
  const tokens = await getCognitoTokens();

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  if (tokens) {
    headers['X-BondUserAccessToken'] = tokens.accessToken;
    headers['X-BondUserIdToken'] = tokens.userIdToken;
  } else {
    console.error('[BondAuth] No tokens available -- API calls will likely fail');
  }

  return headers;
}

async function getCognitoTokens(): Promise<CognitoTokens | null> {
  try {
    const cached = await cacheGet<CognitoTokens>(BOND_TOKENS_CACHE_KEY);

    if (cached && cached.expiresAt > Date.now()) {
      const remainingMin = Math.round((cached.expiresAt - Date.now()) / 60000);
      console.log(`[BondAuth] Using cached tokens (${remainingMin} min remaining)`);
      return cached;
    }

    console.log('[BondAuth] Refreshing tokens from Bond API...');
    const freshTokens = await refreshTokensFromBond();

    if (freshTokens) {
      await cacheSet(BOND_TOKENS_CACHE_KEY, freshTokens, { ttl: TOKEN_TTL_SECONDS });
      console.log('[BondAuth] Tokens cached in Redis');
    }

    return freshTokens;
  } catch (error) {
    console.error('[BondAuth] Error getting tokens:', error);
    return null;
  }
}

async function refreshTokensFromBond(): Promise<CognitoTokens | null> {
  const refreshToken = process.env.BOND_COGNITO_REFRESH_TOKEN;
  const username = process.env.BOND_COGNITO_USERNAME;

  if (!refreshToken || !username) {
    console.error('[BondAuth] Missing BOND_COGNITO_REFRESH_TOKEN or BOND_COGNITO_USERNAME');
    return null;
  }

  try {
    const response = await fetch(`${REFRESH_TOKEN_URL}?platform=retool`, {
      method: 'GET',
      headers: {
        'X-BondUserRefreshToken': refreshToken,
        'X-BondUserUsername': username,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BondAuth] Token refresh failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();

    if (!data.accessToken || !data.userIdToken) {
      console.error('[BondAuth] Token refresh response missing tokens');
      return null;
    }

    console.log('[BondAuth] Tokens refreshed successfully');

    return {
      accessToken: data.accessToken,
      userIdToken: data.userIdToken,
      expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    };
  } catch (error) {
    console.error('[BondAuth] Token refresh error:', error);
    return null;
  }
}

export function getBondApiBase(): string {
  return BOND_API_BASE;
}
