/**
 * Route-level tests for the roster surface.
 *
 * The unit tests on `redactParticipant` prove the choke point works *if
 * reached*. These prove the routes reach it, gate before it, and bound every
 * id to the page's configured scope — which unit tests on pure functions
 * structurally cannot show.
 *
 * Follows the repo's established pattern (see tvmonitor-routes.test.ts): mock
 * config and Bond, let the real cache and redaction layers run.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_ROSTER_FIELD_VISIBILITY, type RosterPageConfig } from '@/types/rosters';

const mockGetRosterPageBySlug = vi.fn();
vi.mock('@/lib/rosters-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rosters-config')>();
  return { ...actual, getRosterPageBySlug: (slug: string) => mockGetRosterPageBySlug(slug) };
});

let viewerMode: 'public' | 'staff' = 'public';
let canView = true;
vi.mock('@/lib/roster-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/roster-access')>();
  return {
    ...actual,
    canViewRosterPage: async () => canView,
    resolveViewerMode: async () => viewerMode,
  };
});

const getPrograms = vi.fn();
const getSessionGroups = vi.fn();
const getGroupParticipants = vi.fn();
vi.mock('@/lib/bond-client', () => ({
  createBondClient: () => ({
    getAllPrograms: getPrograms,
    getSessionGroups,
    getGroupParticipants,
    getEventParticipants: vi.fn(async () => ({ data: [] })),
    getEvents: vi.fn(async () => ({ data: [] })),
  }),
}));

import { GET as GET_SCOPE } from '@/app/api/rosters/[slug]/scope/route';
import { GET as GET_PARTICIPANTS } from '@/app/api/rosters/[slug]/participants/route';
import { cacheClear } from '@/lib/cache';
import { resetRosterRateLimits } from '@/lib/roster-rate-limit';

const SLUG = 'coppermine';

function config(over: Partial<RosterPageConfig> = {}): RosterPageConfig {
  return {
    id: 'id',
    slug: SLUG,
    name: 'Rosters',
    isActive: true,
    organizationIds: [516],
    programFilter: { mode: 'all', programIds: [] },
    pinnedSessions: [],
    sessionWindow: { pastDays: 3650, futureDays: 3650 },
    branding: {} as RosterPageConfig['branding'],
    pageAccess: 'public',
    fieldVisibility: { ...DEFAULT_ROSTER_FIELD_VISIBILITY, nameMode: 'full' },
    allowIndexing: false,
    allowPrint: true,
    isYouth: false,
    hasViewerPassword: false,
    hasStaffPassword: true,
    apiKey: 'test-key',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

/** One program, one in-window session, one division containing one team. */
function seedBond() {
  getPrograms.mockResolvedValue({
    data: [
      {
        id: '11551',
        name: 'Adult Soccer',
        organizationId: '516',
        // Bond returns expanded sessions as a { meta, data } envelope, not a
        // bare array. Mirroring that here is the point of this fixture: a bare
        // array would let an Array.isArray() bug pass unnoticed.
        sessions: {
          meta: { totalItems: 1 },
          data: [{ id: '127956', programId: '11551', name: 'Fall', startDate: '2026-08-01' }],
        },
      },
    ],
  });
  getSessionGroups.mockResolvedValue({
    data: [
      { id: 10, name: 'Division A', isTeam: false, parentId: null, playerCount: 0, deletedAt: null },
      { id: 11, name: 'Blue', isTeam: true, parentId: 10, playerCount: 1, deletedAt: null },
    ],
  });
  getGroupParticipants.mockResolvedValue({
    data: [
      {
        rosterParticipantId: 1,
        userId: 9,
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '2005-06-15',
        gender: 'MALE',
        contact: { email: 'john@example.com', phoneNumber: '+1555' },
        registration: { waiverSigned: false },
        playerInfo: { jerseyNumber: 7, position: 'Forward' },
        primary: { firstName: 'Jane', lastName: 'Doe', email: 'guardian@example.com' },
        deletedAt: null,
      },
    ],
  });
}

const ctx = { params: Promise.resolve({ slug: SLUG }) };
const req = (qs: string) =>
  new NextRequest(`http://localhost/api/rosters/${SLUG}/participants?${qs}`);

beforeEach(async () => {
  vi.clearAllMocks();
  await cacheClear();
  resetRosterRateLimits();
  viewerMode = 'public';
  canView = true;
  mockGetRosterPageBySlug.mockResolvedValue(config());
  seedBond();
});

describe('session resolution from Bond', () => {
  it('reads sessions out of the { meta, data } envelope Bond actually returns', async () => {
    const response = await GET_SCOPE(req(''), ctx);
    const body = await response.json();
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].sessionId).toBe(127956);
    expect(body.sessions[0].organizationId).toBe(516);
  });
});

