/**
 * The access boundary. `resolveViewerMode` is the only thing that can return
 * 'staff', and every participant payload is built from its result — so these
 * tests are what stand between a forged cookie and participant PII.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
  }),
}));

import {
  canViewRosterPage,
  checkRosterPassword,
  createRosterAccessCookieValue,
  rosterAccessCookieName,
  resolveViewerMode,
  verifyRosterAccessCookie,
} from '@/lib/roster-access';
import { hashViewerPassword } from '@/lib/reservation-page-password';

const SLUG = 'coppermine';

beforeEach(() => {
  cookieStore.clear();
  process.env.ROSTER_ACCESS_SECRET = 'test-secret-value';
});

describe('cookie round-trip', () => {
  it('accepts a cookie it just minted', () => {
    const { value } = createRosterAccessCookieValue('viewer', SLUG);
    expect(verifyRosterAccessCookie('viewer', SLUG, value)).toBe(true);
  });

  it('gives staff a much shorter lifetime than viewer', () => {
    // Staff unlocks PII and is used on shared front-desk machines.
    const viewer = createRosterAccessCookieValue('viewer', SLUG);
    const staff = createRosterAccessCookieValue('staff', SLUG);
    expect(staff.maxAgeSeconds).toBeLessThan(viewer.maxAgeSeconds);
  });
});

describe('forgery and confusion', () => {
  it('does not accept a viewer cookie as a staff cookie', () => {
    const { value } = createRosterAccessCookieValue('viewer', SLUG);
    expect(verifyRosterAccessCookie('staff', SLUG, value)).toBe(false);
  });

  it('does not accept a cookie minted for another slug', () => {
    const { value } = createRosterAccessCookieValue('staff', 'other-page');
    expect(verifyRosterAccessCookie('staff', SLUG, value)).toBe(false);
  });

  it('rejects a payload whose scope was swapped after signing', () => {
    const { value } = createRosterAccessCookieValue('viewer', SLUG);
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    payload.scope = 'staff';
    const forged = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    expect(verifyRosterAccessCookie('staff', SLUG, forged)).toBe(false);
  });

  it('rejects an extended expiry', () => {
    const { value } = createRosterAccessCookieValue('staff', SLUG);
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    payload.exp += 60 * 60 * 24 * 365;
    const forged = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    expect(verifyRosterAccessCookie('staff', SLUG, forged)).toBe(false);
  });

  it('rejects an expired cookie', () => {
    const { value } = createRosterAccessCookieValue('staff', SLUG);
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    payload.exp = Math.floor(Date.now() / 1000) - 1;
    const stale = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    expect(verifyRosterAccessCookie('staff', SLUG, stale)).toBe(false);
  });

  it('rejects a tampered signature, garbage and empty input', () => {
    const { value } = createRosterAccessCookieValue('staff', SLUG);
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    payload.sig = 'a'.repeat(payload.sig.length);
    const forged = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

    expect(verifyRosterAccessCookie('staff', SLUG, forged)).toBe(false);
    expect(verifyRosterAccessCookie('staff', SLUG, 'not-base64url!!')).toBe(false);
    expect(verifyRosterAccessCookie('staff', SLUG, undefined)).toBe(false);
  });

  it('rejects a cookie signed with a rotated-away secret', () => {
    const { value } = createRosterAccessCookieValue('staff', SLUG);
    process.env.ROSTER_ACCESS_SECRET = 'a-different-secret';
    expect(verifyRosterAccessCookie('staff', SLUG, value)).toBe(false);
  });
});

describe('canViewRosterPage', () => {
  it('lets anyone into a public page', async () => {
    expect(await canViewRosterPage(SLUG, 'public', false, false)).toBe(true);
  });

  it('locks a password page that has no password set', async () => {
    // A half-configured page must fail closed, not open.
    expect(await canViewRosterPage(SLUG, 'password', false, false)).toBe(false);
  });

  it('locks a staff-only page that has no staff password set', async () => {
    expect(await canViewRosterPage(SLUG, 'staff', false, false)).toBe(false);
  });

  it('opens a password page once the viewer cookie is present', async () => {
    const { value } = createRosterAccessCookieValue('viewer', SLUG);
    cookieStore.set(rosterAccessCookieName('viewer', SLUG), value);
    expect(await canViewRosterPage(SLUG, 'password', true, false)).toBe(true);
  });

  it('accepts a staff cookie for a viewer gate — staff is the stronger claim', async () => {
    const { value } = createRosterAccessCookieValue('staff', SLUG);
    cookieStore.set(rosterAccessCookieName('staff', SLUG), value);
    expect(await canViewRosterPage(SLUG, 'password', true, true)).toBe(true);
  });

  it('does not accept a viewer cookie for a staff-only page', async () => {
    const { value } = createRosterAccessCookieValue('viewer', SLUG);
    cookieStore.set(rosterAccessCookieName('viewer', SLUG), value);
    expect(await canViewRosterPage(SLUG, 'staff', true, true)).toBe(false);
  });
});

describe('resolveViewerMode — the only source of staff', () => {
  it('is public with no cookie', async () => {
    expect(await resolveViewerMode(SLUG, true)).toBe('public');
  });

  it('is public when the page has no staff password, even with a staff cookie', async () => {
    const { value } = createRosterAccessCookieValue('staff', SLUG);
    cookieStore.set(rosterAccessCookieName('staff', SLUG), value);
    expect(await resolveViewerMode(SLUG, false)).toBe('public');
  });

  it('is public when only a viewer cookie is present', async () => {
    const { value } = createRosterAccessCookieValue('viewer', SLUG);
    cookieStore.set(rosterAccessCookieName('viewer', SLUG), value);
    expect(await resolveViewerMode(SLUG, true)).toBe('public');
  });

  it('is staff only with a valid staff cookie on a staff-enabled page', async () => {
    const { value } = createRosterAccessCookieValue('staff', SLUG);
    cookieStore.set(rosterAccessCookieName('staff', SLUG), value);
    expect(await resolveViewerMode(SLUG, true)).toBe('staff');
  });
});

describe('checkRosterPassword', () => {
  it('accepts the right password and rejects everything else', () => {
    const hash = hashViewerPassword('correct-horse');
    expect(checkRosterPassword('correct-horse', hash)).toBe(true);
    expect(checkRosterPassword('wrong', hash)).toBe(false);
    expect(checkRosterPassword('', hash)).toBe(false);
    // No hash configured for a scope must never unlock it.
    expect(checkRosterPassword('anything', null)).toBe(false);
  });
});
