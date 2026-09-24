import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BondClient, PROGRAMS_PAGE_SIZE } from '@/lib/bond-client';

/**
 * Bond's programs endpoint pages with `itemsPerPage` (default 30) and ignores
 * `per_page`. Sending the wrong param silently capped discovery at 30 programs
 * per org, so pin both the param name and full pagination.
 */

type Call = URL;

function bondPage(ids: number[], page: number, totalPages: number, totalItems: number) {
  return {
    data: ids.map((id) => ({ id })),
    meta: { type: 'page', totalItems, itemsPerPage: PROGRAMS_PAGE_SIZE, totalPages, currentPage: page },
  };
}

function range(from: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => from + i);
}

describe('BondClient programs pagination', () => {
  let calls: Call[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    calls = [];
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respondWith(pages: Record<number, unknown>) {
    fetchMock.mockImplementation(async (input: string) => {
      const url = new URL(input);
      calls.push(url);
      const page = Number(url.searchParams.get('page') || '1');
      return new Response(JSON.stringify(pages[page]), { status: 200 });
    });
  }

  const client = () => new BondClient({ apiKey: 'test-key' });

  it('getPrograms sends itemsPerPage (not per_page)', async () => {
    respondWith({ 1: bondPage([1, 2], 1, 1, 2) });

    await client().getPrograms('604');

    expect(calls).toHaveLength(1);
    expect(calls[0].searchParams.get('itemsPerPage')).toBe(String(PROGRAMS_PAGE_SIZE));
    expect(calls[0].searchParams.has('per_page')).toBe(false);
  });

  it('getAllPrograms makes one call when the org fits in a single page', async () => {
    respondWith({ 1: bondPage(range(1, 21), 1, 1, 21) });

    const res = await client().getAllPrograms('533', { expand: 'sessions' });

    expect(calls).toHaveLength(1);
    expect(calls[0].pathname).toBe('/v1/organization/533/programs');
    expect(calls[0].searchParams.get('itemsPerPage')).toBe(String(PROGRAMS_PAGE_SIZE));
    expect(calls[0].searchParams.get('expand')).toBe('sessions');
    expect(res.data).toHaveLength(21);
  });

  it('getAllPrograms follows meta.totalPages and returns every program', async () => {
    respondWith({
      1: bondPage(range(1, 100), 1, 3, 230),
      2: bondPage(range(101, 100), 2, 3, 230),
      3: bondPage(range(201, 30), 3, 3, 230),
    });

    const res = await client().getAllPrograms('61');

    expect(calls.map((u) => u.searchParams.get('page')).sort()).toEqual(['1', '2', '3']);
    for (const u of calls) {
      expect(u.searchParams.get('itemsPerPage')).toBe(String(PROGRAMS_PAGE_SIZE));
    }
    expect(res.data).toHaveLength(230);
    expect(new Set(res.data.map((p) => p.id)).size).toBe(230);
  });

  it('getAllPrograms rejects rather than returning a partial list when a later page fails', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      const url = new URL(input);
      const page = Number(url.searchParams.get('page'));
      if (page === 2) return new Response('boom', { status: 500, statusText: 'Server Error' });
      return new Response(JSON.stringify(bondPage(range(1, 100), 1, 2, 150)), { status: 200 });
    });

    // A partial list must never reach a cache write: the SWR/warm callers only
    // persist on resolve, so a reject keeps the previous complete payload.
    await expect(client().getAllPrograms('61')).rejects.toThrow(/500/);
  });
});
