import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdminFrom = vi.fn();
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => mockAdminFrom(table) }),
}));

import { duplicateTvMonitorPage } from '@/lib/tvmonitor-config';

const SOURCE_ROW = {
  id: 'p-1',
  slug: 'hatfield-lobby',
  name: 'Hatfield Lobby',
  is_active: true,
  organization_id: 725,
  facility_id: 289,
  config: { template: 'custom' },
  created_by: 'brian@hatfieldice.com',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

/** Builds the three from() chain responses duplicateTvMonitorPage makes, in order. */
function mockChain(opts: { existingSlugs?: string[]; insertedSlug?: string }) {
  const bySlugBuilder = {
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: SOURCE_ROW, error: null }) }) }),
  };
  const likeBuilder = {
    select: () => ({
      like: () =>
        Promise.resolve({
          data: (opts.existingSlugs ?? []).map((slug) => ({ slug })),
          error: null,
        }),
    }),
  };
  const insertedSlug = opts.insertedSlug ?? 'copy-of-hatfield-lobby';
  const insertBuilder = {
    insert: (payload: Record<string, unknown>) => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { ...SOURCE_ROW, id: 'p-2', slug: insertedSlug, name: payload.name, is_active: payload.is_active },
            error: null,
          }),
      }),
    }),
  };
  mockAdminFrom.mockReturnValueOnce(bySlugBuilder).mockReturnValueOnce(likeBuilder).mockReturnValueOnce(insertBuilder);
}

describe('duplicateTvMonitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies name with "Copy of" prefix, config, org, and facility; sets inactive', async () => {
    mockChain({ existingSlugs: [] });
    const result = await duplicateTvMonitorPage('hatfield-lobby');

    expect(result.name).toBe('Copy of Hatfield Lobby');
    expect(result.slug).toBe('copy-of-hatfield-lobby');
    expect(result.is_active).toBe(false);
    expect(result.organization_id).toBe(SOURCE_ROW.organization_id);
    expect(result.facility_id).toBe(SOURCE_ROW.facility_id);
  });

  it('disambiguates the slug when "copy-of-*" is already taken', async () => {
    mockChain({ existingSlugs: ['copy-of-hatfield-lobby'], insertedSlug: 'copy-of-hatfield-lobby-2' });
    const result = await duplicateTvMonitorPage('hatfield-lobby');
    expect(result.slug).toBe('copy-of-hatfield-lobby-2');
  });

  it('throws when the source page does not exist', async () => {
    mockAdminFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
    });
    await expect(duplicateTvMonitorPage('missing')).rejects.toThrow('Page not found');
  });
});
