import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
export const MIN_VIEWER_PASSWORD_LENGTH = 6;
const MAX_VIEWER_PASSWORD_LENGTH = 256;
const SCRYPT_PREFIX = 'scrypt1';

/**
 * Returns a stored hash string for a viewer password (scrypt + random salt).
 */
export function hashViewerPassword(plain: string): string {
  const trimmed = plain.trim();
  if (trimmed.length < MIN_VIEWER_PASSWORD_LENGTH || trimmed.length > MAX_VIEWER_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be between ${MIN_VIEWER_PASSWORD_LENGTH} and ${MAX_VIEWER_PASSWORD_LENGTH} characters`,
    );
  }
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const hash = scryptSync(trimmed, salt, SCRYPT_KEYLEN);
  return `${SCRYPT_PREFIX}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * Constant-time comparison of a plain password to a stored hash from {@link hashViewerPassword}.
 */
export function verifyViewerPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== SCRYPT_PREFIX) {
    return false;
  }
  try {
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    const actual = scryptSync(plain, salt, SCRYPT_KEYLEN);
    if (actual.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
