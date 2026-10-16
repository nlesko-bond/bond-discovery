import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BondClient } from '@/lib/bond-client';

/**
 * Bond's programs endpoint filters on `facilitiesIds` and `statuses`, and
 * silently ignores the `facility_id` / `status` params BondClient used to send.
 * Verified live 2026-09-24: `facility_id=639` on org 529 returned all 11
 * programs, while `facilitiesIds=639` returned 5. Pin the param names.
 */
describe('BondClient program filter params', () => {
  let calls: URL[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        calls.push(new URL(input));
        return new Response(
          JSON.stringify({
            data: [],
            meta: { type: 'page', totalItems: 0, itemsPerPage: 100, totalPages: 1, currentPage: 1 },
          }),
          { status: 200 }
        );
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const client = () => new BondClient({ apiKey: 'test-key' });

  it('getPrograms sends facilityId as facilitiesIds', async () => {
    await client().getPrograms('529', { facilityId: '639' });

    expect(calls).toHaveLength(1);
    expect(calls[0].searchParams.get('facilitiesIds')).toBe('639');
    expect(calls[0].searchParams.has('facility_id')).toBe(false);
  });

  it('getAllPrograms sends facilityId as facilitiesIds', async () => {
    await client().getAllPrograms('529', { facilityId: '639' });

    expect(calls[0].searchParams.get('facilitiesIds')).toBe('639');
    expect(calls[0].searchParams.has('facility_id')).toBe(false);
  });

  it('sends statuses comma-joined and never the ignored status param', async () => {
    await client().getPrograms('529', { statuses: ['PUBLISHED', 'CLOSED'] });
    await client().getAllPrograms('529', { statuses: ['DRAFT'] });

    expect(calls[0].searchParams.get('statuses')).toBe('PUBLISHED,CLOSED');
    expect(calls[1].searchParams.get('statuses')).toBe('DRAFT');
    for (const call of calls) {
      expect(call.searchParams.has('status')).toBe(false);
    }
  });

  it('omits the filters when they are not set', async () => {
    await client().getPrograms('529');
    await client().getAllPrograms('529', { facilityId: '', statuses: [] });

    for (const call of calls) {
      expect(call.searchParams.has('facilitiesIds')).toBe(false);
      expect(call.searchParams.has('statuses')).toBe(false);
    }
  });
});
