import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next-auth session lookup
const mockGetServerSession = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// Mock the config layer so handlers never touch Supabase
const mockCreatePageConfig = vi.fn();
const mockUpdatePageConfig = vi.fn();
const mockDeletePageConfig = vi.fn();
const mockGetAllPageConfigs = vi.fn();
const mockGetConfigBySlug = vi.fn();

vi.mock('@/lib/config', () => ({
  defaultConfig: {
    branding: {},
    features: {},
    allowedParams: [],
  },
  getAllPageConfigs: (...args: unknown[]) => mockGetAllPageConfigs(...args),
  getConfigBySlug: (...args: unknown[]) => mockGetConfigBySlug(...args),
  createPageConfig: (...args: unknown[]) => mockCreatePageConfig(...args),
  updatePageConfig: (...args: unknown[]) => mockUpdatePageConfig(...args),
  deletePageConfig: (...args: unknown[]) => mockDeletePageConfig(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Import after mocks
import { POST } from '@/app/api/pages/route';
import { PATCH, DELETE } from '@/app/api/pages/[slug]/route';

const SLUG = 'test-slug';
const routeParams = { params: { slug: SLUG } };

function postRequest() {
  return new NextRequest('http://localhost/api/pages', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test', slug: SLUG, organizationIds: [1] }),
  });
}

function patchRequest() {
  return new NextRequest(`http://localhost/api/pages/${SLUG}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Updated' }),
  });
}

function deleteRequest() {
  return new NextRequest(`http://localhost/api/pages/${SLUG}`, {
    method: 'DELETE',
  });
}

describe('page-config API auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Ensure no bypass is active by default in tests
    vi.stubEnv('ADMIN_AUTH_BYPASS', '');
    vi.stubEnv('NEXT_PUBLIC_ADMIN_AUTH_BYPASS', '');
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', 'admin@bondsports.co');
    mockGetServerSession.mockResolvedValue(null);
  });

  it('POST /api/pages with no session returns 401', async () => {
    const res = await POST(postRequest());
    expect(res.status).toBe(401);
    expect(mockCreatePageConfig).not.toHaveBeenCalled();
  });

  it('PATCH /api/pages/[slug] with no session returns 401', async () => {
    const res = await PATCH(patchRequest(), routeParams);
    expect(res.status).toBe(401);
    expect(mockUpdatePageConfig).not.toHaveBeenCalled();
  });

  it('DELETE /api/pages/[slug] with no session returns 401', async () => {
    const res = await DELETE(deleteRequest(), routeParams);
    expect(res.status).toBe(401);
    expect(mockDeletePageConfig).not.toHaveBeenCalled();
  });

  it('PATCH with an allowlisted session email proceeds', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: 'admin@bondsports.co' },
    });
    mockUpdatePageConfig.mockResolvedValue({ slug: SLUG });

    const res = await PATCH(patchRequest(), routeParams);
    expect(res.status).toBe(200);
    expect(mockUpdatePageConfig).toHaveBeenCalledWith(SLUG, { name: 'Updated' });
  });

  it('session email not in allowlist returns 403', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: 'intruder@example.com' },
    });

    const res = await PATCH(patchRequest(), routeParams);
    expect(res.status).toBe(403);
    expect(mockUpdatePageConfig).not.toHaveBeenCalled();
  });

  it('ADMIN_AUTH_BYPASS=true does not work in production', async () => {
    vi.stubEnv('ADMIN_AUTH_BYPASS', 'true');
    vi.stubEnv('NEXT_PUBLIC_ADMIN_AUTH_BYPASS', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(postRequest());
    expect(res.status).toBe(401);
    expect(mockCreatePageConfig).not.toHaveBeenCalled();
  });
});
