import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getFacilityScheduleEvents,
  resolveFacilityScheduleLink,
} from '@/lib/facility-schedule-link';
import type { DiscoveryConfig } from '@/types';

function makeConfig(features: Record<string, unknown>): DiscoveryConfig {
  return {
    slug: 'test-page',
    name: 'Test',
    organizationIds: ['1'],
    branding: {},
    features,
  } as unknown as DiscoveryConfig;
}

const FEED_SLOT = {
  id: 'slot-1',
  title: 'Open Skate',
  eventType: 'reservation',
  startAt: '2026-08-20T22:00:00.000Z',
  endAt: '2026-08-20T23:30:00.000Z',
  timezone: 'America/New_York',
  spaceName: 'Main Rink',
  facilityId: 7,
  facilityName: 'Skate Zone',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveFacilityScheduleLink', () => {
  it('returns null without a slug', () => {
    expect(resolveFacilityScheduleLink(makeConfig({}))).toBeNull();
    expect(resolveFacilityScheduleLink(makeConfig({ facilityScheduleSlug: '  ' }))).toBeNull();
  });

  it('rejects slugs with unsafe characters', () => {
    expect(
      resolveFacilityScheduleLink(makeConfig({ facilityScheduleSlug: '../etc' }))
    ).toBeNull();
  });

  it('defaults slot types to reservation and drops invalid ones', () => {
    expect(resolveFacilityScheduleLink(makeConfig({ facilityScheduleSlug: 'pbsz-fac' }))).toEqual({
      slug: 'pbsz-fac',
      types: ['reservation'],
    });
    expect(
      resolveFacilityScheduleLink(
        makeConfig({
          facilityScheduleSlug: 'pbsz-fac',
          facilityScheduleSlotTypes: ['maintenance', 'bogus'],
        })
      )
    ).toEqual({ slug: 'pbsz-fac', types: ['maintenance'] });
  });
});

describe('getFacilityScheduleEvents', () => {
  it('returns [] when no link is configured, without fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(getFacilityScheduleEvents(makeConfig({}))).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps feed slots into discovery events with a prefixed id and rental type', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: 1, slug: 'map-fac', slots: [FEED_SLOT] }))
    );
    const events = await getFacilityScheduleEvents(
      makeConfig({ facilityScheduleSlug: 'map-fac' })
    );
    expect(events).toEqual([
      {
        id: 'fsched-slot-1',
        title: 'Open Skate',
        startDate: '2026-08-20T22:00:00.000Z',
        endDate: '2026-08-20T23:30:00.000Z',
        timezone: 'America/New_York',
        facilityId: '7',
        facilityName: 'Skate Zone',
        spaceName: 'Main Rink',
        type: 'rental',
      },
    ]);
  });

  it('maps the feed activity slug onto the event sport', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          slug: 'act-fac',
          slots: [{ ...FEED_SLOT, activityName: 'hockey' }],
        })
      )
    );
    const events = await getFacilityScheduleEvents(
      makeConfig({ facilityScheduleSlug: 'act-fac' })
    );
    expect(events[0].sport).toBe('hockey');
  });

  it('normalizes multi-word activity slugs to the program sport convention', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          slug: 'norm-fac',
          slots: [
            { ...FEED_SLOT, id: 'a', activityName: 'ice-skating' },
            { ...FEED_SLOT, id: 'b', activityName: 'corporate event' },
          ],
        })
      )
    );
    const events = await getFacilityScheduleEvents(
      makeConfig({ facilityScheduleSlug: 'norm-fac' })
    );
    expect(events.map((e) => e.sport)).toEqual(['ice_skating', 'corporate_event']);
  });

  it('rejects an unsupported feed version', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: 99, slug: 'ver-fac', slots: [] }))
    );
    await expect(
      getFacilityScheduleEvents(makeConfig({ facilityScheduleSlug: 'ver-fac' }))
    ).rejects.toThrow(/unsupported payload/);
  });

  it('drops slots missing required timing fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          slug: 'partial-fac',
          slots: [FEED_SLOT, { ...FEED_SLOT, id: 'bad', startAt: undefined }],
        })
      )
    );
    const events = await getFacilityScheduleEvents(
      makeConfig({ facilityScheduleSlug: 'partial-fac' })
    );
    expect(events.map((e) => e.id)).toEqual(['fsched-slot-1']);
  });
});