describe('page gating', () => {
  it('404s an unknown page', async () => {
    mockGetRosterPageBySlug.mockResolvedValue(null);
    expect((await GET_SCOPE(req(''), ctx)).status).toBe(404);
  });

  it('404s an unpublished page, indistinguishable from missing', async () => {
    mockGetRosterPageBySlug.mockResolvedValue(config({ isActive: false }));
    expect((await GET_SCOPE(req(''), ctx)).status).toBe(404);
  });

  it('401s a locked page', async () => {
    canView = false;
    const response = await GET_SCOPE(req(''), ctx);
    expect(response.status).toBe(401);
    expect((await response.json()).locked).toBe(true);
  });
});

describe('scope bounding', () => {
  it('404s a session outside the page scope', async () => {
    const response = await GET_PARTICIPANTS(req('sessionId=999999&groupId=11'), ctx);
    expect(response.status).toBe(404);
    expect(getGroupParticipants).not.toHaveBeenCalled();
  });

  it('404s a group that is not in the session tree, without fetching it', async () => {
    const response = await GET_PARTICIPANTS(req('sessionId=127956&groupId=4242'), ctx);
    expect(response.status).toBe(404);
    // The point of the guard: no Bond call for an out-of-scope id.
    expect(getGroupParticipants).not.toHaveBeenCalled();
  });

  it('404s when any id in a bulk request is out of scope', async () => {
    const response = await GET_PARTICIPANTS(req('sessionId=127956&groupIds=11,4242'), ctx);
    expect(response.status).toBe(404);
    expect(getGroupParticipants).not.toHaveBeenCalled();
  });

  it('serves a group that is in the tree', async () => {
    const response = await GET_PARTICIPANTS(req('sessionId=127956&groupId=11'), ctx);
    expect(response.status).toBe(200);
    expect(getGroupParticipants).toHaveBeenCalled();
  });

  it('rejects a non-numeric id rather than coercing it', async () => {
    expect((await GET_PARTICIPANTS(req('sessionId=127956&groupId=11abc'), ctx)).status).toBe(400);
  });
});

describe('redaction is actually reached', () => {
  it('emits no PII to a public viewer', async () => {
    const response = await GET_PARTICIPANTS(req('sessionId=127956&groupId=11'), ctx);
    const body = await response.json();

    expect(body.mode).toBe('public');
    const [participant] = body.participants;
    expect(participant.displayName).toBe('John Doe');
    for (const key of ['email', 'phone', 'birthDate', 'age', 'gender', 'waiverSigned', 'guardianName']) {
      expect(participant).not.toHaveProperty(key);
    }
    // Nothing anywhere in the payload, not just on the participant object.
    expect(JSON.stringify(body)).not.toContain('john@example.com');
    expect(JSON.stringify(body)).not.toContain('guardian@example.com');
  });

  it('emits staff fields only in staff mode', async () => {
    viewerMode = 'staff';
    const response = await GET_PARTICIPANTS(req('sessionId=127956&groupId=11'), ctx);
    const [participant] = (await response.json()).participants;

    expect(participant.email).toBe('guardian@example.com');
    expect(participant.waiverSigned).toBe(false);
  });

  it('cannot be pushed into staff mode by a query parameter', async () => {
    const response = await GET_PARTICIPANTS(
      req('sessionId=127956&groupId=11&mode=staff&staff=true'),
      ctx
    );
    const body = await response.json();
    expect(body.mode).toBe('public');
    expect(body.participants[0]).not.toHaveProperty('email');
  });

  it('never lets a public request pull PII blocks from Bond at all', async () => {
    await GET_PARTICIPANTS(req('sessionId=127956&groupId=11'), ctx);
    const expand: string[] = getGroupParticipants.mock.calls[0][4].expand;
    for (const block of ['contact', 'primary', 'primaryContact', 'registration']) {
      expect(expand).not.toContain(block);
    }
  });
});

describe('PII responses are not cacheable', () => {
  it('sets private, no-store', async () => {
    const response = await GET_PARTICIPANTS(req('sessionId=127956&groupId=11'), ctx);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Vary')).toBe('Cookie');
  });
});

describe('rate limiting', () => {
  it('429s a caller that floods the bulk endpoint', async () => {
    let last = await GET_PARTICIPANTS(req('sessionId=127956&groupId=11'), ctx);
    for (let i = 0; i < 40 && last.status !== 429; i++) {
      last = await GET_PARTICIPANTS(req('sessionId=127956&groupId=11'), ctx);
    }
    expect(last.status).toBe(429);
    expect(last.headers.get('Retry-After')).toBeTruthy();
  });
});
