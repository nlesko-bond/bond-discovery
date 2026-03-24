import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'bond_form_staff';

export { COOKIE_NAME };

function getSecret(): string {
  const s = process.env.FORM_STAFF_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error('FORM_STAFF_SESSION_SECRET or NEXTAUTH_SECRET must be set to create form staff sessions');
  }
  return s;
}

function getSecretOptional(): string | null {
  return process.env.FORM_STAFF_SESSION_SECRET || process.env.NEXTAUTH_SECRET || null;
}

export interface FormStaffSessionPayload {
  slug: string;
  exp: number;
}

const MAX_AGE_SEC = 8 * 60 * 60; // 8 hours

export function createStaffSessionToken(slug: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload: FormStaffSessionPayload = { slug, exp };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyStaffSessionToken(token: string | undefined, expectedSlug: string): boolean {
  const secret = getSecretOptional();
  if (!secret || !token || !expectedSlug) return false;
  const i = token.lastIndexOf('.');
  if (i <= 0) return false;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expectedSig = createHmac('sha256', secret).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  let payload: FormStaffSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as FormStaffSessionPayload;
  } catch {
    return false;
  }
  if (payload.slug !== expectedSlug) return false;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

export function staffSessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SEC,
  };
}
