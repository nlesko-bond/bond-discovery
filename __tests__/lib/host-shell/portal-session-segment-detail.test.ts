import { describe, expect, it, vi } from 'vitest';
import type { BondClient } from '@/lib/bond-client';
import { fetchEnrichedPortalSessionSegments } from '@/lib/host-shell/portal-session-segment-detail';

describe('fetchEnrichedPortalSessionSegments', () => {
  it('enriches segments from segment events without calling getSessions', async () => {
    const client = {
      getSegments: vi.fn().mockResolvedValue({
        data: [{ id: 'seg-1', name: 'Tue 9:30 am', startDate: '2026-09-08', endDate: '2026-11-03' }],
      }),
      getSegmentEvents: vi.fn().mockResolvedValue({
        // Two Tuesday occurrences, 9:30-10:30 AM ET. The schedule label is
        // derived from these events, NOT the (operator-editable) segment name.
        data: [
          {
            startDate: '2026-09-08T13:30:00Z',
            endDate: '2026-09-08T14:30:00Z',
            timezone: 'America/New_York',
            maxParticipants: 8,
            currentParticipants: 4,
            resources: [{ name: 'Field 2' }],
          },
          {
            startDate: '2026-09-15T13:30:00Z',
            endDate: '2026-09-15T14:30:00Z',
            timezone: 'America/New_York',
            maxParticipants: 8,
            currentParticipants: 4,
            resources: [{ name: 'Field 2' }],
          },
        ],
      }),
    } as unknown as BondClient;

    const rows = await fetchEnrichedPortalSessionSegments(
      client,
      '529',
      '14268',
      '120264',
      {
        name: 'ALL AGES FALL',
        programName: 'Coppermine Soccer Classes',
        facilityName: 'Sports Center',
        registrationWindowStatus: 'open',
        priceLabel: '$267.50',
      },
    );

    expect(client.getSegments).toHaveBeenCalledWith('529', '14268', '120264');
    expect(client.getSegmentEvents).toHaveBeenCalledWith(
      '529',
      '14268',
      '120264',
      'seg-1',
      { expand: 'resources,capacity' },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.scheduleLabel).toBe('Tue 9:30 AM – 10:30 AM');
    expect(rows[0]?.eventCount).toBe(2);
    expect(rows[0]?.spaceName).toBe('Field 2');
    expect(rows[0]?.availabilityLabel).toBe('4 spots left');
    expect(rows[0]?.priceLabel).toBe('$267.50');
    expect(rows[0]?.facilityName).toBe('Sports Center');
  });

  it('falls back to the trimmed segment name when events have no usable times', async () => {
    const client = {
      getSegments: vi.fn().mockResolvedValue({
        data: [{ id: 'seg-1', name: 'Coppermine Soccer Classes - ALL AGES FALL - Tue 9:30 am' }],
      }),
      getSegmentEvents: vi.fn().mockResolvedValue({ data: [] }),
    } as unknown as BondClient;

    const rows = await fetchEnrichedPortalSessionSegments(client, '529', '14268', '120264', {
      name: 'ALL AGES FALL',
      programName: 'Coppermine Soccer Classes',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.scheduleLabel).toBe('Tue 9:30 am');
    expect(rows[0]?.eventCount).toBeUndefined();
  });
});
