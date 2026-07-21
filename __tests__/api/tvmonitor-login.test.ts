import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUserByEmail = vi.fn();
const mockCreateLoginToken = vi.fn();
const mockConsumeLoginToken = vi.fn();
vi.mock('@/lib/tvmonitor-users', () => ({
  getTvMonitorUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
  createLoginToken: (...args: unknown[]) => mockCreateLoginToken(...args),
  consumeLoginToken: (...args: unknown[]) => mockConsumeLoginToken(...args),
}));

const mockSendEmail = vi.fn();
vi.mock('@/lib/tvmonitor-email', () => ({
  isStudioEmailConfigured: () => true,
  sendStudioLoginEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockResolveAccessToken = vi.fn();
vi.mock('@/lib/tvmonitor-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tvmonitor-access')>();
  return {
    ...actual,
    resolveAccessToken: (...args: unknown[]) => mockResolveAccessToken(...args),
  };
});

import { POST as POST_LOGIN } from '@/app/api/tvmonitor/studio/login/route';
import { POST as POST_SESSION } from '@/app/api/tvmonitor/studio/session/route';

const USER = {
  id: 'u-1',
  email: 'brian@hatfieldice.com',
  organization_ids: [725],
  role: 'editor',
  created_by: null,
  created_at: '',
  revoked_at: null,
  last_login_at: null,
};

function jsonRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/tvmonitor/studio/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TVMONITOR_ACCESS_SECRET', 'test-secret');
  });

  it('sends a link for a known active user', async () => {
    mockGetUserByEmail.mockResolvedValue(USER);
    mockCreateLoginToken.mockResolvedValue('tok-abc');
    const res = await POST_LOGIN(jsonRequest('http://localhost/api/tvmonitor/studio/login', { email: USER.email }));
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(USER.email, expect.stringContaining('login=tok-abc'));
  });

  it('returns the same generic response for unknown emails (no enumeration)', async () => {
    mockGetUserByEmail.mockResolvedValue(null);
    const res = await POST_LOGIN(
      jsonRequest('http://localhost/api/tvmonitor/studio/login', { email: 'stranger@example.com' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('does not send for revoked users', async () => {
    mockGetUserByEmail.mockResolvedValue({ ...USER, revoked_at: '2026-01-01' });
    const res = await POST_LOGIN(jsonRequest('http://localhost/api/tvmonitor/studio/login', { email: USER.email }));
    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/tvmonitor/studio/session with a login token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TVMONITOR_ACCESS_SECRET', 'test-secret');
  });

  it('creates a user session cookie for a valid token', async () => {
    mockConsumeLoginToken.mockResolvedValue(USER);
    const res = await POST_SESSION(jsonRequest('http://localhost/api/tvmonitor/studio/session', { login: 'tok' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ kind: 'user', email: USER.email, organizationIds: [725] });
    expect(res.headers.get('set-cookie')).toContain('bond_tvstudio=');
  });

  it('rejects invalid/used tokens', async () => {
    mockConsumeLoginToken.mockResolvedValue(null);
    const res = await POST_SESSION(jsonRequest('http://localhost/api/tvmonitor/studio/session', { login: 'used' }));
    expect(res.status).toBe(401);
  });

  it('still accepts legacy access-link keys', async () => {
    mockResolveAccessToken.mockResolvedValue({ id: 'g-1', organization_id: 61, label: 'x', token: null });
    const res = await POST_SESSION(jsonRequest('http://localhost/api/tvmonitor/studio/session', { key: 'legacy' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ kind: 'grant', organizationIds: [61] });
  });
});
