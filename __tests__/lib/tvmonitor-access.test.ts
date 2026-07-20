import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createStudioCookieValue,
  generateAccessToken,
  hashAccessToken,
  verifyStudioCookie,
} from '@/lib/tvmonitor-access';

describe('tvmonitor access tokens', () => {
  it('generates long, unique, url-safe tokens', () => {
    const a = generateAccessToken();
    const b = generateAccessToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes deterministically without exposing the token', () => {
    const token = generateAccessToken();
    expect(hashAccessToken(token)).toBe(hashAccessToken(token));
    expect(hashAccessToken(token)).not.toContain(token);
    expect(hashAccessToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('studio session cookie', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('TVMONITOR_ACCESS_SECRET', 'test-secret');
  });

  it('round-trips a valid session', () => {
    const { value, maxAgeSeconds } = createStudioCookieValue({ grantId: 'g-1', organizationIds: [61, 99] });
    expect(maxAgeSeconds).toBeGreaterThan(0);
    const session = verifyStudioCookie(value);
    expect(session).toEqual({ grantId: 'g-1', organizationIds: [61, 99] });
  });

  it('rejects a tampered payload', () => {
    const { value } = createStudioCookieValue({ grantId: 'g-1', organizationIds: [61] });
    const json = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    json.o = [61, 12345]; // grant self more orgs
    const forged = Buffer.from(JSON.stringify(json), 'utf8').toString('base64url');
    expect(verifyStudioCookie(forged)).toBeNull();
  });

  it('rejects garbage and missing cookies', () => {
    expect(verifyStudioCookie(undefined)).toBeNull();
    expect(verifyStudioCookie('not-base64!!')).toBeNull();
    expect(verifyStudioCookie(Buffer.from('{}').toString('base64url'))).toBeNull();
  });

  it('rejects cookies signed with a different secret', () => {
    const { value } = createStudioCookieValue({ grantId: 'g-1', organizationIds: [61] });
    vi.stubEnv('TVMONITOR_ACCESS_SECRET', 'rotated-secret');
    expect(verifyStudioCookie(value)).toBeNull();
  });
});
