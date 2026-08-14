/**
 * Access gating for roster pages.
 *
 * Two independent scopes on the same page, deliberately separate cookies:
 *
 * - **viewer** — unlocks a password-protected page at all.
 * - **staff**  — additionally unlocks the PII columns (contact, DOB, waiver,
 *   guardian) and the staff print modes.
 *
 * They are separate because a page can be publicly readable *and* have a staff
 * mode, and because unlocking one must never imply the other. `resolveViewerMode`
 * is the only thing that may return 'staff', and every participant payload is
 * built from its result — see lib/roster-privacy.ts.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { verifyViewerPassword } from '@/lib/reservation-page-password';
import type { RosterPageAccess, RosterViewerMode } from '@/types/rosters';

export type RosterAccessScope = 'viewer' | 'staff';

const VIEWER_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
/**
 * Staff sessions are deliberately much shorter than viewer sessions: the staff
 * scope exposes participant PII, and these are used on shared front-desk
 * machines where a week-long cookie is a liability.
 */
const STAFF_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

const DEV_FALLBACK_SECRET = 'dev-only-roster-access-set-ROSTER_ACCESS_SECRET';

export function rosterAccessCookieName(scope: RosterAccessScope, slug: string): string {
  return scope === 'staff' ? `bond_rs_staff_${slug}` : `bond_rs_${slug}`;
}

function maxAgeFor(scope: RosterAccessScope): number {
  return scope === 'staff' ? STAFF_MAX_AGE_SECONDS : VIEWER_MAX_AGE_SECONDS;
}

/**
 * Falls back to the reservation-page secret so a deployment that already has
 * one keeps working, then to a dev-only literal. Throws in production when
 * neither is set rather than signing with a guessable value.
 */
function getSecret(): string {
  const secret = process.env.ROSTER_ACCESS_SECRET || process.env.RESERVATION_PAGE_ACCESS_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'development') return DEV_FALLBACK_SECRET;
  throw new Error(
    'ROSTER_ACCESS_SECRET is required for password-protected roster pages'
  );
}

/** The scope is part of the signed payload, so a viewer cookie cannot be replayed as a staff one. */
function sign(secret: string, scope: RosterAccessScope, slug: string, exp: number): string {
  return createHmac('sha256', secret).update(`${scope}:${slug}:${exp}`).digest('hex');
}

export function createRosterAccessCookieValue(
  scope: RosterAccessScope,
  slug: string
): { value: string; maxAgeSeconds: number } {
  const secret = getSecret();
  const maxAgeSeconds = maxAgeFor(scope);
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = JSON.stringify({ scope, slug, exp, sig: sign(secret, scope, slug, exp) });
  return { value: Buffer.from(payload, 'utf8').toString('base64url'), maxAgeSeconds };
}

export function verifyRosterAccessCookie(
  scope: RosterAccessScope,
  slug: string,
  raw: string | undefined
): boolean {
  if (!raw) return false;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return false;

    const rec = parsed as Record<string, unknown>;
    if (rec.scope !== scope || rec.slug !== slug) return false;
    if (typeof rec.exp !== 'number' || typeof rec.sig !== 'string') return false;
    if (rec.exp < Math.floor(Date.now() / 1000)) return false;

    const expected = Buffer.from(sign(secret, scope, slug, rec.exp), 'hex');
    const actual = Buffer.from(rec.sig, 'hex');
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Cookie attributes for a Set-Cookie on an unlock response. */
export function rosterAccessCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function hasRosterAccessCookie(
  scope: RosterAccessScope,
  slug: string
): Promise<boolean> {
  const store = await cookies();
  return verifyRosterAccessCookie(scope, slug, store.get(rosterAccessCookieName(scope, slug))?.value);
}

/**
 * Whether the request may see the page at all.
 *
 * A page whose access is 'password' or 'staff' but which has no matching hash
 * set is treated as locked, not open — a half-configured page must fail closed.
 */
export async function canViewRosterPage(
  slug: string,
  pageAccess: RosterPageAccess,
  hasViewerPassword: boolean,
  hasStaffPassword: boolean
): Promise<boolean> {
  if (pageAccess === 'public') return true;

  if (pageAccess === 'staff') {
    if (!hasStaffPassword) return false;
    return hasRosterAccessCookie('staff', slug);
  }

  if (!hasViewerPassword) return false;
  // A staff unlock also satisfies a viewer gate — staff is the stronger claim.
  return (await hasRosterAccessCookie('viewer', slug)) || (await hasRosterAccessCookie('staff', slug));
}

/**
 * The only source of 'staff'. Never infer staff mode from a query parameter,
 * a header, or the page config — it must come from a verified cookie.
 */
export async function resolveViewerMode(
  slug: string,
  hasStaffPassword: boolean
): Promise<RosterViewerMode> {
  if (!hasStaffPassword) return 'public';
  return (await hasRosterAccessCookie('staff', slug)) ? 'staff' : 'public';
}

/** Check a submitted password against the stored hash for a scope. */
export function checkRosterPassword(plain: string, storedHash: string | null): boolean {
  if (!storedHash || !plain) return false;
  return verifyViewerPassword(plain, storedHash);
}
