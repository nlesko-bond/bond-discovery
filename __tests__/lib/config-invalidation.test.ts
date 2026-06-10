import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDiscoveryPageRow, mockFeatures } from '../fixtures/mockData';

/**
 * Plan 006: cache invalidation on payload-affecting page-config updates.
 *
 * updatePageConfig must invalidate `discovery:response:{slug}` when a field
 * that changes the served events payload is updated (eventHorizonMonths,
 * bondEnv, org/facility ids, apiKey, program filters) — and must NOT
 * invalidate for branding-only edits. When bondEnv itself changes, BOTH the
 * old and new env key variants must be cleared.
 */

// React 18's client build (used by vitest/jsdom) has no `cache`; lib/config.ts
// uses it as a per-request memo on the server. Identity-wrap it in tests.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: (actual as { cache?: unknown }).cache ?? (<T,>(fn: T) => fn),
  };
});

const mockAdminFrom = vi.fn();
vi.mock('@/lib/supabase', () => ({
  getSupabasePublic: () => ({ from: (table: string) => mockAdminFrom(table) }),
  getSupabaseAdmin: () => ({ from: (table: string) => mockAdminFrom(table) }),
}));

const invalidateMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/cache', () => ({
  invalidateDiscoveryResponseCache: (...args: unknown[]) => invalidateMock(...args),
}));

// Import after mocks
import { updatePageConfig, updateAffectsDiscoveryPayload } from '@/lib/config';

const SLUG = 'test-page';

/**
 * Supabase mock: select chains resolve to the given row (used both by the
 * pre-update getConfigBySlug snapshot and the post-update fetch); update
 * chains succeed.
 */
function mockSupabaseRow(row: Record<string, unknown>) {
  mockAdminFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: row, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }));
}

describe('updateAffectsDiscoveryPayload', () => {
  it('is true for payload-affecting fields', () => {
    expect(updateAffectsDiscoveryPayload({ features: { eventHorizonMonths: 6 } } as any)).toBe(true);
    expect(updateAffectsDiscoveryPayload({ features: { bondEnv: 'staging' } } as any)).toBe(true);
    expect(updateAffectsDiscoveryPayload({ organizationIds: ['1'] } as any)).toBe(true);
    expect(updateAffectsDiscoveryPayload({ facilityIds: ['2'] } as any)).toBe(true);
    expect(updateAffectsDiscoveryPayload({ apiKey: 'k' } as any)).toBe(true);
    expect(updateAffectsDiscoveryPayload({ features: { programFilterMode: 'include' } } as any)).toBe(true);
    expect(updateAffectsDiscoveryPayload({ excludedProgramIds: ['3'] } as any)).toBe(true);
    expect(updateAffectsDiscoveryPayload({ includedProgramIds: ['4'] } as any)).toBe(true);
  });

  it('is false for branding/name/params-only edits', () => {
    expect(updateAffectsDiscoveryPayload({ branding: { primaryColor: '#fff' } } as any)).toBe(false);
    expect(updateAffectsDiscoveryPayload({ name: 'New Name' } as any)).toBe(false);
    expect(updateAffectsDiscoveryPayload({ defaultParams: { viewMode: 'programs' } } as any)).toBe(false);
  });
});

describe('updatePageConfig cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates the response cache when eventHorizonMonths changes', async () => {
    mockSupabaseRow(mockDiscoveryPageRow);

    await updatePageConfig(SLUG, { features: { ...mockFeatures, eventHorizonMonths: 6 } } as any);

    // rowToConfig normalizes a missing bondEnv to 'production'
    expect(invalidateMock).toHaveBeenCalledTimes(1);
    expect(invalidateMock).toHaveBeenCalledWith(SLUG, 'production');
  });

  it('invalidates BOTH env key variants when bondEnv changes production -> staging', async () => {
    mockSupabaseRow({
      ...mockDiscoveryPageRow,
      features: { ...mockFeatures, bondEnv: 'production' },
    });

    await updatePageConfig(SLUG, {
      features: { ...mockFeatures, bondEnv: 'staging' },
    } as any);

    // New env key (discovery:response:staging:{slug}) ...
    expect(invalidateMock).toHaveBeenCalledWith(SLUG, 'staging');
    // ... and the old env key (discovery:response:{slug}).
    expect(invalidateMock).toHaveBeenCalledWith(SLUG, 'production');
    expect(invalidateMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT invalidate for a branding-only update', async () => {
    mockSupabaseRow(mockDiscoveryPageRow);

    await updatePageConfig(SLUG, {
      branding: { ...mockDiscoveryPageRow.branding, primaryColor: '#FF0000' },
    } as any);

    expect(invalidateMock).not.toHaveBeenCalled();
  });
});
