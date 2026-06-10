import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Plan 006: warm-on-create / warm-on-payload-affecting-update.
 *
 * POST /api/pages must warm the new slug's discovery response cache (with a
 * timeout so admin UX stays bounded), and PATCH must re-warm only when the
 * update affects the events payload. The real updateAffectsDiscoveryPayload
 * predicate is used (config DB functions mocked).
 */

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// React 18's client build (used by vitest/jsdom) has no `cache`.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: (actual as { cache?: unknown }).cache ?? (<T,>(fn: T) => fn),
  };
});

// lib/config imports supabase at module scope; keep it inert.
vi.mock('@/lib/supabase', () => ({
  getSupabasePublic: () => ({ from: vi.fn() }),
  getSupabaseAdmin: () => ({ from: vi.fn() }),
}));

const mockCreatePageConfig = vi.fn();
const mockUpdatePageConfig = vi.fn();
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    createPageConfig: (...args: unknown[]) => mockCreatePageConfig(...args),
    updatePageConfig: (...args: unknown[]) => mockUpdatePageConfig(...args),
  };
});

const warmWithTimeoutMock = vi.fn();
vi.mock('@/lib/discovery-warm', () => ({
  warmScopeGroup: vi.fn().mockResolvedValue([]),
  warmScopeGroupWithTimeout: (...args: unknown[]) => warmWithTimeoutMock(...args),
}));

// Import after mocks
import { POST } from '@/app/api/pages/route';
import { PATCH } from '@/app/api/pages/[slug]/route';

const SLUG = 'new-page';
const routeParams = { params: { slug: SLUG } };

function postRequest() {
  return new NextRequest('http://localhost/api/pages', {
    method: 'POST',
    body: JSON.stringify({ name: 'New Page', slug: SLUG, organizationIds: ['100'] }),
  });
}

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/pages/${SLUG}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

const createdConfig = {
  slug: SLUG,
  organizationIds: ['100'],
  features: {},
  cacheTtl: 300,
};

describe('warm-on-create / warm-on-update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    warmWithTimeoutMock.mockResolvedValue([]);
    mockCreatePageConfig.mockResolvedValue(createdConfig);
    mockUpdatePageConfig.mockResolvedValue(createdConfig);
  });

  it('POST /api/pages warms the newly created config', async () => {
    const res = await POST(postRequest());

    expect(res.status).toBe(200);
    expect(warmWithTimeoutMock).toHaveBeenCalledTimes(1);
    expect(warmWithTimeoutMock).toHaveBeenCalledWith([createdConfig]);
  });

  it('POST still responds 200 when the warm times out', async () => {
    warmWithTimeoutMock.mockResolvedValue('timeout');

    const res = await POST(postRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.page).toEqual(createdConfig);
  });

  it('PATCH changing eventHorizonMonths re-warms the config', async () => {
    const res = await PATCH(patchRequest({ features: { eventHorizonMonths: 6 } }), routeParams);

    expect(res.status).toBe(200);
    expect(warmWithTimeoutMock).toHaveBeenCalledTimes(1);
    expect(warmWithTimeoutMock).toHaveBeenCalledWith([createdConfig]);
  });

  it('PATCH changing only branding does NOT warm', async () => {
    const res = await PATCH(
      patchRequest({ branding: { primaryColor: '#FF0000' } }),
      routeParams,
    );

    expect(res.status).toBe(200);
    expect(warmWithTimeoutMock).not.toHaveBeenCalled();
  });
});
