import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const SALT_LEN = 16;
const KEY_LEN = 64;

export async function hashStaffPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString('hex');
  const buf = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
  return `scrypt:${salt}:${buf.toString('hex')}`;
}

export async function verifyStaffPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored || !plain) return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const buf = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
    const expected = Buffer.from(keyHex, 'hex');
    if (buf.length !== expected.length) return false;
    return timingSafeEqual(buf, expected);
  } catch {
    return false;
  }
}
