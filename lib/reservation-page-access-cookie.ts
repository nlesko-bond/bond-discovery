import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const DEV_FALLBACK_SECRET = 'dev-only-reservation-page-access-set-RESERVATION_PAGE_ACCESS_SECRET';

/**
 * Cookie name for a verified viewer session on a reservation page slug.
 */
export function reservationPageAccessCookieName(slug: string): string {
  return `bond_rp_${slug}`;
}

function getReservationPageAccessSecret(): string {
  const s = process.env.RESERVATION_PAGE_ACCESS_SECRET;
  if (s && s.length > 0) {
    return s;
  }
  if (process.env.NODE_ENV === 'development') {
    return DEV_FALLBACK_SECRET;
  }
  throw new Error('RESERVATION_PAGE_ACCESS_SECRET is required for password-protected reservation pages');
}

function signWithSecret(secret: string, slug: string, expSeconds: number): string {
  return createHmac('sha256', secret).update(`${slug}:${expSeconds}`).digest('hex');
}

/**
 * Builds an httpOnly cookie value proving the viewer unlocked this slug until `expSeconds` (Unix seconds).
 */
export function createReservationPageAccessCookieValue(slug: string): { value: string; maxAgeSeconds: number } {
  const secret = getReservationPageAccessSecret();
  const expSeconds = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS;
  const sig = signWithSecret(secret, slug, expSeconds);
  const payload = JSON.stringify({ slug, exp: expSeconds, sig });
  return {
    value: Buffer.from(payload, 'utf8').toString('base64url'),
    maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * Returns true if the cookie value is valid for the given slug and not expired.
 */
export function verifyReservationPageAccessCookie(slug: string, raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }
  let secret: string;
  try {
    secret = getReservationPageAccessSecret();
  } catch {
    return false;
  }
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }
    const rec = parsed as Record<string, unknown>;
    if (rec.slug !== slug || typeof rec.exp !== 'number' || typeof rec.sig !== 'string') {
      return false;
    }
    if (rec.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const expectedHex = signWithSecret(secret, slug, rec.exp);
    const a = Buffer.from(rec.sig, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
